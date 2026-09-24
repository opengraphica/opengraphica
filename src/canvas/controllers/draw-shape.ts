import { nextTick, watch, WatchStopHandle } from 'vue';

import { type PointerTracker } from './base';
import BaseCanvasMovementController from './base-movement';
import {
    drawShapeToolbarEmitter,
    fillColor, strokeColor, selectedShapeType,
    editControlPoints, editControlPointsDirty, hoveringEditControlPointIndices,
    selectedEditControlPointIndices, selectedEditControlAttachPointIndices,
    editControlPointNodes, renderControlPointAttributeEdits, editControlPointNodeParsedAttributes,
    editingLayers, hasVisibleToolbarOverlay, showShapeDrawer,
    type ControlPointAttributeEdit,
} from '@/canvas/store/draw-shape-state';

import { hexToColor } from '@/lib/color';
import appEmitter, { type AppEmitterEvents } from '@/lib/emitter';
import { isEqualApprox, pointDistance2d } from '@/lib/math';
import { getViewBox, generateSvgElementIds, parseNodeTransform } from '@/lib/svg';
import { AsyncCallbackQueue } from '@/lib/timing';
import { dismissTutorialNotification, scheduleTutorialNotification, waitForNoOverlays } from '@/lib/tutorial';
import { t, tm, rt } from '@/i18n';

import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import historyStore, {
    createHistoryReserveToken, historyBlockInteractionUntilComplete,
} from '@/store/history';
import { createStoredSvg, getStoredSvgDocument } from '@/store/svg';
import workingFileStore, { getSelectedLayers, getLayerGlobalTransform, ensureUniqueLayerSiblingName, getLayerById } from '@/store/working-file';

import type { BaseAction } from '@/actions/base';
import { BundleAction } from '@/actions/bundle';
import { InsertLayerAction } from '@/actions/insert-layer';
import { UpdateLayerAction } from '@/actions/update-layer';
import { UpdateVectorLayerAttributesAction } from '@/actions/update-vector-layer-attributes';

import { useRenderer } from '@/renderers';

import type {
    RendererFrontend, RGBAColor,
    WorkingFileVectorLayer, WorkingFileAnyLayer,
    InsertVectorLayerOptions, UpdateVectorLayerOptions,
} from '@/types';

const devicePixelRatio = window.devicePixelRatio || 1;

interface DrawingShape {
    layer: WorkingFileVectorLayer;
    nodeXf: DOMMatrix;
    element: Element;
}

export default class CanvasDrawShapetController extends BaseCanvasMovementController {

    private selectedLayerIdsUnwatch: WatchStopHandle | null = null;

    private renderer: RendererFrontend | null = null;

    private hasCreatedLayer: boolean = false;
    private selectedLayers: WorkingFileVectorLayer[] = [];
    
    private dragHandleRadius: number = 6;
    private dragHandleRadiusTouch: number = 10;
    private dragStartPoint: DOMPoint = new DOMPoint();
    private draggingEditControlPointIndices: number[] = [];
    private pendingControlPointEdits: ControlPointAttributeEdit[] = [];

    private drawingPointerId: number | null = null;
    private drawingShapes: DrawingShape[] = [];
    private actionQueue: AsyncCallbackQueue = new AsyncCallbackQueue();

    // private editingLayersStartData: Array<WorkingFileVectorLayer['data']> | null = null;


