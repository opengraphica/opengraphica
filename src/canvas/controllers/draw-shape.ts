import { nextTick, watch, WatchStopHandle } from 'vue';

import BaseCanvasMovementController from './base-movement';
import {
    cursorHoverPosition, editingLayers, hasVisibleToolbarOverlay, showShapeDrawer,
} from '@/canvas/store/draw-shape-state';

import appEmitter, { type AppEmitterEvents } from '@/lib/emitter';
import { dismissTutorialNotification, scheduleTutorialNotification, waitForNoOverlays } from '@/lib/tutorial';
import { t, tm, rt } from '@/i18n';

import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import historyStore, { historyBlockInteractionUntilComplete } from '@/store/history';
import workingFileStore, { getSelectedLayers, getLayerGlobalTransform, ensureUniqueLayerSiblingName } from '@/store/working-file';

import type {
    WorkingFileVectorLayer, WorkingFileAnyLayer
} from '@/types';

const devicePixelRatio = window.devicePixelRatio || 1;

export default class CanvasDrawShapetController extends BaseCanvasMovementController {

    private selectedLayerIdsUnwatch: WatchStopHandle | null = null;

    private hasCreatedLayer: boolean = false;
    private selectedLayers: WorkingFileVectorLayer[] = [];
    // private editingLayersStartData: Array<WorkingFileVectorLayer['data']> | null = null;
    // private editingControlPoint: keyof Pick<WorkingFileVectorLayer['data'], 'start' | 'end' | 'focus'> | null = null;
    // private hoveringControlPoint: keyof Pick<WorkingFileVectorLayer['data'], 'start' | 'end' | 'focus'> | null = null;

    private drawingPointerId: number | null = null;

    onEnter(): void {
        super.onEnter();

        cursorHoverPosition.value = new DOMPoint(
            -100000000000,
            -100000000000
        )

        this.selectedLayerIdsUnwatch = watch(() => workingFileStore.state.selectedLayerIds, (newIds, oldIds) => {
            this.selectedLayers = getSelectedLayers<WorkingFileVectorLayer>(newIds).filter(
                layer => layer.type === 'vector'
            );
            editingLayers.value = getSelectedLayers<WorkingFileVectorLayer>(newIds).filter(
                layer => layer.type === 'vector'
            );
            this.updateToolbarFromEditingLayers();
        }, { immediate: true });

        this.onHistoryStep = this.onHistoryStep.bind(this);
        appEmitter.on('editor.history.step', this.onHistoryStep);

        // Tutorial message
        if (!editorStore.state.tutorialFlags.drawShapeToolIntroduction) {
            waitForNoOverlays().then(() => {
                let message = (tm('tutorialTip.drawShapeToolIntroduction.introduction') as string[]).map((message) => {
                    return `<p class="mb-3">${rt(message)}</p>`;
                }).join('');
                scheduleTutorialNotification({
                    flag: 'drawShapeToolIntroduction',
                    title: t('tutorialTip.drawShapeToolIntroduction.title'),
                    message: {
                        touch: message + (tm('tutorialTip.drawShapeToolIntroduction.body.touch') as string[]).map((message) => {
                            return `<p class="mb-3">${rt(message)}</p>`
                        }).join(''),
                        mouse: message + (tm('tutorialTip.drawShapeToolIntroduction.body.mouse') as string[]).map((message) => {
                            return `<p class="mb-3">${rt(message)}</p>`
                        }).join(''),
                    }
                });
            });
        }
    }

    onLeave(): void {
        super.onLeave();

        showShapeDrawer.value = false;
        this.selectedLayerIdsUnwatch?.();

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

        if (e.pointerType === 'pen' || !editorStore.state.isPenUser) {
            cursorHoverPosition.value = new DOMPoint(
                this.lastCursorX * devicePixelRatio,
                this.lastCursorY * devicePixelRatio
            ).matrixTransform(canvasStore.state.transform.inverse());
        }

        if (
            this.drawingPointerId == null && e.isPrimary && e.button === 0 &&
            (
                e.pointerType === 'pen' ||
                (!editorStore.state.isPenUser && e.pointerType === 'mouse')
            )
        ) {
            this.drawingPointerId = e.pointerId;
            this.drawStart();
        }
    }

    onMultiTouchDown() {
        super.onMultiTouchDown();
        if (this.touches.length === 1) {
            this.drawingPointerId = this.touches[0].id;
            this.drawStart();
        }
    }

    onPointerMove(e: PointerEvent): void {
        super.onPointerMove(e);
        const pointer = this.pointers.filter((pointer) => pointer.id === e.pointerId)[0];

        if (e.pointerType === 'pen' || !editorStore.state.isPenUser) {
            cursorHoverPosition.value = new DOMPoint(
                this.lastCursorX * devicePixelRatio,
                this.lastCursorY * devicePixelRatio
            ).matrixTransform(canvasStore.state.transform.inverse());
        }

        // this.hoveringControlPoint = this.getControlPointAtPosition({
        //     x: cursorHoverPosition.value.x,
        //     y: cursorHoverPosition.value.y,
        // }, this.selectedLayers);

        if (
            this.drawingPointerId === e.pointerId &&
            pointer.isDragging
        ) {
            this.drawPreview();
        }

        this.handleCursorIcon();
    }

    async onPointerUpBeforePurge(e: PointerEvent): Promise<void> {
        super.onPointerUpBeforePurge(e);

        this.drawEnd(e);
    }

    protected async drawStart() {
        if (this.drawingPointerId == null) return;
        const pointer = this.pointers.filter((pointer) => pointer.id === this.drawingPointerId)[0];
        if (!pointer) return;

        const { viewTransformPoint: start } = this.getTransformedCursorInfo();
        let selectedLayers = getSelectedLayers().filter(layer => layer.type === 'vector' || layer.type === 'empty');

        // See if the user clicked on any points in a selected layer.
        // this.editingControlPoint = this.getControlPointAtPosition(start, selectedLayers, true);
        
        // if (this.editingControlPoint == null) {
            
        // }

        await nextTick();

        selectedLayers = getSelectedLayers().filter(layer => layer.type === 'vector');
        if (selectedLayers.length > 0) {
            editingLayers.value = [selectedLayers[0] as WorkingFileVectorLayer];
        } else {
            editingLayers.value = [];
        }

        this.updateToolbarFromEditingLayers();
    }

    private drawPreview() {

        canvasStore.set('dirty', true);
    }

    private async drawEnd(e: PointerEvent) {
        const pointer = this.pointers.filter((pointer) => pointer.id === this.drawingPointerId)[0];

        
        // this.editingControlPoint = null;
        this.drawingPointerId = null;
        this.hasCreatedLayer = false;
    }

    private getControlPointAtPosition(cursor: { x: number, y: number }, selectedLayers: WorkingFileAnyLayer[], editLayer = false) {
        const decomposedTransform = canvasStore.state.decomposedTransform;
        let appliedZoom: number = decomposedTransform.scaleX / devicePixelRatio;
        let controlPoint: 'start' | 'end' | 'focus' | null = null;
        return controlPoint;
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
        if (!newIcon && !hasVisibleToolbarOverlay.value) {
            // if (this.hoveringControlPoint == null) {
            //     newIcon = 'crosshair';
            // } else {
            newIcon = 'grabbing';
            // }
        }
        canvasStore.set('cursor', newIcon);
        return newIcon;
    }
}
