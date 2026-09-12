import { nextTick, watch, WatchStopHandle } from 'vue';

import BaseCanvasMovementController from './base-movement';

import { BrushStroke, type BrushStrokePoint } from '@/lib/brush-stroke';
import appEmitter from '@/lib/emitter';
import { dismissTutorialNotification, scheduleTutorialNotification, waitForNoOverlays } from '@/lib/tutorial';
import { t, tm, rt } from '@/i18n';

import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import { prepareStoredImageForArchival, prepareStoredImageForEditing } from '@/store/image';
import historyStore, { createHistoryReserveToken, historyReserveQueueFree, historyBlockInteractionUntilComplete } from '@/store/history';
import preferencesStore from '@/store/preferences';
import workingFileStore, { getSelectedLayers, getLayerById } from '@/store/working-file';
import {
    cursorHoverPosition, cursorHoverAngle,
    brushDensity, brushPressureMinDensity, brushHardness, brushSize, isPreviewingSize,
    brushPressureMinSize, brushPressureTaper, brushSmoothing, brushStrength, brushOpacity,
} from '../store/deform-blur-state';
import {  activeSelectionMask, appliedSelectionMask } from '../store/selection-state';

import type { BaseAction } from '@/actions/base';
import { BundleAction } from '@/actions/bundle';
import { ClearSelectionAction } from '@/actions/clear-selection';
import { UpdateLayerAction } from '@/actions/update-layer';

import { useRenderer, transferRendererTilesToRasterLayerUpdates } from '@/renderers';

import { RendererBrushStrokeDrawMode } from '@/types/renderer';
import type {
    RendererFrontend, RendererTextureTile, UpdateRasterLayerOptions, WorkingFileAnyLayer,
} from '@/types';

const devicePixelRatio = window.devicePixelRatio || 1;

export default class CanvasDeformBlurController extends BaseCanvasMovementController {

    private selectedLayerIdsUnwatch: WatchStopHandle | null = null;
    private pointerPenMaxPressureMarginUnwatch: WatchStopHandle | null = null;
    private isPreviewingSizeUnwatch: WatchStopHandle | null = null;

    private renderer: RendererFrontend | null = null;

    private blurringPointerId: number | null = null;
    private blurringUsePressure: boolean = false;
    private blurringOnLayers: WorkingFileAnyLayer[] = [];
    private blurringBrushStroke: BrushStroke | null = null;
    private isQueueingInput: boolean = false;
    private queuedBrushStrokePoints: Array<BrushStrokePoint> = [];

    private blurLoopDeltaAccumulator: number = 0;
    private blurLoopLastRunTimestamp: number = 0;
    private blurLoopLastPointerMoveTimestamp: number = 0;

    private pointerPenMaxPressureMargin: number = 0;

