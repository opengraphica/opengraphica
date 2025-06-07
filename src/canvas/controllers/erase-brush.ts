import { v4 as uuidv4 } from 'uuid';
import { nextTick, watch, WatchStopHandle } from 'vue';

import BaseCanvasMovementController from './base-movement';

import { BrushStroke, type BrushStrokePoint } from '@/lib/brush-stroke';
import appEmitter from '@/lib/emitter';
import { dismissTutorialNotification, scheduleTutorialNotification, waitForNoOverlays } from '@/lib/tutorial';
import { t, tm, rt } from '@/i18n';

import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import preferencesStore from '@/store/preferences';
import { prepareStoredImageForArchival, prepareStoredImageForEditing } from '@/store/image';
import historyStore, { createHistoryReserveToken, historyReserveQueueFree, historyBlockInteractionUntilComplete } from '@/store/history';
import workingFileStore, { getSelectedLayers, getLayerById } from '@/store/working-file';
import {
    showBrushDrawer,
    cursorHoverPosition, brushShape, brushSpacing, brushSize, brushOpacity,
    brushHardness, brushPressureMinSize, brushPressureTaper,
    brushDensity, brushPressureMinDensity, brushSmoothing, brushJitter,
} from '../store/erase-brush-state';

import type { BaseAction } from '@/actions/base';
import { BundleAction } from '@/actions/bundle';
import { UpdateLayerAction } from '@/actions/update-layer';

import { useRenderer, transferRendererTilesToRasterLayerUpdates } from '@/renderers';

import type { RendererFrontend, RendererTextureTile, UpdateRasterLayerOptions, WorkingFileAnyLayer } from '@/types';

const devicePixelRatio = window.devicePixelRatio || 1;

export default class CanvasEraseController extends BaseCanvasMovementController {

    private brushSizeUnwatch: WatchStopHandle | null = null;
    private selectedLayerIdsUnwatch: WatchStopHandle | null = null;
    private pointerPenMaxPressureMarginUnwatch: WatchStopHandle | null = null;

    private renderer: RendererFrontend | null = null;

    private erasingPointerId: number | null = null;
    private erasingUsePressure: boolean = false;
    private erasingOnLayers: WorkingFileAnyLayer[] = [];
    private erasingBrushStroke: BrushStroke | null = null;

    private eraseLoopDeltaAccumulator: number = 0;
    private eraseLoopLastRunTimestamp: number = 0;
    private eraseLoopLastPointerMoveTimestamp: number = 0;

    private pointerPenMaxPressureMargin: number = 0;

