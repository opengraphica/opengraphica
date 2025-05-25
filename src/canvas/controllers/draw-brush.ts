import { nextTick, watch, WatchStopHandle } from 'vue';

import BaseCanvasMovementController from './base-movement';

import { BrushStroke, type BrushStrokePoint } from '@/lib/brush-stroke';
import { dismissTutorialNotification, scheduleTutorialNotification, waitForNoOverlays } from '@/lib/tutorial';
import { createImageFromBlob, createEmptyCanvas } from '@/lib/image';
import { t, tm, rt } from '@/i18n';

import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import { createStoredImage, prepareStoredImageForArchival, prepareStoredImageForEditing } from '@/store/image';
import historyStore, { createHistoryReserveToken, historyReserveQueueFree, historyBlockInteractionUntilComplete } from '@/store/history';
import preferencesStore from '@/store/preferences';
import workingFileStore, { getSelectedLayers, getLayerById, getLayerGlobalTransform, ensureUniqueLayerSiblingName } from '@/store/working-file';
import {
    cursorHoverPosition, brushShape, brushSmoothing, brushSpacing, brushColor,
    brushSize, brushJitter, brushPressureMinDensity, brushDensity, showBrushDrawer,
    brushPressureMinSize, brushPressureTaper, brushConcentration, brushPressureMinConcentration,
    brushColorBlendingStrength, brushPressureMinColorBlendingStrength,
    brushColorBlendingPersistence, brushHardness,
} from '../store/draw-brush-state';

import DrawableCanvas from '@/canvas/renderers/drawable/canvas';

import type { BaseAction } from '@/actions/base';
import { BundleAction } from '@/actions/bundle';
import { InsertLayerAction } from '@/actions/insert-layer';
import { UpdateLayerAction } from '@/actions/update-layer';

import { useRenderer } from '@/renderers';

import type { InsertRasterLayerOptions, RendererFrontend, UpdateRasterLayerOptions, WorkingFileAnyLayer } from '@/types';


const devicePixelRatio = window.devicePixelRatio || 1;

export default class CanvasDrawBrushController extends BaseCanvasMovementController {

    private brushShapeUnwatch: WatchStopHandle | null = null;
    private brushSizeUnwatch: WatchStopHandle | null = null;
    private selectedLayerIdsUnwatch: WatchStopHandle | null = null;
    private pointerPenMaxPressureMarginUnwatch: WatchStopHandle | null = null;

    private renderer: RendererFrontend | null = null;

    private drawingPointerId: number | null = null;
    private drawingUsePressure: boolean = false;
    private drawingOnLayers: WorkingFileAnyLayer[] = [];
    private drawingBrushStroke: BrushStroke | null = null;
    private drawLoopDeltaAccumulator: number = 0;
    private drawLoopLastRunTimestamp: number = 0;
    private drawLoopLastPointerMoveTimestamp: number = 0;

    private activeDraftUuid: string | null = null;
    private drawablePreviewCanvas: DrawableCanvas | null = null;
    private brushStrokeDrawableUuid: string | null = null;

    private brushShapeImage: HTMLImageElement | null = null;
    private brushColorStyle: string = '#000000';
    private brushColorAlpha: number = 1;

    private pointerPenMaxPressureMargin: number = 0;

