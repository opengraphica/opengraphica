import { nextTick, watch, WatchStopHandle } from 'vue';

import type { PointerTracker } from './base';
import BaseCanvasMovementController from './base-movement';
import {
    editControlPoints, editControlPointsDirty, hoveringEditControlPointIndices, selectedEditControlPointIndices,
    editControlPointNodes, renderControlPointAttributeEdits,
    editingLayers, hasVisibleToolbarOverlay, showShapeDrawer,
} from '@/canvas/store/draw-shape-state';

import appEmitter, { type AppEmitterEvents } from '@/lib/emitter';
import { isEqualApprox, pointDistance2d } from '@/lib/math';
import { dismissTutorialNotification, scheduleTutorialNotification, waitForNoOverlays } from '@/lib/tutorial';
import { t, tm, rt } from '@/i18n';

import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import historyStore, { historyBlockInteractionUntilComplete } from '@/store/history';
import { getStoredSvgDocument } from '@/store/svg';
import workingFileStore, { getSelectedLayers, getLayerGlobalTransform, ensureUniqueLayerSiblingName } from '@/store/working-file';

import { useRenderer } from '@/renderers';

import type {
    RendererFrontend,
    WorkingFileVectorLayer, WorkingFileAnyLayer
} from '@/types';

const devicePixelRatio = window.devicePixelRatio || 1;

export default class CanvasDrawShapetController extends BaseCanvasMovementController {

    private selectedLayerIdsUnwatch: WatchStopHandle | null = null;

    private renderer: RendererFrontend | null = null;

    private hasCreatedLayer: boolean = false;
    private selectedLayers: WorkingFileVectorLayer[] = [];
    private selectedAttachedEditControlPointIndices: number[] = [];
    
    private dragHandleRadius: number = 6;
    private dragHandleRadiusTouch: number = 10;
    private dragStartPoint: DOMPoint = new DOMPoint();
    private draggingEditControlPointIndices: number[] = [];

    // private editingLayersStartData: Array<WorkingFileVectorLayer['data']> | null = null;
    // private editingControlPoint: keyof Pick<WorkingFileVectorLayer['data'], 'start' | 'end' | 'focus'> | null = null;
    // private hoveringControlPoint: keyof Pick<WorkingFileVectorLayer['data'], 'start' | 'end' | 'focus'> | null = null;

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
                            return `<p class="mb-3!">${rt(message)}</p>`
                        }).join(''),
                        mouse: message + (tm('tutorialTip.drawShapeToolIntroduction.body.mouse') as string[]).map((message) => {
                            return `<p class="mb-3!">${rt(message)}</p>`
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

        this.selectedAttachedEditControlPointIndices = [];
        // This loops under the assumption attached indices always follow what they're attached to
        for (let i = selectedEditControlPointIndices.value[0] + 1; i < editControlPoints.value.length; i++) {
            for (let selectedIndex of selectedEditControlPointIndices.value) {
                if (
                    editControlPoints.value[i].attachToIndex === selectedIndex
                    && i !== selectedIndex
                ) {
                    this.selectedAttachedEditControlPointIndices.push(i);
                    break;
                }
            }
        }
        this.draggingEditControlPointIndices = selectedEditControlPointIndices.value.slice();
        for (let pointIndex of this.selectedAttachedEditControlPointIndices) {
            this.draggingEditControlPointIndices.push(pointIndex);
        }

        for (const pointIndex of this.draggingEditControlPointIndices) {
            const point = editControlPoints.value[pointIndex];
            point.sx = point.x;
            point.sy = point.y;
        }
    }

    onPointerMove(e: PointerEvent): void {
        super.onPointerMove(e);
        if (
            e.isPrimary
        ) {
            const pointer = this.pointers.filter((pointer) => pointer.id === e.pointerId)[0];

            if (pointer && (pointer.type !== 'touch' || this.multiTouchDownCount === 1) && pointer.down.button === 0 && pointer.isDragging) {
                if (this.selectedAttachedEditControlPointIndices.length > 0) {
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
            point.x = point.sx! + (viewTransformPoint.x - this.dragStartPoint.x);
            point.y = point.sy! + (viewTransformPoint.y - this.dragStartPoint.y);
        }

        editControlPointsDirty.value = true;

        renderControlPointAttributeEdits(
            this.draggingEditControlPointIndices,
            this.renderer,
        );
    }

    async onPointerUpBeforePurge(e: PointerEvent): Promise<void> {
        super.onPointerUpBeforePurge(e);

        this.drawEnd(e);
    }

    // private drawPreview() {

    //     canvasStore.set('dirty', true);
    // }

    private async drawEnd(e: PointerEvent) {
        const pointer = this.pointers.filter((pointer) => pointer.id === this.drawingPointerId)[0];

        
        // this.editingControlPoint = null;
        this.drawingPointerId = null;
        this.hasCreatedLayer = false;
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
                if (pathPointIndex === excludeIndex || (!currentIsAttached && isAttached)) {
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