    onEnter(): void {
        super.onEnter();

        this.eraseLoop = this.eraseLoop.bind(this);
        
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
        
        cursorHoverPosition.value = new DOMPoint(
            -100000000000,
            -100000000000
        )

        // Tutorial message
        if (!editorStore.state.tutorialFlags.eraseToolIntroduction) {
            waitForNoOverlays().then(() => {
                let message = (tm('tutorialTip.eraseToolIntroduction.introduction') as string[]).map((message) => {
                    return `<p class="mb-3">${rt(message)}</p>`;
                }).join('');
                scheduleTutorialNotification({
                    flag: 'eraseToolIntroduction',
                    title: t('tutorialTip.eraseToolIntroduction.title'),
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

        showBrushDrawer.value = false;

        this.brushSizeUnwatch?.();
        this.brushSizeUnwatch = null;
        this.selectedLayerIdsUnwatch?.();
        this.selectedLayerIdsUnwatch = null;
        this.pointerPenMaxPressureMarginUnwatch?.();
        this.pointerPenMaxPressureMarginUnwatch = null;

        for (const layer of getSelectedLayers()) {
            if (layer.type === 'raster') {
                prepareStoredImageForArchival(layer.data.sourceUuid);
            }
        }

        // Tutorial Message
        if (!editorStore.state.tutorialFlags.eraseToolIntroduction) {
            dismissTutorialNotification('eraseToolIntroduction');
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

        const hasPressure = (e.pointerType === 'pen' || e.pointerType === 'touch') && e.pressure !== 0.5 && e.pressure !== 1.0;
        if (
            this.erasingPointerId == null && e.isPrimary && e.button === 0 &&
            (
                e.pointerType === 'pen' ||
                (e.pointerType === 'touch' && hasPressure) ||
                (!editorStore.state.isPenUser && e.pointerType === 'mouse')
            )
        ) {
            if (showBrushDrawer.value) {
                showBrushDrawer.value = false;
                return;
            }

            this.erasingPointerId = e.pointerId;
            this.eraseStart(e);
        }
    }

    onMultiTouchDown() {
        super.onMultiTouchDown();
        const hasPressure = this.touches[0].down.pressure !== 0.5 && this.touches[0].down.pressure !== 1.0;
        if (this.erasingPointerId != null || hasPressure) return;
        if (showBrushDrawer.value) {
            showBrushDrawer.value = false;
            return;
        }
        if (this.touches.length > 1 && !this.erasingUsePressure) {
            this.erasingPointerId = null;
            this.erasingBrushStroke = null;
        } else if (this.touches.length === 1) {
            this.erasingPointerId = this.touches[0].id;
            this.erasingUsePressure = false;
            this.eraseStart(this.touches[0].down);
        }
    }

    protected async eraseStart(e: PointerEvent) {
        let selectedLayers = getSelectedLayers().filter((layer) => layer.type === 'raster');
        if (selectedLayers.length === 0) {
            appEmitter.emit('app.notify', {
                type: 'info',
                title: t('toolbar.eraseBrush.notification.noSelectedLayers.title'),
                message: t('toolbar.eraseBrush.notification.noSelectedLayers.message'),
                duration: 5000,
            });
            return;   
        }

        await nextTick();

        // Start a brush stroke for each of the selected layers
        this.erasingOnLayers = selectedLayers as WorkingFileAnyLayer[];

        for (const layer of this.erasingOnLayers) {
            await this.renderer?.startBrushStroke({
                layerId: layer.id,
                blendingMode: 'erase',
                size: brushSize.value,
                color: new Float16Array([1, 1, 1, brushOpacity.value]),
                hardness: brushHardness.value,
                colorBlendingPersistence: 0,
            });
        }

        // Populate first erasing point
        const transformedPoint = new DOMPoint(
            this.lastCursorX * devicePixelRatio,
            this.lastCursorY * devicePixelRatio
        ).matrixTransform(canvasStore.state.transform.inverse())
        const pressure = this.erasingUsePressure ? Math.min(1, (e.pressure) / (1 - this.pointerPenMaxPressureMargin)) : 1;
        const size = brushSize.value * (
            brushPressureMinSize.value + (1 - brushPressureMinSize.value) * Math.pow(pressure, brushPressureTaper.value)
        );
        const density = this.calculateDensity(pressure, size);
        this.erasingBrushStroke = new BrushStroke(
            brushSmoothing.value,
            brushSpacing.value,
            brushJitter.value,
            {
                x: transformedPoint.x,
                y: transformedPoint.y,
                density,
                colorBlendingStrength: 0,
                concentration: 1,
                size,
                tiltX: 0,
                tiltY: 0,
                twist: 0,
            }
        );

        // Draw first point
        for (const layer of this.erasingOnLayers) {
            this.renderer?.moveBrushStroke(
                layer.id,
                transformedPoint.x,
                transformedPoint.y,
                size,
                density,
                0,
                1,
            );
        }

        window.requestAnimationFrame(this.eraseLoop);
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

        const now = performance.now();
        if (
            this.erasingPointerId === e.pointerId
        ) {
            const transformedPoint = new DOMPoint(
                this.lastCursorX * devicePixelRatio,
                this.lastCursorY * devicePixelRatio
            ).matrixTransform(canvasStore.state.transform.inverse());

            const pressure = this.erasingUsePressure ? Math.min(1, (e.pressure) / (1 - this.pointerPenMaxPressureMargin)) : 1;
            const size = brushSize.value * (
                brushPressureMinSize.value + (1 - brushPressureMinSize.value) * Math.pow(pressure, brushPressureTaper.value)
            );
            const density = this.calculateDensity(pressure, size);

            this.erasingBrushStroke?.addPoint({
                x: transformedPoint.x,
                y: transformedPoint.y,
                density,
                colorBlendingStrength: 0,
                concentration: 1,
                size,
                tiltX: e.tiltX,
                tiltY: e.tiltY,
                twist: e.twist,
            });
            this.eraseLoopLastPointerMoveTimestamp = performance.now();
        }
    }

    private eraseLoop() {
        if (!this.erasingBrushStroke) return;

        const now = performance.now();

        let point: BrushStrokePoint | undefined;
        let count = 0;
        while (this.erasingBrushStroke.hasCollectedPoints()) {
            point = this.erasingBrushStroke.retrieveCatmullRomSegmentPoint();
            if (!point) continue;
            count++;
            this.eraseLoopDeltaAccumulator = 0;
            for (const layer of this.erasingOnLayers) {
                this.renderer?.moveBrushStroke(
                    layer.id,
                    point.x,
                    point.y,
                    point.size,
                    point.density,
                    point.colorBlendingStrength,
                    point.concentration,
                );
            }

            if (count > 60) break;
        }
        
        if (now - this.eraseLoopLastPointerMoveTimestamp > 25) {
            this.eraseLoopDeltaAccumulator += now - this.eraseLoopLastRunTimestamp;

            if (this.eraseLoopDeltaAccumulator > 16.66) {
                this.eraseLoopDeltaAccumulator -= 16.66;
                this.erasingBrushStroke.advanceLine();

                if (this.eraseLoopDeltaAccumulator > 16.66 * 6) {
                    this.eraseLoopDeltaAccumulator = 0;
                }
            }
        }
        this.eraseLoopLastRunTimestamp = now;

        window.requestAnimationFrame(this.eraseLoop);
    }

    async onPointerUpBeforePurge(e: PointerEvent): Promise<void> {
        super.onPointerUpBeforePurge(e);

        this.eraseEnd(e);
    }

    private async eraseEnd(e: PointerEvent) {
        if (this.erasingPointerId === e.pointerId) {
            this.erasingPointerId = null;

            const collectedTiles: Array<Promise<Array<RendererTextureTile>>> = [];

            if (this.erasingBrushStroke && this.renderer) {
                this.erasingBrushStroke.finalizeLine();
                let point: BrushStrokePoint | undefined;
                while (this.erasingBrushStroke.hasCollectedPoints()) {
                    point = this.erasingBrushStroke.retrieveCatmullRomSegmentPoint();
                    if (!point) continue;
                    for (const layer of this.erasingOnLayers) {
                        this.renderer.moveBrushStroke(
                            layer.id,
                            point.x,
                            point.y,
                            point.size,
                            point.density,
                            point.colorBlendingStrength,
                            point.concentration,
                        );
                    }
                }
                while (point = this.erasingBrushStroke.retrieveFinalPoints()) {
                    for (const layer of this.erasingOnLayers) {
                        this.renderer.moveBrushStroke(
                            layer.id,
                            point.x,
                            point.y,
                            point.size,
                            point.density,
                            point.colorBlendingStrength,
                            point.concentration,
                        );
                    }
                }

                for (const layer of this.erasingOnLayers) {
                    collectedTiles.push(
                        this.renderer.stopBrushStroke(
                            layer.id,
                        )
                    );
                }
            }

            const erasingOnLayers = this.erasingOnLayers.slice();
            this.erasingBrushStroke = null;
            this.erasingOnLayers = [];

            const updateLayerReserveToken = createHistoryReserveToken();

            await historyReserveQueueFree();

            await historyStore.dispatch('reserve', { token: updateLayerReserveToken });

            const layerActions: BaseAction[] = [];

            for (const [layerIndex, layer] of erasingOnLayers.entries()) {
                if (layer.type === 'raster') {

                    layerActions.push(
                        new UpdateLayerAction<UpdateRasterLayerOptions>({
                            id: layer.id,
                            data: {
                                tileUpdates: await transferRendererTilesToRasterLayerUpdates(
                                    await collectedTiles[layerIndex],
                                ),
                                alreadyRendererd: true,
                            }
                        })
                    );

                }
            }

            if (layerActions.length > 0) {
                await historyStore.dispatch('runAction', {
                    action: new BundleAction('updateEraseLayer', 'action.updateEraseLayer', layerActions),
                    reserveToken: updateLayerReserveToken,
                });
            } else {
                await historyStore.dispatch('unreserve', { token: updateLayerReserveToken });
            }

        }
    }

    private calculateDensity(pressure: number, size: number): number {
        const pressureSmoothStep = this.erasingUsePressure ? Math.min(1, 3 * Math.pow(pressure, 2) - 2 * Math.pow(pressure, 3)) : 0.8;
        const linearPressure = (brushPressureMinDensity.value + (brushDensity.value - brushPressureMinDensity.value) * pressureSmoothStep);
        const stampCount = Math.min(1 / (brushSpacing.value * 2), size);
        const stampAlpha = Math.max(1 - Math.pow(1 - linearPressure, 1 / stampCount), 1 / 255);
        return stampAlpha;
    }

    protected handleCursorIcon() {
        let newIcon = super.handleCursorIcon();
        canvasStore.set('cursor', newIcon);
        return newIcon;
    }

}