    onEnter(): void {
        super.onEnter();

        useRenderer().then((renderer) => {
            this.renderer = renderer;
        });

        this.selectedLayerIdsUnwatch = watch(() => workingFileStore.state.selectedLayerIds, (newIds, oldIds) => {
            getSelectedLayers<WorkingFileVectorLayer>(oldIds).filter(
                layer => layer.type === 'vector'
            ).forEach((layer) => {
                delete layer.data.sourceDocument;
            });

            this.selectedLayers = getSelectedLayers<WorkingFileVectorLayer>(newIds).filter(
                layer => layer.type === 'vector'
            );
            for (const layer of this.selectedLayers) {
                getStoredSvgDocument(layer.data.sourceUuid).then((document) => {
                    layer.data.sourceDocument = document;
                });
            }
            editingLayers.value = this.selectedLayers.slice();
            this.updateToolbarFromEditingLayers();
        }, { immediate: true });

        this.onFillColorChanged = this.onFillColorChanged.bind(this);
        drawShapeToolbarEmitter.on('fillColorChanged', this.onFillColorChanged);
        this.onStrokeColorChanged = this.onStrokeColorChanged.bind(this);
        drawShapeToolbarEmitter.on('strokeColorChanged', this.onStrokeColorChanged);

        this.onHistoryStep = this.onHistoryStep.bind(this);
        appEmitter.on('editor.history.step', this.onHistoryStep);

        // Tutorial message
        if (!editorStore.state.tutorialFlags.drawShapeToolIntroduction) {
            waitForNoOverlays().then(() => {
                let message = (tm('tutorialTip.drawShapeToolIntroduction.introduction') as string[]).map((message) => {
                    return `<p class="mb-3!">${rt(message)}</p>`;
                }).join('');
                scheduleTutorialNotification({
                    flag: 'drawShapeToolIntroduction',
                    title: t('tutorialTip.drawShapeToolIntroduction.title'),
                    message: {
                        touch: message + (tm('tutorialTip.drawShapeToolIntroduction.body.touch') as string[]).map((message) => {
                            return `<p class="mb-3!">${rt(message, {
                                add: `<strong class="font-bold"><span class="bi bi-plus-circle"></span> ${t('tutorialTip.drawShapeToolIntroduction.bodyTitle.add')}</strong>`,
                                edit: `<strong class="font-bold"><span class="bi bi-pencil-square"></span> ${t('tutorialTip.drawShapeToolIntroduction.bodyTitle.edit')}</strong>`,
                            })}</p>`
                        }).join(''),
                        mouse: message + (tm('tutorialTip.drawShapeToolIntroduction.body.mouse') as string[]).map((message) => {
                            return `<p class="mb-3!">${rt(message, {
                                add: `<strong class="font-bold"><span class="bi bi-plus-circle"></span> ${t('tutorialTip.drawShapeToolIntroduction.bodyTitle.add')}</strong>`,
                                edit: `<strong class="font-bold"><span class="bi bi-pencil-square"></span> ${t('tutorialTip.drawShapeToolIntroduction.bodyTitle.edit')}</strong>`,
                            })}</p>`
                        }).join(''),
                    }
                });
            });
        }
    }

    onLeave(): void {
        super.onLeave();

        for (const layer of getSelectedLayers<WorkingFileVectorLayer>(workingFileStore.state.selectedLayerIds)) {
            if (layer.type === 'vector') {
                delete layer.data.sourceDocument;
            }
        }

        showShapeDrawer.value = false;
        this.selectedLayerIdsUnwatch?.();
        this.selectedLayerIdsUnwatch = null;

        drawShapeToolbarEmitter.off('fillColorChanged', this.onFillColorChanged);
        drawShapeToolbarEmitter.off('strokeColorChanged', this.onStrokeColorChanged);

        appEmitter.off('editor.history.step', this.onHistoryStep);

        // Tutorial Message
        if (!editorStore.state.tutorialFlags.drawGradientToolIntroduction) {
            dismissTutorialNotification('drawGradientToolIntroduction');
        }

        // Block UI changes until history actions have completed
        historyBlockInteractionUntilComplete();
    }

    onPointerDown(e: PointerEvent) {
        super.onPointerDown(e);

        if (hasVisibleToolbarOverlay.value) {
            showShapeDrawer.value = false;
            return;
        }

        const pointer = this.pointers.filter((pointer) => pointer.id === e.pointerId)[0];
        if (pointer && pointer.down.isPrimary && pointer.type !== 'touch' && pointer.down.button === 0) {
            const editControlPointIndices = this.getEditControlPointIndicesAtPagePoint(e.pageX, e.pageY);
            if (editControlPointIndices.length === 0) {
                selectedEditControlPointIndices.value = [];
                selectedEditControlAttachPointIndices.value = [];
                ({ viewTransformPoint: this.dragStartPoint } = this.getTransformedCursorInfo());
                // if (this.drawingPointerId == null) {
                //     this.drawingPointerId = e.pointerId;
                //     this.drawShapeStart(pointer)
                // }
            } else {
                selectedEditControlPointIndices.value = editControlPointIndices;
                this.dragEditControlPointStart(pointer);
            }
        }
    }

