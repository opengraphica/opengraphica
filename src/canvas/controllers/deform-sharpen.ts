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
} from '../store/deform-sharpen-state';
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

export default class CanvasDeformSharpenController extends BaseCanvasMovementController {

    private selectedLayerIdsUnwatch: WatchStopHandle | null = null;
    private pointerPenMaxPressureMarginUnwatch: WatchStopHandle | null = null;
    private isPreviewingSizeUnwatch: WatchStopHandle | null = null;

    private renderer: RendererFrontend | null = null;

    private sharpenPointerId: number | null = null;
    private sharpenUsePressure: boolean = false;
    private sharpenOnLayers: WorkingFileAnyLayer[] = [];
    private sharpenBrushStroke: BrushStroke | null = null;
    private isQueueingInput: boolean = false;
    private queuedBrushStrokePoints: Array<BrushStrokePoint> = [];

    private sharpenLoopDeltaAccumulator: number = 0;
    private sharpenLoopLastRunTimestamp: number = 0;
    private sharpenLoopLastPointerMoveTimestamp: number = 0;

    private pointerPenMaxPressureMargin: number = 0;

    onEnter(): void {
        super.onEnter();

        this.sharpenLoop = this.sharpenLoop.bind(this);

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
        if (!editorStore.state.tutorialFlags.deformSharpenToolIntroduction) {
            waitForNoOverlays().then(() => {
                let message = (tm('tutorialTip.deformSharpenToolIntroduction.introduction') as string[]).map((message) => {
                    return `<p class="mb-3!">${rt(message)}</p>`;
                }).join('');
                scheduleTutorialNotification({
                    flag: 'deformSharpenToolIntroduction',
                    title: t('tutorialTip.deformSharpenToolIntroduction.title'),
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
        if (!editorStore.state.tutorialFlags.deformSharpenToolIntroduction) {
            dismissTutorialNotification('deformSharpenToolIntroduction');
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
        if (this.sharpenPointerId == null && e.isPrimary && e.button === 0) {

            if (
                e.pointerType === 'pen' ||
                (!editorStore.state.isPenUser && e.pointerType === 'mouse')
            ) {
                this.sharpenPointerId = e.pointerId;
                this.sharpenUsePressure = hasPressure;
                this.sharpenStart(e);
            } else if (e.pointerType === 'touch') {
                this.isQueueingInput = true;
                this.queuedBrushStrokePoints = [];
            }
        }
    }

    onMultiTouchDown() {
        super.onMultiTouchDown();
        if (this.sharpenPointerId != null) return;
        if (this.touches.length > 1 && !this.sharpenUsePressure) {
            this.sharpenPointerId = null;
            this.sharpenBrushStroke = null;
        } else if (this.touches.length === 1) {
            const hasPressure = this.touches[0].down.pressure !== 0.0 && this.touches[0].down.pressure !== 0.5 && this.touches[0].down.pressure !== 1.0;
            this.sharpenPointerId = this.touches[0].id;
            this.sharpenUsePressure = hasPressure;
            this.sharpenStart(this.touches[0].down);

            for (const point of this.queuedBrushStrokePoints) {
                this.sharpenBrushStroke?.addPoint(point);
            }
        }
        if (this.isQueueingInput) {
            this.isQueueingInput = false;
            this.queuedBrushStrokePoints = [];
        }
    }

    protected async sharpenStart(e: PointerEvent) {
        let selectedLayers = getSelectedLayers().filter(layer => layer.type === 'raster');
        if (selectedLayers.length === 0) {
            appEmitter.emit('app.notify', {
                type: 'info',
                title: t('toolbar.deformSharpen.notification.noSelectedLayers.title'),
                message: t('toolbar.deformSharpen.notification.noSelectedLayers.message'),
                duration: 5000,
            });
            return;
        }

        await nextTick();

        // Start a brush stroke for each of the selected layers
        this.sharpenOnLayers = selectedLayers as WorkingFileAnyLayer[];

        for (const layer of this.sharpenOnLayers) {
            await this.renderer?.startBrushStroke({
                layerId: layer.id,
                shape: 'circle',
                size: brushSize.value,
                color: new Float16Array([brushStrength.value, 1, 1, brushOpacity.value]),
                hardness: brushHardness.value,
                colorBlendingPersistence: 0,
                drawMode: RendererBrushStrokeDrawMode.SHARPEN,
            });
        }

        // Populate first drawing point
        const transformedPoint = new DOMPoint(
            this.lastCursorX * devicePixelRatio,
            this.lastCursorY * devicePixelRatio
        ).matrixTransform(canvasStore.state.transform.inverse());

        const pressure = this.sharpenUsePressure ? Math.min(1, (e.pressure) / (1 - this.pointerPenMaxPressureMargin)) : 1;
        const size = brushSize.value * (
            brushPressureMinSize.value + (1 - brushPressureMinSize.value) * Math.pow(pressure, brushPressureTaper.value)
        );
        const density = this.calculateDensity(pressure, size);
        this.sharpenBrushStroke = new BrushStroke(
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
        for (const layer of this.sharpenOnLayers) {
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

        window.requestAnimationFrame(this.sharpenLoop);
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
            this.sharpenPointerId === e.pointerId
            || this.isQueueingInput
        ) {
            const transformedPoint = new DOMPoint(
                this.lastCursorX * devicePixelRatio,
                this.lastCursorY * devicePixelRatio
            ).matrixTransform(canvasStore.state.transform.inverse());
            
            const pressure = this.sharpenUsePressure ? Math.min(1, (e.pressure) / (1 - this.pointerPenMaxPressureMargin)) : 1;
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
                this.sharpenBrushStroke?.addPoint(point);
            }
            this.sharpenLoopLastPointerMoveTimestamp = performance.now();
        }
    }

    private sharpenLoop() {
        if (!this.sharpenBrushStroke) return;

        const now = performance.now();

        let point: BrushStrokePoint | undefined;
        let count = 0;
        while (this.sharpenBrushStroke.hasCollectedPoints()) {
            point = this.sharpenBrushStroke.retrieveCatmullRomSegmentPoint();
            if (!point) continue;
            count++;
            this.sharpenLoopDeltaAccumulator = 0;
            for (const layer of this.sharpenOnLayers) {
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
        
        if (now - this.sharpenLoopLastPointerMoveTimestamp > 25) {
            this.sharpenLoopDeltaAccumulator += now - this.sharpenLoopLastRunTimestamp;

            if (this.sharpenLoopDeltaAccumulator > 16.66) {
                this.sharpenLoopDeltaAccumulator -= 16.66;
                this.sharpenBrushStroke.advanceLine();

                if (this.sharpenLoopDeltaAccumulator > 16.66 * 6) {
                    this.sharpenLoopDeltaAccumulator = 0;
                }
            }
        }
        this.sharpenLoopLastRunTimestamp = now;

        window.requestAnimationFrame(this.sharpenLoop);
    }

    async onPointerUpBeforePurge(e: PointerEvent): Promise<void> {
        super.onPointerUpBeforePurge(e);

        this.sharpenEnd(e);
    }

    private async sharpenEnd(e: PointerEvent) {
        if (this.sharpenPointerId === e.pointerId) {
            this.sharpenPointerId = null;

            const collectedTiles: Array<Promise<Array<RendererTextureTile>>> = [];

            if (this.sharpenBrushStroke && this.renderer) {
                this.sharpenBrushStroke.finalizeLine();
                let point: BrushStrokePoint | undefined;
                while (this.sharpenBrushStroke.hasCollectedPoints()) {
                    point = this.sharpenBrushStroke.retrieveCatmullRomSegmentPoint();
                    if (!point) continue;
                    for (const layer of this.sharpenOnLayers) {
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
                while (point = this.sharpenBrushStroke.retrieveFinalPoints()) {
                    for (const layer of this.sharpenOnLayers) {
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

                for (const layer of this.sharpenOnLayers) {
                    collectedTiles.push(
                        this.renderer.stopBrushStroke(
                            layer.id,
                        )
                    );
                }
            }

            const sharpenOnLayers = this.sharpenOnLayers.slice();
            this.sharpenBrushStroke = null;
            this.sharpenOnLayers = [];

            const updateLayerReserveToken = createHistoryReserveToken();

            await historyReserveQueueFree();

            await historyStore.dispatch('reserve', { token: updateLayerReserveToken });

            const layerActions: BaseAction[] = [];

            for (const [layerIndex, layer] of sharpenOnLayers.entries()) {
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
                    action: new BundleAction('updateSharpenLayer', 'action.updateSharpenLayer', layerActions),
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
        const pressureSmoothStep = this.sharpenUsePressure ? Math.min(1, 3 * Math.pow(pressure, 2) - 2 * Math.pow(pressure, 3)) : 0.8;
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