    onEnter(): void {
        super.onEnter();

        this.drawLoop = this.drawLoop.bind(this);

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

        this.brushShapeUnwatch = watch([brushShape, brushColor], async ([brushShape, brushColor]) => {
            if (this.brushShapeImage) {
                URL.revokeObjectURL(this.brushShapeImage.src);
                this.brushShapeImage = null;
            }
            const svg = `
                <svg xmlns="http://www.w3.org/2000/svg"
                    width="3"
                    height="3"
                    viewBox="-1 -1 3 3">
                    <path d="${brushShape}" fill="${brushColor.style}" />
                </svg>`;
            this.brushShapeImage = await createImageFromBlob(new Blob([svg], { type: 'image/svg+xml' }));

            if (brushColor.style.length === 9) {
                this.brushColorAlpha = parseInt(brushColor.style.substring(7, 9), 16) / 255;
                this.brushColorStyle = brushColor.style.substring(0, 7);
            } else {
                this.brushColorAlpha = 1;
                this.brushColorStyle = brushColor.style;
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
        if (!editorStore.state.tutorialFlags.drawToolIntroduction) {
            waitForNoOverlays().then(() => {
                let message = (tm('tutorialTip.drawToolIntroduction.introduction') as string[]).map((message) => {
                    return `<p class="mb-3">${rt(message)}</p>`;
                }).join('');
                scheduleTutorialNotification({
                    flag: 'drawToolIntroduction',
                    title: t('tutorialTip.drawToolIntroduction.title'),
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

        this.drawablePreviewCanvas?.dispose();
        this.drawablePreviewCanvas = null;

        this.brushShapeUnwatch?.();
        this.brushShapeUnwatch = null;
        this.brushSizeUnwatch?.();
        this.pointerPenMaxPressureMarginUnwatch?.();
        this.brushSizeUnwatch = null;
        this.selectedLayerIdsUnwatch?.();
        this.selectedLayerIdsUnwatch = null;
        this.pointerPenMaxPressureMarginUnwatch = null;

        for (const layer of getSelectedLayers()) {
            if (layer.type === 'raster') {
                prepareStoredImageForArchival(layer.data.sourceUuid);
            }
        }

        // Tutorial Message
        if (!editorStore.state.tutorialFlags.drawToolIntroduction) {
            dismissTutorialNotification('drawToolIntroduction');
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
            this.drawingPointerId == null && e.isPrimary && e.button === 0 &&
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

            this.drawingPointerId = e.pointerId;
            this.drawingUsePressure = hasPressure;
            this.drawStart(e);
        }
    }

    onMultiTouchDown() {
        super.onMultiTouchDown();
        const hasPressure = this.touches[0].down.pressure !== 0.5 && this.touches[0].down.pressure !== 1.0;
        if (this.drawingPointerId != null || hasPressure) return;
        if (showBrushDrawer.value) {
            showBrushDrawer.value = false;
            return;
        }
        if (this.touches.length > 1 && !this.drawingUsePressure) {
            this.drawingPointerId = null;
            this.drawingBrushStroke = null;
            (async () => {
                await historyReserveQueueFree();
                for (const layer of getSelectedLayers()) {
                    layer.drafts = [];
                }
            })();
        } else if (this.touches.length === 1) {
            this.drawingPointerId = this.touches[0].id;
            this.drawingUsePressure = false;
            this.drawStart(this.touches[0].down);
        }
    }

    lastPointerTimestamp = 0;

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
            this.drawingPointerId === e.pointerId
        ) {
            this.lastPointerTimestamp = now;
            const transformedPoint = new DOMPoint(
                this.lastCursorX * devicePixelRatio,
                this.lastCursorY * devicePixelRatio
            ).matrixTransform(canvasStore.state.transform.inverse());

            const pressure = this.drawingUsePressure ? Math.min(1, (e.pressure) / (1 - this.pointerPenMaxPressureMargin)) : 1;
            const size = brushSize.value * Math.max(
                brushPressureMinSize.value,
                Math.pow(pressure, brushPressureTaper.value)
            );
            const density = this.calculateDensity(pressure, size);

            this.drawingBrushStroke?.addPoint({
                x: transformedPoint.x,
                y: transformedPoint.y,
                density,
                colorBlendingStrength: brushPressureMinColorBlendingStrength.value + (brushColorBlendingStrength.value - brushPressureMinColorBlendingStrength.value) * (1 - pressure),
                concentration: brushPressureMinConcentration.value + (brushConcentration.value - brushPressureMinConcentration.value) * pressure,
                size,
                tiltX: e.tiltX,
                tiltY: e.tiltY,
                twist: e.twist,
            });
            this.drawLoopLastPointerMoveTimestamp = performance.now();
        }
    }

    async onPointerUpBeforePurge(e: PointerEvent): Promise<void> {
        super.onPointerUpBeforePurge(e);

        this.drawEnd(e);
    }

    protected async drawStart(e: PointerEvent) {
        // Create layer if one does not exist
        const startDrawReserveToken = createHistoryReserveToken();
        await historyStore.dispatch('reserve', { token: startDrawReserveToken });

        const { width, height } = workingFileStore.state;
        let selectedLayers = getSelectedLayers().filter(layer => layer.type === 'raster' || layer.type === 'empty');
        let layerActions: BaseAction[] = [];

        // Insert raster layer if none selected
        if (selectedLayers.length === 0) {
            layerActions.push(new InsertLayerAction<InsertRasterLayerOptions>({
                type: 'raster',
                name: ensureUniqueLayerSiblingName(workingFileStore.state.layers[0]?.id, t('toolbar.drawBrush.newBrushLayerName')),
                width,
                height,
                data: {
                    sourceUuid: await createStoredImage(createEmptyCanvas(width, height)),
                },
            }));
        }

        // Convert any empty layers to raster layers
        for (let i = selectedLayers.length - 1; i >= 0; i--) {
            const selectedLayer = selectedLayers[i];
            if (selectedLayer.type === 'empty') {
                layerActions.push(
                    new UpdateLayerAction<UpdateRasterLayerOptions>({
                        id: selectedLayer.id,
                        type: 'raster',
                        width,
                        height,
                        data: {
                            sourceUuid: await createStoredImage(createEmptyCanvas(width, height)),
                        },
                    })
                );
            } else if (selectedLayer.type !== 'raster') {
                selectedLayers.splice(i, 1);
            }
        }

        // Finalize layer creation / conversion actions.
        if (layerActions.length > 0) {
            await historyStore.dispatch('runAction', {
                action: new BundleAction('createDrawLayer', 'action.createDrawLayer', layerActions),
                reserveToken: startDrawReserveToken,
            });
        } else {
            await historyStore.dispatch('unreserve', { token: startDrawReserveToken });
        }

        await nextTick();

        // Create a draft image for each of the selected layers
        selectedLayers = getSelectedLayers().filter(layer => layer.type === 'raster');
        this.drawingOnLayers = selectedLayers as WorkingFileAnyLayer[];

        for (const layer of this.drawingOnLayers) {
            await this.renderer?.startBrushStroke({
                layerId: layer.id,
                size: brushSize.value,
                color: new Float16Array([brushColor.value.r, brushColor.value.g, brushColor.value.b, brushColor.value.alpha]),
                hardness: brushHardness.value,
                colorBlendingPersistence: brushColorBlendingPersistence.value,
            });
        }

        // Populate first drawing point
        const transformedPoint = new DOMPoint(
            this.lastCursorX * devicePixelRatio,
            this.lastCursorY * devicePixelRatio
        ).matrixTransform(canvasStore.state.transform.inverse())
        const pressure = this.drawingUsePressure ? Math.min(1, (e.pressure) / (1 - this.pointerPenMaxPressureMargin)) : 1;
        const size = brushSize.value * Math.max(
            brushPressureMinSize.value,
            Math.pow(pressure, brushPressureTaper.value)
        );
        const density = this.calculateDensity(pressure, size);
        const colorBlendingStrength = brushPressureMinColorBlendingStrength.value + (brushColorBlendingStrength.value - brushPressureMinColorBlendingStrength.value) * (1 - pressure);
        const concentration = brushPressureMinConcentration.value + (brushConcentration.value - brushPressureMinConcentration.value) * pressure;
        this.drawingBrushStroke = new BrushStroke(
            brushSmoothing.value,
            brushSpacing.value,
            brushJitter.value,
            {
                x: transformedPoint.x,
                y: transformedPoint.y,
                density,
                colorBlendingStrength,
                concentration,
                size,
                tiltX: 0,
                tiltY: 0,
                twist: 0,
            }
        );

        // Draw first point
        for (const layer of this.drawingOnLayers) {
            this.renderer?.moveBrushStroke(
                layer.id,
                transformedPoint.x,
                transformedPoint.y,
                size,
                density,
                colorBlendingStrength,
                concentration,
            );
        }

        window.requestAnimationFrame(this.drawLoop);
    }

    // lastPoint!: BrushStrokePoint;

    private drawLoop() {
        if (!this.drawingBrushStroke) return;

        const now = performance.now();

        let point: BrushStrokePoint | undefined;
        let count = 0;
        while (this.drawingBrushStroke.hasCollectedPoints()) {
            point = this.drawingBrushStroke.retrieveCatmullRomSegmentPoint();
            if (!point) continue;
            count++;
            this.drawLoopDeltaAccumulator = 0;
            for (const layer of this.drawingOnLayers) {
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
        
        if (now - this.drawLoopLastPointerMoveTimestamp > 25) {
            this.drawLoopDeltaAccumulator += now - this.drawLoopLastRunTimestamp;

            if (this.drawLoopDeltaAccumulator > 16.66) {
                this.drawLoopDeltaAccumulator -= 16.66;
                this.drawingBrushStroke.advanceLine();

                if (this.drawLoopDeltaAccumulator > 16.66 * 6) {
                    this.drawLoopDeltaAccumulator = 0;
                }
            }
        }
        this.drawLoopLastRunTimestamp = now;

        window.requestAnimationFrame(this.drawLoop);
    }

    private async drawEnd(e: PointerEvent) {
        if (this.drawingPointerId === e.pointerId) {
            this.drawingPointerId = null;

            if (this.drawingBrushStroke) {
                this.drawingBrushStroke.finalizeLine();
                let point: BrushStrokePoint | undefined;
                while (this.drawingBrushStroke.hasCollectedPoints()) {
                    point = this.drawingBrushStroke.retrieveCatmullRomSegmentPoint();
                    if (!point) continue;
                    for (const layer of this.drawingOnLayers) {
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
                }
                while (point = this.drawingBrushStroke.retrieveFinalPoints()) {
                    for (const layer of this.drawingOnLayers) {
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
                }
            }

            for (const layer of this.drawingOnLayers) {
                this.renderer?.stopBrushStroke(
                    layer.id,
                );
            }

            const drawingOnLayers = this.drawingOnLayers.slice();
            const updateHistoryStartTimestamp = window.performance.now();
            const draftId = this.activeDraftUuid;

            this.drawingBrushStroke = null;
            this.drawingOnLayers = [];
            this.activeDraftUuid = null;

            const updateLayerReserveToken = createHistoryReserveToken();

            await historyReserveQueueFree();

            await historyStore.dispatch('reserve', { token: updateLayerReserveToken });

            const layerActions: BaseAction[] = [];

            for (const layer of drawingOnLayers) {
                if (layer.type === 'raster') {
                    // TODO - START - This is fairly slow, speed it up?

                    // const layerGlobalTransform = getLayerGlobalTransform(layer);

                    // const layerTransform = new DOMMatrix().multiply(layerGlobalTransform.inverse());

                    // let drawableCanvas = new DrawableCanvas({ forceDrawOnMainThread: true, scale: 1 });
                    let layerUpdateCanvas: HTMLCanvasElement | undefined = undefined;
                    // let sourceX = 0;
                    // let sourceY = 0;
                    // try {
                    //     await drawableCanvas.initialized();
                    //     const brushStrokeUuid = await drawableCanvas.add('brushStroke');
                    //     drawableCanvas.setGlobalAlpha(this.brushColorAlpha);
                    //     await drawableCanvas.draw({
                    //         refresh: true,
                    //         transform: layerTransform,
                    //         updates: [
                    //             {
                    //                 uuid: brushStrokeUuid,
                    //                 data: {
                    //                     color: brushColor.value.style,
                    //                     points,
                    //                     isPointsFinalized: true,
                    //                 } as BrushStrokeData,
                    //             }
                    //         ],
                    //     });
                    //     ({ canvas: layerUpdateCanvas, sourceX, sourceY } = await drawableCanvas.drawComplete());
                    // } catch (error) {
                    //     console.error(error);
                    // }
                    // drawableCanvas.dispose();
                    
                    // if (layerUpdateCanvas) {
                    //     if (activeSelectionMask.value || appliedSelectionMask.value) {
                    //         const layerGlobalTransform = getLayerGlobalTransform(layer.id);
                    //         const layerTransform = new DOMMatrix().multiplySelf(layerGlobalTransform).translateSelf(sourceX, sourceY);
                    //         layerUpdateCanvas = await blitActiveSelectionMask(layerUpdateCanvas, layerTransform);
                    //     }

                    //     const layerUpdateCanvasUuid = await createStoredImage(layerUpdateCanvas);

                    //     layerActions.push(
                    //         new UpdateLayerAction<UpdateRasterLayerOptions>({
                    //             id: layer.id,
                    //             data: {
                    //                 tileUpdates: [{
                    //                     x: sourceX,
                    //                     y: sourceY,
                    //                     sourceUuid: layerUpdateCanvasUuid,
                    //                     mode: 'source-over',
                    //                 }],
                    //             }
                    //         })
                    //     );
                    // }

                    // TODO - END - This is fairly slow, speed it up?
                }
            }

            if (layerActions.length > 0) {
                await historyStore.dispatch('runAction', {
                    action: new BundleAction('updateDrawLayer', 'action.updateDrawLayer', layerActions),
                    reserveToken: updateLayerReserveToken,
                });
            } else {
                await historyStore.dispatch('unreserve', { token: updateLayerReserveToken });
            }
            for (const layer of drawingOnLayers) {
                const draftIndex = layer.drafts?.findIndex((draft) => draft.uuid === draftId) ?? -1;
                if (draftIndex > -1) {
                    layer?.drafts?.splice(draftIndex, 1);
                }
            }
        }
    }

    private calculateDensity(pressure: number, size: number): number {
        const pressureSmoothStep = this.drawingUsePressure ? Math.min(1, 3 * Math.pow(pressure, 2) - 2 * Math.pow(pressure, 3)) : 0.8;
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
