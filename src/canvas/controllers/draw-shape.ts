import { nextTick, watch, WatchStopHandle } from 'vue';

import { type PointerTracker } from './base';
import BaseCanvasMovementController from './base-movement';
import {
    cursorHoverPosition,
    drawShapeToolbarEmitter, pixelSnap, isExtendingPaths,
    fillColor, strokeColor, strokeWidth, selectedShapeType,
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
    createHistoryReserveToken, historyBlockInteractionUntilComplete, historyReserveQueueFree,
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

const EPSILON = 1e-6;
const devicePixelRatio = window.devicePixelRatio || 1;

interface DrawingShape {
    layer: WorkingFileVectorLayer;
    nodeXf: DOMMatrix;
    element: Element;
}

interface ExtendPathInfo {
    layerId: number;
    tagName: string;
    nodeId: string;
    nodeXf: DOMMatrix;
    pathStart: string;
}

export default class CanvasDrawShapetController extends BaseCanvasMovementController {

    private selectedLayerIdsUnwatch: WatchStopHandle | null = null;

    private renderer: RendererFrontend | null = null;

    private selectedLayers: WorkingFileVectorLayer[] = [];
    
    private dragHandleRadius: number = 6;
    private dragHandleRadiusTouch: number = 10;
    private dragStartPoint: DOMPoint = new DOMPoint();
    private draggingEditControlPointIndices: number[] = [];
    private pendingControlPointEdits: ControlPointAttributeEdit[] = [];

    private drawingPointerId: number | null = null;
    private drawingShapes: DrawingShape[] = [];
    private drawingJustCreatedShapeLayer: boolean = false;
    private actionQueue: AsyncCallbackQueue = new AsyncCallbackQueue();

    private extendPathPointerId: number | null = null;
    private extendPathInfo: ExtendPathInfo[] = [];

    private uselessClickCount: number = 0;

    onEnter(): void {
        super.onEnter();

        useRenderer().then((renderer) => {
            this.renderer = renderer;
        });

        this.createEditingLayersFromSelectedLayers = this.createEditingLayersFromSelectedLayers.bind(this);
        this.selectedLayerIdsUnwatch = watch(
            () => workingFileStore.state.selectedLayerIds,
            this.createEditingLayersFromSelectedLayers,
            { immediate: true }
        );

        this.onFillColorChanged = this.onFillColorChanged.bind(this);
        drawShapeToolbarEmitter.on('fillColorChanged', this.onFillColorChanged);
        this.onStrokeColorChanged = this.onStrokeColorChanged.bind(this);
        drawShapeToolbarEmitter.on('strokeColorChanged', this.onStrokeColorChanged);
        this.onStrokeWidthPreview = this.onStrokeWidthPreview.bind(this);
        drawShapeToolbarEmitter.on('strokeWidthPreview', this.onStrokeWidthPreview);
        this.onStrokeWidthChanged = this.onStrokeWidthChanged.bind(this);
        drawShapeToolbarEmitter.on('strokeWidthChanged', this.onStrokeWidthChanged);

        this.onHistoryStep = this.onHistoryStep.bind(this);
        appEmitter.on('editor.history.step', this.onHistoryStep);
        this.onCancelCurrentAction = this.onCancelCurrentAction.bind(this);
        appEmitter.on('editor.tool.cancelCurrentAction', this.onCancelCurrentAction);

        cursorHoverPosition.value = new DOMPoint(
            -100000000000,
            -100000000000
        );

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
        drawShapeToolbarEmitter.off('strokeWidthPreview', this.onStrokeWidthPreview);
        drawShapeToolbarEmitter.off('strokeWidthChanged', this.onStrokeWidthChanged);

        appEmitter.off('editor.history.step', this.onHistoryStep);
        appEmitter.off('editor.tool.cancelCurrentAction', this.onCancelCurrentAction);

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

        if ((e.pointerType === 'pen' || !editorStore.state.isPenUser)) {
            cursorHoverPosition.value = new DOMPoint(
                this.lastCursorX * devicePixelRatio,
                this.lastCursorY * devicePixelRatio
            ).matrixTransform(canvasStore.state.transform.inverse());
        }

        const pointer = this.pointers.filter((pointer) => pointer.id === e.pointerId)[0];
        if (pointer && pointer.down.isPrimary && pointer.type !== 'touch' && pointer.down.button === 0) {
            const editControlPointIndices = this.getEditControlPointIndicesAtPagePoint(e.pageX, e.pageY);
            if (editControlPointIndices.length === 0) {
                if (this.isReadyForPathExtension()) {
                    isExtendingPaths.value = true;
                    this.extendPathStart(pointer);
                } else {
                    isExtendingPaths.value = false;
                    selectedEditControlPointIndices.value = [];
                    selectedEditControlAttachPointIndices.value = [];
                    ({ viewTransformPoint: this.dragStartPoint } = this.getTransformedCursorInfo());
                }
            } else {
                selectedEditControlPointIndices.value = editControlPointIndices;
                isExtendingPaths.value = this.isReadyForPathExtension();
                this.dragEditControlPointStart(pointer);
            }
        }
    }

    onMultiTouchDown() {
        super.onMultiTouchDown();
        if (this.touches.length === 1) {
            const editControlPointIndices = this.getEditControlPointIndicesAtPagePoint(this.touches[0].down.pageX, this.touches[0].down.pageY);
            if (editControlPointIndices.length === 0) {
                if (this.isReadyForPathExtension()) {
                    isExtendingPaths.value = true;
                    this.extendPathStart(this.touches[0]);
                } else {
                    isExtendingPaths.value = false;
                    selectedEditControlPointIndices.value = [];
                    selectedEditControlAttachPointIndices.value = [];
                    ({ viewTransformPoint: this.dragStartPoint } = this.getTransformedCursorInfo());
                }
            } else {
                selectedEditControlPointIndices.value = editControlPointIndices;
                isExtendingPaths.value = this.isReadyForPathExtension();
                this.dragEditControlPointStart(this.touches[0]);
            }
        }
    }

    protected async drawShapeStart(e: PointerTracker) {
        if (
            this.drawingPointerId == null
            || (fillColor.value.alpha <= 0 && strokeColor.value.alpha <= 0)
        ) return;

        this.uselessClickCount = 0;

        const startDrawReserveToken = createHistoryReserveToken();
        await historyStore.dispatch('reserve', { token: startDrawReserveToken });

        const { width, height } = workingFileStore.state;
        let selectedLayers = getSelectedLayers().filter(layer => layer.type === 'vector' || layer.type === 'empty');
        let layerActions: BaseAction[] = [];

        const newSvgString = `<svg width="${Math.round(width)}" height="${Math.round(height)}" xmlns="http://www.w3.org/2000/svg"></svg>`;

        // Insert vector layer if none selected
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
                            sourceUuid: await createStoredSvg(
                                await new Promise<HTMLImageElement>((resolve) => {
                                    const image = new Image();
                                    image.onload = () => {
                                        resolve(image);
                                    };
                                    image.onerror = () => {
                                        resolve(image);
                                    }
                                    image.src = URL.createObjectURL(new Blob([newSvgString], { type: 'image/svg+xml' }));
                                }),
                            ),
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
            this.drawingJustCreatedShapeLayer = false;
            if (layerActions.length > 0) {
                try {
                    await historyStore.dispatch('runAction', {
                        action: new BundleAction('createShapeLayer', 'action.createShapeLayer', layerActions),
                        reserveToken: startDrawReserveToken,
                    });
                    this.drawingJustCreatedShapeLayer = true;
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
                if (!layer.data.sourceDocument?.documentElement) {
                    layer.data.sourceDocument = await getStoredSvgDocument(layer.data.sourceUuid);
                }
                const layerDocument = layer.data.sourceDocument;

                let element: Element | null = null;
                const tagName = {
                    rectangle: 'rect',
                    circle: 'circle',
                    ellipse: 'ellipse',
                    line: 'line',
                    polyline: 'polyline',
                    polygon: 'polygon',
                    path: 'path',
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
                    case 'rect': {
                        const position1 = new DOMPoint(
                            this.dragStartPoint.x,
                            this.dragStartPoint.y,
                        ).matrixTransform(nodeXf);
                        const position2 = new DOMPoint(
                            viewTransformPoint.x,
                            viewTransformPoint.y,
                        ).matrixTransform(nodeXf);
                        let x = Math.min(position1.x, position2.x);
                        let y = Math.min(position1.y, position2.y);
                        if (pixelSnap.value) {
                            x = Math.round(x);
                            y = Math.round(y);
                        }
                        let width = Math.max(position1.x, position2.x) - x;
                        let height = Math.max(position1.y, position2.y) - y;
                        if (pixelSnap.value) {
                            width = Math.round(width);
                            height = Math.round(height);
                        }
                        element.setAttribute('x', `${x}`);
                        element.setAttribute('y', `${y}`);
                        element.setAttribute('width', `${width}`);
                        element.setAttribute('height', `${height}`);
                        break;
                    }
                    case 'circle': {
                        const position1 = new DOMPoint(
                            this.dragStartPoint.x,
                            this.dragStartPoint.y,
                        ).matrixTransform(nodeXf);
                        const position2 = new DOMPoint(
                            viewTransformPoint.x,
                            viewTransformPoint.y,
                        ).matrixTransform(nodeXf);
                        if (pixelSnap.value) {
                            position1.x = Math.round(position1.x);
                            position1.y = Math.round(position1.y);
                            position2.x = Math.round(position2.x);
                            position2.y = Math.round(position2.y);
                        }
                        let radius = pointDistance2d(position1.x, position1.y, position2.x, position2.y);
                        let x = position1.x;
                        let y = position1.y;
                        if (pixelSnap.value) {
                            radius = Math.max(1, Math.round(radius));
                        } else {
                            radius = Math.max(EPSILON, radius);
                        }
                        element.setAttribute('cx', `${x}`);
                        element.setAttribute('cy', `${y}`);
                        element.setAttribute('r', `${radius}`);
                        break;
                    }
                    case 'ellipse': {
                        const position1 = new DOMPoint(
                            this.dragStartPoint.x,
                            this.dragStartPoint.y,
                        ).matrixTransform(nodeXf);
                        const position2 = new DOMPoint(
                            viewTransformPoint.x,
                            viewTransformPoint.y,
                        ).matrixTransform(nodeXf);
                        if (pixelSnap.value) {
                            position1.x = Math.round(position1.x);
                            position1.y = Math.round(position1.y);
                            position2.x = Math.round(position2.x);
                            position2.y = Math.round(position2.y);
                        }
                        let x = (position1.x + position2.x) / 2;
                        let y = (position1.y + position2.y) / 2;
                        let rx = Math.abs(position1.x - position2.x) / 2;
                        let ry = Math.abs(position1.y - position2.y) / 2;
                        if (pixelSnap.value) {
                            rx = Math.max(1, rx);
                            ry = Math.max(1, ry);
                        } else {
                            rx = Math.max(EPSILON, rx);
                            ry = Math.max(EPSILON, ry);
                        }
                        element.setAttribute('cx', `${x}`);
                        element.setAttribute('cy', `${y}`);
                        element.setAttribute('rx', `${rx}`);
                        element.setAttribute('ry', `${ry}`);
                        break;
                    }
                    case 'line': {
                        const position1 = new DOMPoint(
                            this.dragStartPoint.x,
                            this.dragStartPoint.y,
                        ).matrixTransform(nodeXf);
                        const position2 = new DOMPoint(
                            viewTransformPoint.x,
                            viewTransformPoint.y,
                        ).matrixTransform(nodeXf);
                        if (pixelSnap.value) {
                            position1.x = Math.round(position1.x);
                            position1.y = Math.round(position1.y);
                            position2.x = Math.round(position2.x);
                            position2.y = Math.round(position2.y);
                        }
                        element.setAttribute('x1', `${position1.x}`);
                        element.setAttribute('y1', `${position1.y}`);
                        element.setAttribute('x2', `${position2.x}`);
                        element.setAttribute('y2', `${position2.y}`);
                        break;
                    }
                    case 'polyline': {
                        const position1 = new DOMPoint(
                            this.dragStartPoint.x,
                            this.dragStartPoint.y,
                        ).matrixTransform(nodeXf);
                        const position2 = new DOMPoint(
                            viewTransformPoint.x,
                            viewTransformPoint.y,
                        ).matrixTransform(nodeXf);
                        if (pixelSnap.value) {
                            position1.x = Math.round(position1.x);
                            position1.y = Math.round(position1.y);
                            position2.x = Math.round(position2.x);
                            position2.y = Math.round(position2.y);
                        }
                        element.setAttribute('points', `${position1.x},${position1.y} ${position2.x},${position2.y}`);
                        break;
                    }
                    case 'polygon': {
                        const position1 = new DOMPoint(
                            this.dragStartPoint.x,
                            this.dragStartPoint.y,
                        ).matrixTransform(nodeXf);
                        const position2 = new DOMPoint(
                            viewTransformPoint.x,
                            viewTransformPoint.y,
                        ).matrixTransform(nodeXf);
                        if (pixelSnap.value) {
                            position1.x = Math.round(position1.x);
                            position1.y = Math.round(position1.y);
                            position2.x = Math.round(position2.x);
                            position2.y = Math.round(position2.y);
                        }
                        element.setAttribute('points', `${position1.x},${position1.y} ${position2.x},${position2.y}`);
                        break;
                    }
                }
                element.setAttribute('fill', fillColor.value.alpha > 0 ? fillColor.value.style.slice(0, 7) : 'none');
                element.setAttribute('fill-opacity', `${fillColor.value.alpha}`);
                if (strokeColor.value.alpha > 0) {
                    element.setAttribute('stroke', strokeColor.value.style.slice(0, 7));
                    element.setAttribute('stroke-opacity', `${strokeColor.value.alpha}`);
                    element.setAttribute('stroke-width', `${strokeWidth.value}`);
                }

                layerDocument.documentElement.append(element);
                generateSvgElementIds(layerDocument);
                element.remove();

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

    protected extendPathStart(e: PointerTracker) {
        if (this.extendPathPointerId != null) return;

        this.uselessClickCount = 0;

        this.extendPathPointerId = e.down.pointerId;
        this.extendPathInfo = [];

        const { viewTransformPoint } = this.getTransformedCursorInfo();

        for (const selectedPointIndex of selectedEditControlPointIndices.value) {
            const point = editControlPoints.value[selectedPointIndex];
            const layer = editingLayers.value[point.layerIndex];
            const node = editControlPointNodes.value[point.nodeIndex];
            const nodeId = node.getAttribute('data-ogr-id');
            if (!nodeId) continue;
            let pathStart = node.getAttribute('d') ?? node.getAttribute('points');
            if (pathStart == null) continue;
            const layerDocument = layer.data.sourceDocument;
            if (!layerDocument) continue;

            const viewBox = getViewBox(layer.data.sourceDocument);
            const transform  = parseNodeTransform(layerDocument.documentElement);
            const nodeXf = layer.transform.scale(
                layer.width / viewBox.width, layer.height / viewBox.height, 1.0,
            ).translateSelf(
                viewBox.x, viewBox.y, 0.0,
            ).multiplySelf(
                transform,
            ).invertSelf();

            this.extendPathInfo.push({
                layerId: layer.id,
                tagName: node.tagName,
                nodeId,
                nodeXf,
                pathStart,
            });

            const attributes: Record<string, string> = {};

            switch (node.tagName) {
                case 'polyline': case 'polygon':
                    const newPoint = new DOMPoint(
                        viewTransformPoint.x,
                        viewTransformPoint.y,
                    ).matrixTransform(nodeXf);
                    if (pixelSnap.value) {
                        newPoint.x = Math.round(newPoint.x);
                        newPoint.y = Math.round(newPoint.y);
                    }
                    attributes['points'] = `${pathStart} ${newPoint.x},${newPoint.y}`;
                    break;
                case 'path':
                    break;
            }

            this.renderer?.updateVectorLayerAttributes(
                layer.id,
                nodeId,
                attributes,
            );
        }
    }

    protected dragEditControlPointStart(e: PointerTracker) {
        ({ viewTransformPoint: this.dragStartPoint } = this.getTransformedCursorInfo());

        this.uselessClickCount = 0;

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
        let averageStrokeWidth: number | null = null;
        for (const nodeIndex of nodeIndices) {
            let { fill, stroke, strokeWidth } = editControlPointNodeParsedAttributes.value[nodeIndex];
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
            if (averageStrokeWidth !== strokeWidth) {
                if (averageStrokeWidth != null) {
                    averageStrokeWidth = 1;
                } else {
                    averageStrokeWidth = strokeWidth;
                }
            }
        }
        if (averageFillColor != null) {
            fillColor.value = averageFillColor;
        }
        if (averageStrokeColor != null) {
            strokeColor.value = averageStrokeColor;
        }
        if (averageStrokeWidth != null) {
            strokeWidth.value = averageStrokeWidth;
        }
    }

    onPointerMove(e: PointerEvent): void {
        super.onPointerMove(e);

        if (e.pointerType === 'pen' || !editorStore.state.isPenUser) {
            cursorHoverPosition.value = new DOMPoint(
                this.lastCursorX * devicePixelRatio,
                this.lastCursorY * devicePixelRatio
            ).matrixTransform(canvasStore.state.transform.inverse());
        }

        if (
            e.isPrimary
        ) {
            const pointer = this.pointers.filter((pointer) => pointer.id === e.pointerId)[0];

            if (pointer && (pointer.type !== 'touch' || this.multiTouchDownCount === 1) && pointer.down.button === 0 && pointer.isDragging) {
                if (this.draggingEditControlPointIndices.length > 0) {
                    this.dragEditControlPointMove(pointer);
                } else if (isExtendingPaths.value) {
                    this.extendPathMove(pointer);
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
                case 'rect': {
                    const position1 = new DOMPoint(
                        this.dragStartPoint.x,
                        this.dragStartPoint.y,
                    ).matrixTransform(nodeXf);
                    const position2 = new DOMPoint(
                        viewTransformPoint.x,
                        viewTransformPoint.y,
                    ).matrixTransform(nodeXf);
                    let x = Math.min(position1.x, position2.x);
                    let y = Math.min(position1.y, position2.y);
                    if (pixelSnap.value) {
                        x = Math.round(x);
                        y = Math.round(y);
                    }
                    let width = Math.max(position1.x, position2.x) - x;
                    let height = Math.max(position1.y, position2.y) - y;
                    if (pixelSnap.value) {
                        width = Math.round(width);
                        height = Math.round(height);
                    }
                    attributes.x = `${x}`;
                    attributes.y = `${y}`;
                    attributes.width = `${width}`;
                    attributes.height = `${height}`;
                    element.setAttribute('x', attributes.x);
                    element.setAttribute('y', attributes.y);
                    element.setAttribute('width', attributes.width);
                    element.setAttribute('height', attributes.height);
                    break;
                }
                case 'circle': {
                    const position1 = new DOMPoint(
                        this.dragStartPoint.x,
                        this.dragStartPoint.y,
                    ).matrixTransform(nodeXf);
                    const position2 = new DOMPoint(
                        viewTransformPoint.x,
                        viewTransformPoint.y,
                    ).matrixTransform(nodeXf);
                    if (pixelSnap.value) {
                        position1.x = Math.round(position1.x);
                        position1.y = Math.round(position1.y);
                        position2.x = Math.round(position2.x);
                        position2.y = Math.round(position2.y);
                    }
                    let radius = pointDistance2d(position1.x, position1.y, position2.x, position2.y);
                    let x = position1.x;
                    let y = position1.y;
                    if (pixelSnap.value) {
                        radius = Math.max(1, Math.round(radius));
                    } else {
                        radius = Math.max(EPSILON, radius);
                    }
                    attributes.cx = `${x}`;
                    attributes.cy = `${y}`;
                    attributes.r = `${radius}`;
                    element.setAttribute('cx', attributes.cx);
                    element.setAttribute('cy', attributes.cy);
                    element.setAttribute('r', attributes.r);
                    break;
                }
                case 'ellipse': {
                    const position1 = new DOMPoint(
                        this.dragStartPoint.x,
                        this.dragStartPoint.y,
                    ).matrixTransform(nodeXf);
                    const position2 = new DOMPoint(
                        viewTransformPoint.x,
                        viewTransformPoint.y,
                    ).matrixTransform(nodeXf);
                    if (pixelSnap.value) {
                        position1.x = Math.round(position1.x);
                        position1.y = Math.round(position1.y);
                        position2.x = Math.round(position2.x);
                        position2.y = Math.round(position2.y);
                    }
                    let x = (position1.x + position2.x) / 2;
                    let y = (position1.y + position2.y) / 2;
                    let rx = Math.abs(position1.x - position2.x) / 2;
                    let ry = Math.abs(position1.y - position2.y) / 2;
                    if (pixelSnap.value) {
                        rx = Math.max(1, rx);
                        ry = Math.max(1, ry);
                    } else {
                        rx = Math.max(EPSILON, rx);
                        ry = Math.max(EPSILON, ry);
                    }
                    attributes.cx = `${x}`;
                    attributes.cy = `${y}`;
                    attributes.rx = `${rx}`;
                    attributes.ry = `${ry}`;
                    element.setAttribute('cx', attributes.cx);
                    element.setAttribute('cy', attributes.cy);
                    element.setAttribute('rx', attributes.rx);
                    element.setAttribute('ry', attributes.ry);
                    break;
                }
                case 'line': {
                    const position1 = new DOMPoint(
                        this.dragStartPoint.x,
                        this.dragStartPoint.y,
                    ).matrixTransform(nodeXf);
                    const position2 = new DOMPoint(
                        viewTransformPoint.x,
                        viewTransformPoint.y,
                    ).matrixTransform(nodeXf);
                    if (pixelSnap.value) {
                        position1.x = Math.round(position1.x);
                        position1.y = Math.round(position1.y);
                        position2.x = Math.round(position2.x);
                        position2.y = Math.round(position2.y);
                    }
                    attributes.x1 = `${position1.x}`;
                    attributes.y1 = `${position1.y}`;
                    attributes.x2 = `${position2.x}`;
                    attributes.y2 = `${position2.y}`;
                    element.setAttribute('x1', attributes.x1);
                    element.setAttribute('y1', attributes.y1);
                    element.setAttribute('x2', attributes.x2);
                    element.setAttribute('y2', attributes.y2);
                    break;
                }
                case 'polyline': {
                    const position1 = new DOMPoint(
                        this.dragStartPoint.x,
                        this.dragStartPoint.y,
                    ).matrixTransform(nodeXf);
                    const position2 = new DOMPoint(
                        viewTransformPoint.x,
                        viewTransformPoint.y,
                    ).matrixTransform(nodeXf);
                    if (pixelSnap.value) {
                        position1.x = Math.round(position1.x);
                        position1.y = Math.round(position1.y);
                        position2.x = Math.round(position2.x);
                        position2.y = Math.round(position2.y);
                    }
                    attributes.points = `${position1.x},${position1.y} ${position2.x},${position2.y}`;
                    element.setAttribute('points', attributes.points);
                    break;
                }
                case 'polygon': {
                    const position1 = new DOMPoint(
                        this.dragStartPoint.x,
                        this.dragStartPoint.y,
                    ).matrixTransform(nodeXf);
                    const position2 = new DOMPoint(
                        viewTransformPoint.x,
                        viewTransformPoint.y,
                    ).matrixTransform(nodeXf);
                    if (pixelSnap.value) {
                        position1.x = Math.round(position1.x);
                        position1.y = Math.round(position1.y);
                        position2.x = Math.round(position2.x);
                        position2.y = Math.round(position2.y);
                    }
                    attributes.points = `${position1.x},${position1.y} ${position2.x},${position2.y}`;
                    element.setAttribute('points', attributes.points);
                    break;
                }
            }
            
            this.renderer?.updateVectorLayerAttributes(
                layer.id,
                nodeId,
                attributes,
            );
        }

    }

    protected async extendPathMove(e: PointerTracker) {
        if (e.down.pointerId !== this.extendPathPointerId) return;

        const { viewTransformPoint } = this.getTransformedCursorInfo();

        for (const { layerId, tagName, nodeId, nodeXf, pathStart } of this.extendPathInfo) {
            const attributes: Record<string, string> = {};

            switch (tagName) {
                case 'polyline': case 'polygon':
                    const newPoint = new DOMPoint(
                        viewTransformPoint.x,
                        viewTransformPoint.y,
                    ).matrixTransform(nodeXf);
                    if (pixelSnap.value) {
                        newPoint.x = Math.round(newPoint.x);
                        newPoint.y = Math.round(newPoint.y);
                    }
                    attributes['points'] = `${pathStart} ${newPoint.x},${newPoint.y}`;
                    break;
                case 'path':
                    break;
            }

            this.renderer?.updateVectorLayerAttributes(
                layerId,
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

        if (this.extendPathPointerId != null && this.extendPathPointerId == e.pointerId && isExtendingPaths.value) {
            this.extendPathEnd(e);
        } else if (this.drawingPointerId != null && this.drawingPointerId == e.pointerId) {
            this.drawShapeEnd(e);
        } else if (this.pointers.length == 1 && this.draggingEditControlPointIndices.length) {
            const pointer = this.pointers.filter((pointer) => pointer.id === e.pointerId)[0];

            if (pointer.isDragging) {
                this.dragEditControlPointEnd();
            }

            this.draggingEditControlPointIndices = [];
        } else if (this.pointers.length === 1 && e.isPrimary && e.button === 0) {
            this.uselessClickCount++;
        }

        if (this.pointers.length === 1 && this.uselessClickCount >= 3) {
            this.uselessClickCount = 0;
            appEmitter.emit('app.notify', {
                type: 'info',
                title: t('toolbar.drawShape.notification.uselessClick.title'),
                message: t('toolbar.drawShape.notification.uselessClick.message.' + (editorStore.get('isTouchUser') ? 'touch' : 'mouse')),
                duration: 5000,
            });
        }

    }

    private async drawShapeEnd(e: PointerEvent) {
        
        if (this.drawingShapes.length > 0) {
            await this.actionQueue.wait();

            const updateLayerReserveToken = createHistoryReserveToken();
            await historyReserveQueueFree();
            await historyStore.dispatch('reserve', { token: updateLayerReserveToken });

            const serializer = new XMLSerializer();

            try {
                const layerActions: BaseAction[] = [];

                for (const drawingShape of this.drawingShapes) {
                    const { layer, element } = drawingShape;

                    const layerDocument = await getStoredSvgDocument(layer.data.sourceUuid);
                    const newLayerDocument = layerDocument.cloneNode(true) as Document;
                    newLayerDocument.documentElement.append(element);
                    element.removeAttribute('xmlns');
                    generateSvgElementIds(newLayerDocument);
                    const svgString = serializer.serializeToString(newLayerDocument).replace(/xmlns=""/g, '');

                    const image = await new Promise<HTMLImageElement>((resolve) => {
                        const image = new Image();
                        image.onload = () => {
                            resolve(image);
                        };
                        image.onerror = () => {
                            resolve(image);
                        }
                        image.src = URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml' }));
                    });

                    layerActions.push(new UpdateLayerAction<UpdateVectorLayerOptions>(
                        {
                            id: layer.id,
                            data: {
                                sourceUuid: await createStoredSvg(image),
                            },
                        },
                    ));
                }

                // Intentionally placed here - reference createEditingLayersFromSelectedLayers() calls.
                this.drawingPointerId = null;

                await historyStore.dispatch('runAction', {
                    action: new BundleAction('createShape', 'action.createShape', layerActions),
                    reserveToken: updateLayerReserveToken,
                    mergeWithHistory: this.drawingJustCreatedShapeLayer ? ['createShapeLayer'] : undefined,
                });

                const tagName = this.drawingShapes[0]?.element.tagName;
                this.selectExtendPathNodes(tagName, this.drawingShapes);

            } catch (error) {
                console.error('[src/canvas/controllers/draw-shape.ts] Error when creating shape layer updates ', error);
                await historyStore.dispatch('unreserve', { token: updateLayerReserveToken });
            }
        }
        
        this.drawingPointerId = null;
        this.drawingShapes = [];
    }

    private async extendPathEnd(e: PointerEvent) {
        const { viewTransformPoint } = this.getTransformedCursorInfo();

        const actions: UpdateVectorLayerAttributesAction[] = [];

        let tagName = this.extendPathInfo[0]?.tagName;
        for (const { layerId, tagName, nodeId, nodeXf, pathStart } of this.extendPathInfo) {
            const attributes: Record<string, string> = {};

            switch (tagName) {
                case 'polyline': case 'polygon':
                    const newPoint = new DOMPoint(
                        viewTransformPoint.x,
                        viewTransformPoint.y,
                    ).matrixTransform(nodeXf);
                    if (pixelSnap.value) {
                        newPoint.x = Math.round(newPoint.x);
                        newPoint.y = Math.round(newPoint.y);
                    }
                    attributes['points'] = `${pathStart} ${newPoint.x},${newPoint.y}`;
                    break;
                case 'path':
                    break;
            }

            actions.push(new UpdateVectorLayerAttributesAction(
                layerId,
                nodeId,
                attributes,
                true,
            ));
        }

        this.extendPathPointerId = null;
        
        await historyStore.dispatch('runAction', {
            action: new BundleAction(
                'moveVectorLayerControlPoints',
                'action.moveVectorLayerControlPoints',
                actions,
            )
        });

        this.selectExtendPathNodes(tagName, undefined, this.extendPathInfo);

        this.extendPathInfo = [];
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

    private onStrokeWidthPreview(newStrokeWidth?: number) {
        if (newStrokeWidth == null) return;
        if (selectedEditControlPointIndices.value.length > 0) {
            const layerNodeMap = this.getSelectedEditControlPointLayerNodeMap();

            for (const [layerId, nodeIdSet] of layerNodeMap.entries()) {
                for (const nodeId of Array.from(nodeIdSet)) {
                    this.renderer?.updateVectorLayerAttributes(
                        layerId,
                        nodeId,
                        { 'stroke-width': `${newStrokeWidth}` },
                    )
                }
            }
        }
    }

    private async onStrokeWidthChanged(newStrokeWidth?: number) {
        if (newStrokeWidth == null) return;
        if (selectedEditControlPointIndices.value.length > 0) {
            const layerNodeMap = this.getSelectedEditControlPointLayerNodeMap();

            const actions: UpdateVectorLayerAttributesAction[] = [];
            for (const [layerId, nodeIdSet] of layerNodeMap.entries()) {
                for (const nodeId of Array.from(nodeIdSet)) {
                    actions.push(new UpdateVectorLayerAttributesAction(
                        layerId,
                        nodeId,
                        { 'stroke-width': `${newStrokeWidth}` },
                    ));
                }
            }

            await historyStore.dispatch('runAction', {
                action: new BundleAction(
                    'updateShapeStrokeWidth',
                    'action.updateShapeStrokeWidth',
                    actions,
                )
            });
        }
    }

    private onHistoryStep(event?: AppEmitterEvents['editor.history.step']) {
        if (!event) return;
        if (
            event.action.id === 'createShape'
            || (event.action.id === 'createShapeLayer' && event.trigger !== 'do')
        ) {
            this.createEditingLayersFromSelectedLayers(workingFileStore.state.selectedLayerIds, workingFileStore.state.selectedLayerIds);
        }
    }

    private onCancelCurrentAction() {
        if (this.drawingPointerId != null) {
            // TODO
        } else if (this.extendPathPointerId != null) {
            for (const { layerId, tagName, nodeId, pathStart } of this.extendPathInfo) {
                const attributes: Record<string, string> = {};
                switch (tagName) {
                    case 'polyline': case 'polygon':
                        attributes['points'] = pathStart;
                        break;
                    case 'path':
                        attributes['path'] = pathStart;
                        break;
                }
                this.renderer?.updateVectorLayerAttributes(
                    layerId,
                    nodeId,
                    attributes,
                );
            }
            this.extendPathInfo = [];
            this.extendPathPointerId = null;
            selectedEditControlPointIndices.value = [];
            selectedEditControlAttachPointIndices.value = [];
            isExtendingPaths.value = false;
        } else if (selectedEditControlPointIndices.value.length > 0) {
            selectedEditControlPointIndices.value = [];
            selectedEditControlAttachPointIndices.value = [];
            isExtendingPaths.value = false;
        }
    }

    private isReadyForPathExtension(): boolean {
        let tagName: string | null = null;
        let maxPathIndices = new Map<string, number>();
        for (let point of editControlPoints.value) {
            const mapEntry = maxPathIndices.get(`${point.layerIndex}_${point.nodeIndex}`);
            if (
                (!mapEntry || point.pathIndex > mapEntry)
                && point.attachToIndex == null
            ) {
                maxPathIndices.set(`${point.layerIndex}_${point.nodeIndex}`, point.pathIndex);
            }
        }
        if (selectedEditControlPointIndices.value.length === 0) return false;
        for (let selectedIndex of selectedEditControlPointIndices.value) {
            const { layerIndex, nodeIndex, pathIndex } = editControlPoints.value[selectedIndex];
            const node = editControlPointNodes.value[nodeIndex];
            if (tagName == null) {
                tagName = node.tagName;
            } else if (tagName !== node.tagName) {
                return false;
            }
            const maxIndex = maxPathIndices.get(`${layerIndex}_${nodeIndex}`);
            if (pathIndex !== maxIndex) return false;
        }
        return ['polyline', 'polygon', 'path'].includes(tagName!);
    }

    private selectExtendPathNodes(
        tagName: string,
        drawingShapes: DrawingShape[] = [],
        extendPathInfo: ExtendPathInfo[] = []
    ) {
        if (['polyline', 'polygon', 'path'].includes(tagName)) {
            const unwatch = watch(() => editControlPoints.value, () => {
                unwatch();

                const greatestIndices = new Map<string, { pointIndex: number, pathIndex: number }>();

                for (const [pointIndex, { layerIndex, nodeIndex, pathIndex, attachToIndex }] of editControlPoints.value.entries()) {
                    const pointLayer = editingLayers.value[layerIndex];
                    const pointNode = editControlPointNodes.value[nodeIndex];
                    const pointNodeId = pointNode.getAttribute('data-ogr-id');

                    for (const { layer, element } of drawingShapes) {
                        if (pointLayer.id !== layer.id) continue;
                        const elementId = element.getAttribute('data-ogr-id');
                        if (pointNodeId !== elementId) continue;
                        const currentGreatestIndex = greatestIndices.get(`${layer.id}_${elementId}`);
                        if (
                            (!currentGreatestIndex || currentGreatestIndex.pathIndex < pathIndex)
                            && attachToIndex == null
                        ) {
                            greatestIndices.set(`${layer.id}_${elementId}`, {
                                pointIndex,
                                pathIndex,
                            });
                        }
                    }

                    for (const { layerId, nodeId } of extendPathInfo) {
                        if (pointLayer.id !== layerId) continue;
                        if (pointNodeId !== nodeId) continue;
                        const currentGreatestIndex = greatestIndices.get(`${layerId}_${nodeId}`);
                        if (
                            (!currentGreatestIndex || currentGreatestIndex.pathIndex < pathIndex)
                            && attachToIndex == null
                        ) {
                            greatestIndices.set(`${layerId}_${nodeId}`, {
                                pointIndex,
                                pathIndex,
                            });
                        }
                    }
                }

                selectedEditControlPointIndices.value = [];
                selectedEditControlAttachPointIndices.value = [];
                for (const { pointIndex } of greatestIndices.values()) {
                    selectedEditControlPointIndices.value.push(pointIndex);
                }
                if (selectedEditControlPointIndices.value.length > 0) {
                    isExtendingPaths.value = true;
                }
            });
        }
    }

    private createEditingLayersFromSelectedLayers(newIds: number[], oldIds?: number[]) {
        if (this.drawingPointerId != null) return;
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
