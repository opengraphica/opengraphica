import { v4 as uuidv4 } from 'uuid';
import { nextTick, watch, WatchStopHandle } from 'vue';

import BaseCanvasMovementController from './base-movement';
import { cursorHoverPosition } from '@/canvas/store/draw-gradient-state';
import { blitActiveSelectionMask, activeSelectionMask, appliedSelectionMask } from '@/canvas/store/selection-state';

import { isOffscreenCanvasSupported } from '@/lib/feature-detection';
import { dismissTutorialNotification, scheduleTutorialNotification, waitForNoOverlays } from '@/lib/tutorial';
import { t, tm, rt } from '@/i18n';

import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import { createStoredImage, prepareStoredImageForArchival, prepareStoredImageForEditing } from '@/store/image';
import historyStore, { createHistoryReserveToken, historyReserveQueueFree, historyBlockInteractionUntilComplete } from '@/store/history';
import workingFileStore, { getSelectedLayers, getLayerById, getLayerGlobalTransform, ensureUniqueLayerSiblingName } from '@/store/working-file';

import DrawableCanvas from '@/canvas/renderers/drawable/canvas';
import { prepareTextureCompositor } from '@/workers/texture-compositor.interface';

import type { BaseAction } from '@/actions/base';
import { BundleAction } from '@/actions/bundle';
import { InsertLayerAction } from '@/actions/insert-layer';
import { UpdateLayerAction } from '@/actions/update-layer';

import type { InsertRasterLayerOptions, UpdateRasterLayerOptions, WorkingFileAnyLayer } from '@/types';

const devicePixelRatio = window.devicePixelRatio || 1;

export default class CanvasDrawGradientController extends BaseCanvasMovementController {

    private selectedLayerIdsUnwatch: WatchStopHandle | null = null;

    private drawingPointerId: number | null = null;
    private drawingOnLayers: WorkingFileAnyLayer[] = [];
    private drawingPoints: DOMPoint[] = [];

    private activeDraftUuid: string | null = null;
    private drawablePreviewCanvas: DrawableCanvas | null = null;

    onEnter(): void {
        super.onEnter();

        isOffscreenCanvasSupported().then((isSupported) => {
            isSupported && prepareTextureCompositor();
        });

        this.drawablePreviewCanvas = new DrawableCanvas({ scale: 1 });
        this.drawablePreviewCanvas.onDrawn((event) => {
            if (this.activeDraftUuid == null) return;
            for (const layer of this.drawingOnLayers) {
                const draftIndex = layer.drafts?.findIndex((draft) => draft.uuid === this.activeDraftUuid) ?? -1;
                if (!layer.drafts?.[draftIndex]) continue;
                layer.drafts[draftIndex].updateChunks.push({
                    x: event.sourceX,
                    y: event.sourceY,
                    data: event.canvas,
                });
                layer.drafts[draftIndex].lastUpdateTimestamp = window.performance.now();
            }
            canvasStore.set('dirty', true);
        });

        this.selectedLayerIdsUnwatch = watch(() => workingFileStore.state.selectedLayerIds, (newIds, oldIds) => {
            const unusedOldIds = oldIds?.filter(id => newIds.indexOf(id) === -1) ?? [];
            for (const layerId of unusedOldIds) {
                const layer = getLayerById(layerId);
                if (layer?.type === 'raster') {
                    prepareStoredImageForArchival(layer.data.sourceUuid);
                }
            }
            for (const layerId of newIds) {
                const layer = getLayerById(layerId);
                if (layer?.type === 'raster') {
                    prepareStoredImageForEditing(layer.data.sourceUuid);
                }
            }
        }, { immediate: true });

        cursorHoverPosition.value = new DOMPoint(
            -100000000000,
            -100000000000
        )

        // Tutorial message
        if (!editorStore.state.tutorialFlags.drawGradientToolIntroduction) {
            waitForNoOverlays().then(() => {
                let message = (tm('tutorialTip.drawGradientToolIntroduction.introduction') as string[]).map((message) => {
                    return `<p class="mb-3">${rt(message)}</p>`;
                }).join('');
                scheduleTutorialNotification({
                    flag: 'drawGradientToolIntroduction',
                    title: t('tutorialTip.drawGradientToolIntroduction.title'),
                    message: {
                        touch: message + (tm('tutorialTip.drawGradientToolIntroduction.body.touch') as string[]).map((message) => {
                            return `<p class="mb-3">${rt(message)}</p>`
                        }).join(''),
                        mouse: message + (tm('tutorialTip.drawGradientToolIntroduction.body.mouse') as string[]).map((message) => {
                            return `<p class="mb-3">${rt(message)}</p>`
                        }).join(''),
                    }
                });
            });
        }
    }

    onLeave(): void {
        super.onLeave();

        this.drawablePreviewCanvas?.dispose();
        this.drawablePreviewCanvas = null;

        this.selectedLayerIdsUnwatch?.();
        this.selectedLayerIdsUnwatch = null;

        // Tutorial Message
        if (!editorStore.state.tutorialFlags.drawGradientToolIntroduction) {
            dismissTutorialNotification('drawGradientToolIntroduction');
        }

        // Block UI changes until history actions have completed
        historyBlockInteractionUntilComplete();
    }

    onPointerDown(e: PointerEvent) {
        super.onPointerDown(e);

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
                e.pointerType === 'touch' ||
                (!editorStore.state.isPenUser && e.pointerType === 'mouse')
            )
        ) {
            this.drawingPointerId = e.pointerId;
            this.drawStart();
        }
    }

    onMultiTouchDown() {
        super.onMultiTouchDown();
        if (this.touches.length > 1) {
            this.drawingPointerId = null;
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

        if (
            this.drawingPointerId === e.pointerId
        ) {
            this.drawingPoints.push(
                new DOMPoint(
                    this.lastCursorX * devicePixelRatio,
                    this.lastCursorY * devicePixelRatio
                ).matrixTransform(canvasStore.state.transform.inverse())
            );

            this.drawPreview();
        }
    }

    async onPointerUpBeforePurge(e: PointerEvent): Promise<void> {
        super.onPointerUpBeforePurge(e);

        this.drawEnd(e);
    }

    protected async drawStart() {

    }

    private drawPreview(refresh = false) {

    }

    private async drawEnd(e: PointerEvent) {
        
    }

    protected handleCursorIcon() {
        let newIcon = super.handleCursorIcon();
        canvasStore.set('cursor', newIcon);
        return newIcon;
    }
}