    onMultiTouchDown() {
        super.onMultiTouchDown();
        if (this.touches.length === 1) {
            const editControlPointIndices = this.getEditControlPointIndicesAtPagePoint(this.touches[0].down.pageX, this.touches[0].down.pageY);
            if (editControlPointIndices.length === 0) {
                selectedEditControlPointIndices.value = [];
                selectedEditControlAttachPointIndices.value = [];
                ({ viewTransformPoint: this.dragStartPoint } = this.getTransformedCursorInfo());
                // if (this.drawingPointerId == null) {
                //     this.drawingPointerId = this.touches[0].down.pointerId;
                //     this.drawShapeStart(this.touches[0])
                // }
            } else {
                selectedEditControlPointIndices.value = editControlPointIndices;
                this.dragEditControlPointStart(this.touches[0]);
            }
        }
    }

    protected async drawShapeStart(e: PointerTracker) {
        if (
            this.drawingPointerId == null
            || (fillColor.value.alpha <= 0 && strokeColor.value.alpha <= 0)
        ) return;

        const startDrawReserveToken = createHistoryReserveToken();
        await historyStore.dispatch('reserve', { token: startDrawReserveToken });

        const { width, height } = workingFileStore.state;
        let selectedLayers = getSelectedLayers().filter(layer => layer.type === 'vector' || layer.type === 'empty');
        let layerActions: BaseAction[] = [];

        const newSvgString = `<svg width="${Math.round(width)}" height="${Math.round(height)}" xmlns="http://www.w3.org/2000/svg"></svg>`;

        // Insert raster layer if none selected
        if (selectedLayers.length === 0) {
            const svgDocument = new DOMParser().parseFromString(newSvgString, 'image/svg+xml');
            layerActions.push(new InsertLayerAction<InsertVectorLayerOptions>({
                type: 'vector',
                name: ensureUniqueLayerSiblingName(
                    workingFileStore.state.layers[0]?.id, t('toolbar.drawShape.newVectorLayerName')
                ),
                width,
                height,
                transform: new DOMMatrix(),
                data: {
                    sourceUuid: await createStoredSvg((() => {
                        const image = new Image();
                        image.src = URL.createObjectURL(new Blob([newSvgString], { type: 'image/svg+xml' }));
                        return image;
                    })()),
                    sourceDocument: svgDocument,
                }
            }));
        }

        // Convert any empty layers to vector layers
        for (let i = selectedLayers.length - 1; i >= 0; i--) {
            const selectedLayer = selectedLayers[i];
            if (selectedLayer.type === 'empty') {
                const svgDocument = new DOMParser().parseFromString(newSvgString, 'image/svg+xml');
                layerActions.push(
                    new UpdateLayerAction<UpdateVectorLayerOptions>({
                        id: selectedLayer.id,
                        type: 'vector',
                        width,
                        height,
                        transform: new DOMMatrix(),
                        data: {
                            sourceUuid: await createStoredSvg((() => {
                                const image = new Image();
                                image.src = URL.createObjectURL(new Blob([newSvgString], { type: 'image/svg+xml' }));
                                return image;
                            })()),
                            sourceDocument: svgDocument,
                        },
                    })
                );
            } else if (selectedLayer.type !== 'vector') {
                selectedLayers.splice(i, 1);
            }
        }

        this.actionQueue.push(async () => {
            // Finalize layer creation / conversion actions.
            if (layerActions.length > 0) {
                try {
                    await historyStore.dispatch('runAction', {
                        action: new BundleAction('createShapeLayer', 'action.createShapeLayer', layerActions),
                        reserveToken: startDrawReserveToken,
                    });
                } catch {
                    await historyStore.dispatch('unreserve', { token: startDrawReserveToken });
                }
            } else {
                await historyStore.dispatch('unreserve', { token: startDrawReserveToken });
            }

            await nextTick();

            const { viewTransformPoint } = this.getTransformedCursorInfo();

            // Start a vector shape on each of the selected layers
            selectedLayers = getSelectedLayers().filter(layer => layer.type === 'vector');
            const drawingOnLayers = selectedLayers as WorkingFileVectorLayer[];
            this.drawingShapes = [];

            for (const layer of drawingOnLayers) {
                const layerDocument = await getStoredSvgDocument(layer.data.sourceUuid);

                let element: Element | null = null;
                const tagName = {
                    rectangle: 'rect',
                    ellipse: 'ellipse',
                }[selectedShapeType.value] ?? '';
                if (tagName) {
                    element = layerDocument.createElement(tagName);
                }
                if (!element) continue;

                const viewBox = getViewBox(layer.data.sourceDocument);
                const transform  = parseNodeTransform(layerDocument.documentElement);
                const nodeXf = layer.transform.scale(
                    layer.width / viewBox.width, layer.height / viewBox.height, 1.0,
                ).translateSelf(
                    viewBox.x, viewBox.y, 0.0,
                ).multiplySelf(
                    transform,
                ).invertSelf();

                switch (tagName) {
                    case 'rect':
                        const position1 = new DOMPoint(
                            this.dragStartPoint.x,
                            this.dragStartPoint.y,
                        ).matrixTransform(nodeXf);
                        const position2 = new DOMPoint(
                            viewTransformPoint.x,
                            viewTransformPoint.y,
                        ).matrixTransform(nodeXf);
                        const x = Math.min(position1.x, position2.x);
                        const y = Math.min(position1.y, position2.y);
                        element.setAttribute('x', `${x}`);
                        element.setAttribute('y', `${y}`);
                        element.setAttribute('width', `${Math.max(position1.x, position2.x) - x}`);
                        element.setAttribute('height', `${Math.max(position1.y, position2.y) - y}`);
                        break;
                }
                element.setAttribute('fill', fillColor.value.alpha > 0 ? fillColor.value.style.slice(0, 7) : 'none');
                element.setAttribute('fill-opacity', `${fillColor.value.alpha}`);
                if (strokeColor.value.alpha > 0) {
                    element.setAttribute('stroke', strokeColor.value.style.slice(0, 7));
                    element.setAttribute('stroke-opacity', `${strokeColor.value.alpha}`);
                    element.setAttribute('stroke-width', '1'); // TODO
                }

                layerDocument.documentElement.append(element);
                generateSvgElementIds(layerDocument);

                this.drawingShapes.push({
                    layer,
                    nodeXf,
                    element,
                });

                const attributes: Record<string, string> = {};
                for (const attribute of Array.from(element.attributes)) {
                    attributes[attribute.name] = attribute.value;
                }
                this.renderer?.addVectorLayerElement(
                    layer.id,
                    tagName,
                    attributes,
                );
            }

        });

    }

