import { nextTick, watch, WatchStopHandle } from 'vue';

import type { PointerTracker } from './base';
import BaseCanvasMovementController from './base-movement';
import {
    drawShapeToolbarEmitter,
    fillColor, strokeColor,
    editControlPoints, editControlPointsDirty, hoveringEditControlPointIndices,
    selectedEditControlPointIndices, selectedEditControlAttachPointIndices,
    editControlPointNodes, renderControlPointAttributeEdits, editControlPointNodeParsedAttributes,
    editingLayers, hasVisibleToolbarOverlay, showShapeDrawer,
    type ControlPointAttributeEdit,
} from '@/canvas/store/draw-shape-state';

import { hexToColor } from '@/lib/color';
import appEmitter, { type AppEmitterEvents } from '@/lib/emitter';
import { isEqualApprox, pointDistance2d } from '@/lib/math';
import { getViewBox } from '@/lib/svg';
import { dismissTutorialNotification, scheduleTutorialNotification, waitForNoOverlays } from '@/lib/tutorial';
import { t, tm, rt } from '@/i18n';

import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import historyStore, { historyBlockInteractionUntilComplete } from '@/store/history';
import { getStoredSvgDocument } from '@/store/svg';
import workingFileStore, { getSelectedLayers, getLayerGlobalTransform, ensureUniqueLayerSiblingName, getLayerById } from '@/store/working-file';

import { BundleAction } from '@/actions/bundle';
import { UpdateVectorLayerAttributesAction } from '@/actions/update-vector-layer-attributes';

import { useRenderer } from '@/renderers';

import type {
    RendererFrontend, RGBAColor,
    WorkingFileVectorLayer, WorkingFileAnyLayer
} from '@/types';

const devicePixelRatio = window.devicePixelRatio || 1;

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

    // private editingLayersStartData: Array<WorkingFileVectorLayer['data']> | null = null;

    private drawingPointerId: number | null = null;

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
                if (this.drawingPointerId == null) {
                    this.drawingPointerId = e.pointerId;
                    this.drawShapeStart(pointer)
                }
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
                if (this.drawingPointerId == null) {
                    this.drawingPointerId = this.touches[0].down.pointerId;
                    this.drawShapeStart(this.touches[0])
                }
            } else {
                selectedEditControlPointIndices.value = editControlPointIndices;
                this.dragEditControlPointStart(this.touches[0]);
            }
        }
    }

    protected async drawShapeStart(e: PointerTracker) {
        if (this.drawingPointerId == null) return;
        const pointer = this.pointers.filter((pointer) => pointer.id === this.drawingPointerId)[0];
        if (!pointer) return;

        const { viewTransformPoint: start } = this.getTransformedCursorInfo();
        let selectedLayers = getSelectedLayers().filter(layer => layer.type === 'vector' || layer.type === 'empty');

        await nextTick();

        selectedLayers = getSelectedLayers().filter(layer => layer.type === 'vector');
        if (selectedLayers.length > 0) {
            editingLayers.value = [selectedLayers[0] as WorkingFileVectorLayer];
        } else {
            editingLayers.value = [];
        }

        this.updateToolbarFromEditingLayers();
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
                    // TODO - creating shape?
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

            if (this.draggingEditControlPointIndices.length > 0 && pointer.isDragging) {
                this.dragEditControlPointEnd();
            } else {
                this.drawEnd(e);
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