    onEnter(): void {
        super.onEnter();

        this.blurLoop = this.blurLoop.bind(this);

        useRenderer().then((renderer) => {
            this.renderer = renderer;
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

        this.pointerPenMaxPressureMarginUnwatch = watch(() => preferencesStore.state.pointerPenMaxPressureMargin, (pointerPenMaxPressureMargin) => {
            this.pointerPenMaxPressureMargin = pointerPenMaxPressureMargin;
        }, { immediate: true });

        this.isPreviewingSizeUnwatch = watch(() => isPreviewingSize.value, () => {
            if (isPreviewingSize.value) {
                cursorHoverPosition.value = new DOMPoint(
                    canvasStore.get('dndAreaLeft') + canvasStore.get('dndAreaWidth') / 2,
                    canvasStore.get('dndAreaTop') + canvasStore.get('dndAreaHeight') / 2,
                ).matrixTransform(canvasStore.state.transform.inverse());
            } else {
                cursorHoverPosition.value = new DOMPoint(
                    -100000000000,
                    -100000000000
                );
            }
        });

        appEmitter.on('editor.tool.selectAll', this.onSelectAll);
        
        cursorHoverPosition.value = new DOMPoint(
            -100000000000,
            -100000000000
        )
        cursorHoverAngle.value = 0;

        // Tutorial message
        if (!editorStore.state.tutorialFlags.deformBlurToolIntroduction) {
            waitForNoOverlays().then(() => {
                let message = (tm('tutorialTip.deformBlurToolIntroduction.introduction') as string[]).map((message) => {
                    return `<p class="mb-3!">${rt(message)}</p>`;
                }).join('');
                scheduleTutorialNotification({
                    flag: 'deformBlurToolIntroduction',
                    title: t('tutorialTip.deformBlurToolIntroduction.title'),
                    message: {
                        touch: message,
                        mouse: message
                    }
                });
            });
        }

    }

    onLeave(): void {
        super.onLeave();

        this.selectedLayerIdsUnwatch?.();
        this.selectedLayerIdsUnwatch = null;
        this.pointerPenMaxPressureMarginUnwatch?.();
        this.pointerPenMaxPressureMarginUnwatch = null;
        this.isPreviewingSizeUnwatch?.();
        this.isPreviewingSizeUnwatch = null;

        appEmitter.off('editor.tool.selectAll', this.onSelectAll);

        for (const layer of getSelectedLayers()) {
            if (layer.type === 'raster') {
                prepareStoredImageForArchival(layer.data.sourceUuid);
            }
        }

        // Tutorial Message
        if (!editorStore.state.tutorialFlags.deformBlurToolIntroduction) {
            dismissTutorialNotification('deformBlurToolIntroduction');
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
            cursorHoverAngle.value = e.twist;
            isPreviewingSize.value = false;
        }

        this.isQueueingInput = false;
        const hasPressure = (e.pointerType === 'pen' || e.pointerType === 'touch') && e.pressure !== 0.0 && e.pressure !== 0.5 && e.pressure !== 1.0;
        if (this.blurringPointerId == null && e.isPrimary && e.button === 0) {

            if (
                e.pointerType === 'pen' ||
                (!editorStore.state.isPenUser && e.pointerType === 'mouse')
            ) {
                this.blurringPointerId = e.pointerId;
                this.blurringUsePressure = hasPressure;
                this.blurStart(e);
            } else if (e.pointerType === 'touch') {
                this.isQueueingInput = true;
                this.queuedBrushStrokePoints = [];
            }
        }
    }

    onMultiTouchDown() {
        super.onMultiTouchDown();
        if (this.blurringPointerId != null) return;
        if (this.touches.length > 1 && !this.blurringUsePressure) {
            this.blurringPointerId = null;
            this.blurringBrushStroke = null;
        } else if (this.touches.length === 1) {
            const hasPressure = this.touches[0].down.pressure !== 0.0 && this.touches[0].down.pressure !== 0.5 && this.touches[0].down.pressure !== 1.0;
            this.blurringPointerId = this.touches[0].id;
            this.blurringUsePressure = hasPressure;
            this.blurStart(this.touches[0].down);

            for (const point of this.queuedBrushStrokePoints) {
                this.blurringBrushStroke?.addPoint(point);
            }
        }
        if (this.isQueueingInput) {
            this.isQueueingInput = false;
            this.queuedBrushStrokePoints = [];
        }
    }

    protected async blurStart(e: PointerEvent) {
        let selectedLayers = getSelectedLayers().filter(layer => layer.type === 'raster');
        if (selectedLayers.length === 0) {
            appEmitter.emit('app.notify', {
                type: 'info',
                title: t('toolbar.deformBlur.notification.noSelectedLayers.title'),
                message: t('toolbar.deformBlur.notification.noSelectedLayers.message'),
                duration: 5000,
            });
            return;
        }

        await nextTick();

        // Start a brush stroke for each of the selected layers
        this.blurringOnLayers = selectedLayers as WorkingFileAnyLayer[];

        for (const layer of this.blurringOnLayers) {
            await this.renderer?.startBrushStroke({
                layerId: layer.id,
                shape: 'circle',
                size: brushSize.value,
                color: new Float16Array([brushStrength.value, 1, 1, brushOpacity.value]),
                hardness: brushHardness.value,
                colorBlendingPersistence: 0,
                drawMode: RendererBrushStrokeDrawMode.BLUR,
            });
        }

        // Populate first drawing point
        const transformedPoint = new DOMPoint(
            this.lastCursorX * devicePixelRatio,
            this.lastCursorY * devicePixelRatio
        ).matrixTransform(canvasStore.state.transform.inverse());

        const pressure = this.blurringUsePressure ? Math.min(1, (e.pressure) / (1 - this.pointerPenMaxPressureMargin)) : 1;
        const size = brushSize.value * (
            brushPressureMinSize.value + (1 - brushPressureMinSize.value) * Math.pow(pressure, brushPressureTaper.value)
        );
        const density = this.calculateDensity(pressure, size);
        this.blurringBrushStroke = new BrushStroke(
            brushSmoothing.value,
            0.05, // Spacing
            false, // Pixel Snap
            0, // Jitter
            {
                x: transformedPoint.x,
                y: transformedPoint.y,
                density,
                colorBlendingStrength: 0,
                concentration: 1,
                size,
                tiltX: 0,
                tiltY: 0,
                twist: e.twist,
            }
        );

        // Draw first point
        for (const layer of this.blurringOnLayers) {
            this.renderer?.moveBrushStroke(
                layer.id,
                transformedPoint.x,
                transformedPoint.y,
                size,
                -canvasStore.state.decomposedTransform.rotation + (e.twist ?? 0),
                density,
                0, // colorBlendingStrength
                1, // concentration
            );
        }

        window.requestAnimationFrame(this.blurLoop);
    }

    onPointerMove(e: PointerEvent): void {
        super.onPointerMove(e);

        if ((e.pointerType === 'pen' || !editorStore.state.isPenUser) && !isPreviewingSize.value) {
            cursorHoverPosition.value = new DOMPoint(
                this.lastCursorX * devicePixelRatio,
                this.lastCursorY * devicePixelRatio
            ).matrixTransform(canvasStore.state.transform.inverse());
            cursorHoverAngle.value = e.twist;
        }

        if (
            this.blurringPointerId === e.pointerId
            || this.isQueueingInput
        ) {
            const transformedPoint = new DOMPoint(
                this.lastCursorX * devicePixelRatio,
                this.lastCursorY * devicePixelRatio
            ).matrixTransform(canvasStore.state.transform.inverse());
            
            const pressure = this.blurringUsePressure ? Math.min(1, (e.pressure) / (1 - this.pointerPenMaxPressureMargin)) : 1;
            const size = brushSize.value * (
                brushPressureMinSize.value + (1 - brushPressureMinSize.value) * Math.pow(pressure, brushPressureTaper.value)
            );
            const density = this.calculateDensity(pressure, size);

            const point: BrushStrokePoint = {
                x: transformedPoint.x,
                y: transformedPoint.y,
                density,
                colorBlendingStrength: 0,
                concentration: 1,
                size,
                tiltX: e.tiltX,
                tiltY: e.tiltY,
                twist: e.twist,
            };

            if (this.isQueueingInput) {
                this.queuedBrushStrokePoints.push(point);
            } else {
                this.blurringBrushStroke?.addPoint(point);
            }
            this.blurLoopLastPointerMoveTimestamp = performance.now();
        }
    }

    private blurLoop() {
        if (!this.blurringBrushStroke) return;

        const now = performance.now();

        let point: BrushStrokePoint | undefined;
        let count = 0;
        while (this.blurringBrushStroke.hasCollectedPoints()) {
            point = this.blurringBrushStroke.retrieveCatmullRomSegmentPoint();
            if (!point) continue;
            count++;
            this.blurLoopDeltaAccumulator = 0;
            for (const layer of this.blurringOnLayers) {
                this.renderer?.moveBrushStroke(
                    layer.id,
                    point.x,
                    point.y,
                    point.size,
                    -canvasStore.state.decomposedTransform.rotation + point.twist,
                    point.density,
                    point.colorBlendingStrength,
                    point.concentration,
                );
            }

            if (count > 60) break;
        }
        
        if (now - this.blurLoopLastPointerMoveTimestamp > 25) {
            this.blurLoopDeltaAccumulator += now - this.blurLoopLastRunTimestamp;

            if (this.blurLoopDeltaAccumulator > 16.66) {
                this.blurLoopDeltaAccumulator -= 16.66;
                this.blurringBrushStroke.advanceLine();

                if (this.blurLoopDeltaAccumulator > 16.66 * 6) {
                    this.blurLoopDeltaAccumulator = 0;
                }
            }
        }
        this.blurLoopLastRunTimestamp = now;

        window.requestAnimationFrame(this.blurLoop);
    }

    async onPointerUpBeforePurge(e: PointerEvent): Promise<void> {
        super.onPointerUpBeforePurge(e);

        this.blurEnd(e);
    }

    private async blurEnd(e: PointerEvent) {
        if (this.blurringPointerId === e.pointerId) {
            this.blurringPointerId = null;

            const collectedTiles: Array<Promise<Array<RendererTextureTile>>> = [];

            if (this.blurringBrushStroke && this.renderer) {
                this.blurringBrushStroke.finalizeLine();
                let point: BrushStrokePoint | undefined;
                while (this.blurringBrushStroke.hasCollectedPoints()) {
                    point = this.blurringBrushStroke.retrieveCatmullRomSegmentPoint();
                    if (!point) continue;
                    for (const layer of this.blurringOnLayers) {
                        this.renderer.moveBrushStroke(
                            layer.id,
                            point.x,
                            point.y,
                            point.size,
                            -canvasStore.state.decomposedTransform.rotation + point.twist,
                            point.density,
                            point.colorBlendingStrength,
                            point.concentration,
                        );
                    }
                }
                while (point = this.blurringBrushStroke.retrieveFinalPoints()) {
                    for (const layer of this.blurringOnLayers) {
                        this.renderer.moveBrushStroke(
                            layer.id,
                            point.x,
                            point.y,
                            point.size,
                            -canvasStore.state.decomposedTransform.rotation + point.twist,
                            point.density,
                            point.colorBlendingStrength,
                            point.concentration,
                        );
                    }
                }

                for (const layer of this.blurringOnLayers) {
                    collectedTiles.push(
                        this.renderer.stopBrushStroke(
                            layer.id,
                        )
                    );
                }
            }

            const blurringOnLayers = this.blurringOnLayers.slice();
            this.blurringBrushStroke = null;
            this.blurringOnLayers = [];

            const updateLayerReserveToken = createHistoryReserveToken();

            await historyReserveQueueFree();

            await historyStore.dispatch('reserve', { token: updateLayerReserveToken });

            const layerActions: BaseAction[] = [];

            for (const [layerIndex, layer] of blurringOnLayers.entries()) {
                if (layer.type === 'raster') {
                    const tiles = await collectedTiles[layerIndex];
                    if (tiles) {
                        layerActions.push(
                            new UpdateLayerAction<UpdateRasterLayerOptions>({
                                id: layer.id,
                                data: {
                                    tileUpdates: await transferRendererTilesToRasterLayerUpdates(tiles),
                                    alreadyRendererd: true,
                                }
                            })
                        );
                    }
                }
            }

            if (layerActions.length > 0) {
                await historyStore.dispatch('runAction', {
                    action: new BundleAction('updateBlurLayer', 'action.updateBlurLayer', layerActions),
                    reserveToken: updateLayerReserveToken,
                });
            } else {
                await historyStore.dispatch('unreserve', { token: updateLayerReserveToken });
            }
        }
    }

    private onSelectAll() {
        if (activeSelectionMask.value || appliedSelectionMask.value) {
            historyStore.dispatch('runAction', {
                action: new ClearSelectionAction()
            });
        }
    }

    private calculateDensity(pressure: number, size: number): number {
        const pressureSmoothStep = this.blurringUsePressure ? Math.min(1, 3 * Math.pow(pressure, 2) - 2 * Math.pow(pressure, 3)) : 0.8;
        const linearPressure = (brushPressureMinDensity.value + (brushDensity.value - brushPressureMinDensity.value) * pressureSmoothStep);
        const stampCount = Math.min(1 / ((0.05) * 2), size);
        const stampAlpha = Math.max(1 - Math.pow(1 - linearPressure, 1 / stampCount), 1 / 255);
        return stampAlpha;
    }

    protected handleCursorIcon() {
        let newIcon = super.handleCursorIcon();
        canvasStore.set('cursor', newIcon);
        return newIcon;
    }

}