    protected dragEditControlPointStart(e: PointerTracker) {
        ({ viewTransformPoint: this.dragStartPoint } = this.getTransformedCursorInfo());

        const selectedAttachedEditControlPointIndices: number[] = [];
        const selectedEditControlAttachPointIndicesSet = new Set<number>();

        const referencedControlPointIndices = new Set<number>();
        for (const selectedIndex of selectedEditControlPointIndices.value) {
            const point = editControlPoints.value[selectedIndex];
            if (point.attachToIndex != null) {
                referencedControlPointIndices.add(point.attachToIndex);
            }
        }

        // This loops under the assumption attached indices always follow what they're attached to
        const firstCheckIndex = Math.min(
            editControlPoints.value[selectedEditControlPointIndices.value[0]].attachToIndex ?? Infinity,
            selectedEditControlPointIndices.value[0]
        );
        for (let i = firstCheckIndex + 1; i < editControlPoints.value.length; i++) {
            const point = editControlPoints.value[i];
            for (let selectedIndex of selectedEditControlPointIndices.value) {
                if (
                    point.attachToIndex === selectedIndex
                    && i !== selectedIndex
                ) {
                    selectedAttachedEditControlPointIndices.push(i);
                    selectedEditControlAttachPointIndicesSet.add(i);
                    break;
                }
            }
            if (point.attachToIndex != null && referencedControlPointIndices.has(point.attachToIndex)) {
                selectedEditControlAttachPointIndicesSet.add(i);
            }
        }

        selectedEditControlAttachPointIndices.value = Array.from(selectedEditControlAttachPointIndicesSet);

        this.draggingEditControlPointIndices = selectedEditControlPointIndices.value.slice();
        for (let pointIndex of selectedAttachedEditControlPointIndices) {
            this.draggingEditControlPointIndices.push(pointIndex);
        }

        for (const pointIndex of this.draggingEditControlPointIndices) {
            const point = editControlPoints.value[pointIndex];
            point.sx = point.x;
            point.sy = point.y;
        }

        const nodeIndices = selectedEditControlPointIndices.value.map((selectedIndex) => {
            const point = editControlPoints.value[selectedIndex];
            return point.nodeIndex;
        })

        let averageFillColor: RGBAColor | null = null;
        let averageStrokeColor: RGBAColor | null = null;
        for (const nodeIndex of nodeIndices) {
            let { fill, stroke } = editControlPointNodeParsedAttributes.value[nodeIndex];
            fill = fill ?? '#00000000';
            stroke = stroke ?? '#00000000';
            if (averageFillColor?.style !== fill) {
                if (averageFillColor) {
                    averageFillColor = hexToColor('#000000', 'rgba');
                } else {
                    averageFillColor = hexToColor(fill, 'rgba');
                }
            }
            if (averageStrokeColor?.style !== stroke) {
                if (averageStrokeColor) {
                    averageStrokeColor = hexToColor('#000000', 'rgba');
                } else {
                    averageStrokeColor = hexToColor(stroke, 'rgba');
                }
            }
        }
        if (averageFillColor != null) {
            fillColor.value = averageFillColor;
        }
        if (averageStrokeColor != null) {
            strokeColor.value = averageStrokeColor;
        }
    }

    onPointerMove(e: PointerEvent): void {
        super.onPointerMove(e);
        if (
            e.isPrimary
        ) {
            const pointer = this.pointers.filter((pointer) => pointer.id === e.pointerId)[0];

            if (pointer && (pointer.type !== 'touch' || this.multiTouchDownCount === 1) && pointer.down.button === 0 && pointer.isDragging) {
                if (this.draggingEditControlPointIndices.length > 0) {
                    this.dragEditControlPointMove(pointer);
                } else {
                    this.drawShapeMove(pointer);
                }
            } else {
                if (editControlPoints.value.length > 0) {
                    hoveringEditControlPointIndices.value = this.getEditControlPointIndicesAtPagePoint(e.pageX, e.pageY, undefined, true);
                } else {
                    hoveringEditControlPointIndices.value = [];
                }
            }

            this.handleCursorIcon();
        }
    }

    protected async drawShapeMove(e: PointerTracker) {

        if (this.drawingPointerId == null) {
            this.drawingPointerId = e.down.pointerId;
            await this.drawShapeStart(e);
        }

        if (!this.actionQueue.isIdle()) {
            return;
        }

        const { viewTransformPoint } = this.getTransformedCursorInfo();

        for (const drawingShape of this.drawingShapes) {
            const { layer, nodeXf, element } = drawingShape;
            const nodeId = element.getAttribute('data-ogr-id');
            if (nodeId == null) continue;

            const attributes: Record<string, string> = {};

            switch (element.tagName) {
                case 'rect':
                    const position1 = new DOMPoint(
                        this.dragStartPoint.x,
                        this.dragStartPoint.y,
                    ).matrixTransform(nodeXf);
                    const position2 = new DOMPoint(
                        viewTransformPoint.x,
                        viewTransformPoint.y,
                    ).matrixTransform(nodeXf);
                    const x = Math.min(position1.x, position2.x);
                    const y = Math.min(position1.y, position2.y);
                    attributes.x = `${x}`;
                    attributes.y = `${y}`;
                    attributes.width = `${Math.max(position1.x, position2.x) - x}`;
                    attributes.height = `${Math.max(position1.y, position2.y) - y}`;
                    element.setAttribute('x', attributes.x);
                    element.setAttribute('y', attributes.y);
                    element.setAttribute('width', attributes.width);
                    element.setAttribute('height', attributes.height);
                    break;
            }
            
            this.renderer?.updateVectorLayerAttributes(
                layer.id,
                nodeId,
                attributes,
            );
        }

    }

    protected dragEditControlPointMove(e: PointerTracker) {
        if (!this.renderer) return;

        const { viewTransformPoint } = this.getTransformedCursorInfo();

        for (const pointIndex of this.draggingEditControlPointIndices) {
            const point = editControlPoints.value[pointIndex];

            if ((point.xProp && point.yProp) || !selectedEditControlPointIndices.value.includes(pointIndex)) {
                point.x = point.sx! + (viewTransformPoint.x - this.dragStartPoint.x);
                point.y = point.sy! + (viewTransformPoint.y - this.dragStartPoint.y);
            } else {
                const layer = editingLayers.value[point.layerIndex];
                const viewBox = getViewBox(layer.data.sourceDocument);
                const viewBoxXf = layer.transform.scale(
                    layer.width / viewBox.width, layer.height / viewBox.height, 1.0,
                ).translateSelf(
                    viewBox.x, viewBox.y, 0.0,
                );

                const { transform } = editControlPointNodeParsedAttributes.value[point.nodeIndex];
                const nodeXf = viewBoxXf.multiply(transform);
                const inverseNodeXf = nodeXf.inverse();

                const referencePointXf = new DOMPoint(
                    point.sx!,
                    point.sy!
                ).matrixTransform(inverseNodeXf);
                const newPointXf = new DOMPoint(
                    point.sx! + (viewTransformPoint.x - this.dragStartPoint.x),
                    point.sy! + (viewTransformPoint.y - this.dragStartPoint.y),
                ).matrixTransform(inverseNodeXf);

                if (!point.xProp) {
                    newPointXf.x = referencePointXf.x;
                }
                if (!point.yProp) {
                    newPointXf.y = referencePointXf.y;
                }

                const newPoint = newPointXf.matrixTransform(nodeXf);
                point.x = newPoint.x;
                point.y = newPoint.y;
            }
        }

        editControlPointsDirty.value = true;

        this.pendingControlPointEdits = renderControlPointAttributeEdits(
            this.draggingEditControlPointIndices,
            this.renderer,
        );
    }

    async onPointerUpBeforePurge(e: PointerEvent): Promise<void> {
        super.onPointerUpBeforePurge(e);

        if (this.pointers.length == 1) {
            const pointer = this.pointers.filter((pointer) => pointer.id === e.pointerId)[0];

            if (pointer.isDragging) {
                if (this.draggingEditControlPointIndices.length > 0) {
                    this.dragEditControlPointEnd();
                } else {
                    this.drawEnd(e);
                }
            }

            this.draggingEditControlPointIndices = [];
        }

    }

    private async drawEnd(e: PointerEvent) {
        const pointer = this.pointers.filter((pointer) => pointer.id === this.drawingPointerId)[0];

        
        // this.editingControlPoint = null;
        this.drawingPointerId = null;
        this.hasCreatedLayer = false;
    }

    protected dragEditControlPointEnd() {
        if (this.pendingControlPointEdits.length === 0) return;
        const actions: UpdateVectorLayerAttributesAction[] = [];

        for (const edit of this.pendingControlPointEdits) {
            actions.push(new UpdateVectorLayerAttributesAction(
                edit.layerId,
                edit.nodeId,
                { ...edit.attributes },
                true,
            ));
        }

        historyStore.dispatch('runAction', {
            action: new BundleAction(
                'moveVectorLayerControlPoints',
                'action.moveVectorLayerControlPoints',
                actions,
            )
        });
    }

    private getEditControlPointIndicesAtPagePoint(x: number, y: number, excludeIndex?: number, isHover?: boolean) {
        const isTouch = this.pointers.filter((pointer) => pointer.down.isPrimary)[0]?.type === 'touch';

        const transform = canvasStore.get('transform');
        const decomposedTransform = canvasStore.get('decomposedTransform');
        const transformInverse = transform.inverse();
        const cursor = new DOMPoint(x * devicePixelRatio, y * devicePixelRatio).matrixTransform(transformInverse);

        const dragHandleRadius = isTouch ? this.dragHandleRadiusTouch : this.dragHandleRadius;

        let currentDistance = Infinity;
        let currentIsAttached = true;
        let currentIndices: number[] = [];

        for (const [pathPointIndex, pathPoint] of editControlPoints.value.entries()) {
            if (
                Math.abs(cursor.x - pathPoint.x) < dragHandleRadius * devicePixelRatio / decomposedTransform.scaleX &&
                Math.abs(cursor.y - pathPoint.y) < dragHandleRadius * devicePixelRatio / decomposedTransform.scaleY
            ) {
                const isAttached = pathPoint.attachToIndex != null;
                if (
                    pathPointIndex === excludeIndex
                    || (!currentIsAttached && isAttached)
                    || (
                        isAttached
                        && !selectedEditControlAttachPointIndices.value.includes(pathPointIndex)
                    )
                ) {
                    continue;
                } else {
                    const distance = pointDistance2d(cursor.x, cursor.y, pathPoint.x, pathPoint.y);
                    if (distance <= currentDistance + 0.00001) {
                        if (!isEqualApprox(distance, currentDistance, 0.00001)) {
                            currentIndices.length = 0;
                            currentDistance = distance;
                        }
                        currentIndices.push(pathPointIndex);
                        currentIsAttached = isAttached;
                    }
                    if (isHover) {
                        break;
                    }
                }
            }
        }
        return currentIndices;
    }

    private getSelectedEditControlPointLayerNodeMap() {
        const layerNodeMap = new Map<number, Set<string>>();
        for (const index of selectedEditControlPointIndices.value) {
            const point = editControlPoints.value[index];
            const layerId = editingLayers.value[point.layerIndex]?.id;
            if (layerId == null) continue;
            if (!layerNodeMap.has(layerId)) {
                layerNodeMap.set(layerId, new Set());
            }
            const nodeId = editControlPointNodes.value[point.nodeIndex].getAttribute('data-ogr-id');
            if (nodeId == null) continue;
            layerNodeMap.get(layerId)?.add(nodeId);
        }
        return layerNodeMap;
    }

    private async onFillColorChanged(color?: RGBAColor) {
        if (!color) return;
        if (selectedEditControlPointIndices.value.length > 0) {
            const layerNodeMap = this.getSelectedEditControlPointLayerNodeMap();

            const actions: UpdateVectorLayerAttributesAction[] = [];
            for (const [layerId, nodeIdSet] of layerNodeMap.entries()) {
                for (const nodeId of Array.from(nodeIdSet)) {
                    actions.push(new UpdateVectorLayerAttributesAction(
                        layerId,
                        nodeId,
                        {
                            fill: color.alpha > 0 ? color.style.slice(0, 7) : 'none',
                            'fill-opacity': `${color.alpha}`,
                        },
                    ));
                }
            }

            await historyStore.dispatch('runAction', {
                action: new BundleAction(
                    'updateShapeFillColor',
                    'action.updateShapeFillColor',
                    actions,
                )
            });
        }
    }

    private async onStrokeColorChanged(color?: RGBAColor) {
        if (!color) return;
        if (selectedEditControlPointIndices.value.length > 0) {
            const layerNodeMap = this.getSelectedEditControlPointLayerNodeMap();

            const actions: UpdateVectorLayerAttributesAction[] = [];
            for (const [layerId, nodeIdSet] of layerNodeMap.entries()) {
                for (const nodeId of Array.from(nodeIdSet)) {
                    actions.push(new UpdateVectorLayerAttributesAction(
                        layerId,
                        nodeId,
                        {
                            stroke: color.alpha > 0 ? color.style.slice(0, 7) : null,
                            'stroke-opacity': `${color.alpha}`,
                        },
                    ));
                }
            }

            await historyStore.dispatch('runAction', {
                action: new BundleAction(
                    'updateShapeFillColor',
                    'action.updateShapeFillColor',
                    actions,
                )
            });
        }
    }

    private onHistoryStep(event?: AppEmitterEvents['editor.history.step']) {
        if ([
            'sampleAction',
        ].includes(event?.action.id as string)) {
            this.updateToolbarFromEditingLayers();
        }
    }

    private updateToolbarFromEditingLayers() {
        if (editingLayers.value.length > 0) {
            
        }
    }

    private getTransformedCursorInfo(): { viewTransformPoint: DOMPoint } {
        const devicePixelRatio = window.devicePixelRatio || 1;
        const viewTransform = canvasStore.get('transform');
        const viewTransformPoint = new DOMPoint(this.lastCursorX * devicePixelRatio, this.lastCursorY * devicePixelRatio)
            .matrixTransform(viewTransform.inverse());
        return {
            viewTransformPoint,
        };
    }

    protected handleCursorIcon() {
        let newIcon = super.handleCursorIcon();
        if (!newIcon) {
            if (hoveringEditControlPointIndices.value.length > 0) {
                newIcon = 'grabbing';
            } else {
                newIcon = 'crosshair';
            }
        }
        canvasStore.set('cursor', newIcon);
        return newIcon;
    }
}
