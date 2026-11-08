import { nextTick, watch, WatchStopHandle } from 'vue';

import BaseCanvasMovementController from './base-movement';

import { BrushStroke, type BrushStrokePoint } from '@/lib/brush-stroke';
import appEmitter from '@/lib/emitter';
import { isCtrlKeyPressed } from '@/lib/keyboard';
import { pointDistance2d } from '@/lib/math';
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
    sourceX, sourceY, sourceDrawingOffsetX, sourceDrawingOffsetY, cursorIsHoveringSource,
    brushDensity, brushPressureMinDensity, brushHardness, brushSize, isPreviewingSize,
    brushPressureMinSize, brushPressureTaper, brushSmoothing, brushOpacity,
} from '../store/clone-brush-state';
import {  activeSelectionMask, appliedSelectionMask } from '../store/selection-state';

import type { BaseAction } from '@/actions/base';
import { BundleAction } from '@/actions/bundle';
import { ClearSelectionAction } from '@/actions/clear-selection';
import { DeleteLayersAction } from '@/actions/delete-layers';
import { DeleteLayerSelectionAreaAction } from '@/actions/delete-layer-selection-area';
import { UpdateLayerAction } from '@/actions/update-layer';

import { useRenderer, transferRendererTilesToRasterLayerUpdates } from '@/renderers';

import { RendererBrushStrokeDrawMode } from '@/types/renderer';
import type {
    RendererFrontend, RendererTextureTile, UpdateRasterLayerOptions, WorkingFileAnyLayer,
} from '@/types';

const devicePixelRatio = window.devicePixelRatio || 1;

export default class CanvasCloneBrushController extends BaseCanvasMovementController {

    private selectedLayerIdsUnwatch: WatchStopHandle | null = null;
    private pointerPenMaxPressureMarginUnwatch: WatchStopHandle | null = null;
    private isPreviewingSizeUnwatch: WatchStopHandle | null = null;

    private renderer: RendererFrontend | null = null;

    private clonePointerId: number | null = null;
    private cloneUsePressure: boolean = false;
    private cloneOnLayers: WorkingFileAnyLayer[] = [];
    private cloneBrushStroke: BrushStroke | null = null;
    private cloneStartX: number = 0;
    private cloneStartY: number = 0;
    private isQueueingInput: boolean = false;
    private queuedBrushStrokePoints: Array<BrushStrokePoint> = [];

    private cloneLoopDeltaAccumulator: number = 0;
    private cloneLoopLastRunTimestamp: number = 0;
    private cloneLoopLastPointerMoveTimestamp: number = 0;

    private sourceMovePointerId: number | null = null;
    private sourceMoveStartX: number = 0;
    private sourceMoveStartY: number = 0;
    private sourceLayer: WorkingFileAnyLayer | null = null;

    private pointerPenMaxPressureMargin: number = 0;

    onEnter(): void {
        super.onEnter();

        this.cloneLoop = this.cloneLoop.bind(this);

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
            this.sourceLayer = getSelectedLayers(workingFileStore.state.selectedLayerIds).find((layer) => {
                return layer.type === 'raster';
            }) ?? null;
        }, { immediate: true });

        this.pointerPenMaxPressureMarginUnwatch = watch(() => preferencesStore.state.pointerPenMaxPressureMargin, (pointerPenMaxPressureMargin) => {
            this.pointerPenMaxPressureMargin = pointerPenMaxPressureMargin;
        }, { immediate: true });

        this.isPreviewingSizeUnwatch = watch(() => isPreviewingSize.value, () => {
            cursorHoverPosition.value = new DOMPoint(
                -100000000000,
                -100000000000
            );
        });

        this.onDelete = this.onDelete.bind(this);
        appEmitter.on('editor.tool.delete', this.onDelete);
        this.onSelectAll = this.onSelectAll.bind(this);
        appEmitter.on('editor.tool.selectAll', this.onSelectAll);
        
        cursorHoverPosition.value = new DOMPoint(
            -100000000000,
            -100000000000
        )
        cursorHoverAngle.value = 0;

        // Tutorial message
        if (!editorStore.state.tutorialFlags.cloneBrushToolIntroduction) {
            waitForNoOverlays().then(() => {
                let message = (tm('tutorialTip.cloneBrushToolIntroduction.introduction') as string[]).map((message) => {
                    return `<p class="mb-3!">${rt(message)}</p>`;
                }).join('');
                scheduleTutorialNotification({
                    flag: 'cloneBrushToolIntroduction',
                    title: t('tutorialTip.cloneBrushToolIntroduction.title'),
                    message: {
                        touch: message + (tm('tutorialTip.cloneBrushToolIntroduction.body.touch') as string[]).map((message) => {
                            return `<p class="mb-3!">${rt(message)}</p>`
                        }).join(''),
                        mouse: message + (tm('tutorialTip.cloneBrushToolIntroduction.body.mouse') as string[]).map((message) => {
                            return `<p class="mb-3!">${rt(message)}</p>`
                        }).join(''),
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

        appEmitter.off('editor.tool.delete', this.onDelete);
        appEmitter.off('editor.tool.selectAll', this.onSelectAll);

        for (const layer of getSelectedLayers()) {
            if (layer.type === 'raster') {
                prepareStoredImageForArchival(layer.data.sourceUuid);
            }
        }

        // Tutorial Message
        if (!editorStore.state.tutorialFlags.cloneBrushToolIntroduction) {
            dismissTutorialNotification('cloneBrushToolIntroduction');
        }

        // Block UI changes until history actions have completed
        historyBlockInteractionUntilComplete();
    }

    onPointerDown(e: PointerEvent) {
        super.onPointerDown(e);

        if (!canvasStore.get('ready')) return;

        if (e.pointerType === 'pen' || !editorStore.state.isPenUser) {
            cursorHoverPosition.value = new DOMPoint(
                this.lastCursorX * devicePixelRatio,
                this.lastCursorY * devicePixelRatio
            ).matrixTransform(canvasStore.state.transform.inverse());
            cursorHoverAngle.value = e.twist;
            if (this.sourceLayer) {
                const { width, height, transform: layerTransform } = this.sourceLayer;
                const point = new DOMPoint(
                    width * sourceX.value,
                    height * sourceY.value
                ).matrixTransform(layerTransform);
                if (pointDistance2d(point.x, point.y, cursorHoverPosition.value.x, cursorHoverPosition.value.y) < brushSize.value / 2) {
                    cursorIsHoveringSource.value = true;
                } else {
                    cursorIsHoveringSource.value = false;
                }
            } else {
                cursorIsHoveringSource.value = false;
            }
            this.handleCursorIcon();
            isPreviewingSize.value = false;
        }

        this.isQueueingInput = false;
        const hasPressure = (e.pointerType === 'pen' || e.pointerType === 'touch') && e.pressure !== 0.0 && e.pressure !== 0.5 && e.pressure !== 1.0;
        if (this.clonePointerId == null && e.isPrimary && e.button === 0) {
            if (isCtrlKeyPressed.value) {
                this.setSourceFromCanvasPosition(cursorHoverPosition.value);
            } else if (cursorIsHoveringSource.value) {
                this.sourceMovePointerId = e.pointerId;
                this.sourceMoveStartX = sourceX.value;
                this.sourceMoveStartY = sourceY.value;
            } else if (
                e.pointerType === 'pen' ||
                (!editorStore.state.isPenUser && e.pointerType === 'mouse')
            ) {
                this.clonePointerId = e.pointerId;
                this.cloneUsePressure = hasPressure;
                this.cloneStart(e);
            } else if (e.pointerType === 'touch') {
                this.isQueueingInput = true;
                this.queuedBrushStrokePoints = [];
            }
        }
    }

    onMultiTouchDown() {
        super.onMultiTouchDown();

        if (!canvasStore.get('ready')) return;

        if (this.clonePointerId != null) return;
        if (this.touches.length > 1 && !this.cloneUsePressure) {
            this.clonePointerId = null;
            this.cloneBrushStroke = null;
        } else if (this.touches.length === 1) {
            if (cursorIsHoveringSource.value) {
                this.sourceMovePointerId = this.touches[0].id;
                this.sourceMoveStartX = sourceX.value;
                this.sourceMoveStartY = sourceY.value;
            } else {
                const hasPressure = this.touches[0].down.pressure !== 0.0 && this.touches[0].down.pressure !== 0.5 && this.touches[0].down.pressure !== 1.0;
                this.clonePointerId = this.touches[0].id;
                this.cloneUsePressure = hasPressure;
                this.cloneStart(this.touches[0].down);

                for (const point of this.queuedBrushStrokePoints) {
                    this.cloneBrushStroke?.addPoint(point);
                }
            }
        }
        if (this.isQueueingInput) {
            this.isQueueingInput = false;
            this.queuedBrushStrokePoints = [];
        }
    }

    protected async cloneStart(e: PointerEvent) {
        let selectedLayers = getSelectedLayers().filter(layer => layer.type === 'raster');
        if (selectedLayers.length === 0) {
            appEmitter.emit('app.notify', {
                type: 'info',
                title: t('toolbar.cloneBrush.notification.noSelectedLayers.title'),
                message: t('toolbar.cloneBrush.notification.noSelectedLayers.message'),
                duration: 5000,
            });
            return;
        }

        await nextTick();

        // Start a brush stroke for each of the selected layers
        this.cloneOnLayers = selectedLayers as WorkingFileAnyLayer[];

        for (const layer of this.cloneOnLayers) {
            await this.renderer?.startBrushStroke({
                layerId: layer.id,
                shape: 'circle',
                size: brushSize.value,
                color: new Float16Array([
                    sourceX.value,
                    sourceY.value,
                    1,
                    brushOpacity.value,
                ]),
                hardness: brushHardness.value,
                colorBlendingPersistence: 0,
                drawMode: RendererBrushStrokeDrawMode.CLONE,
            });
        }

        // Populate first drawing point
        const transformedPoint = new DOMPoint(
            this.lastCursorX * devicePixelRatio,
            this.lastCursorY * devicePixelRatio
        ).matrixTransform(canvasStore.state.transform.inverse());

        this.cloneStartX = transformedPoint.x;
        this.cloneStartY = transformedPoint.y;

        sourceDrawingOffsetX.value = 0;
        sourceDrawingOffsetY.value = 0;

        const pressure = this.cloneUsePressure ? Math.min(1, (e.pressure) / (1 - this.pointerPenMaxPressureMargin)) : 1;
        const size = brushSize.value * (
            brushPressureMinSize.value + (1 - brushPressureMinSize.value) * Math.pow(pressure, brushPressureTaper.value)
        );
        const density = this.calculateDensity(pressure, size);
        this.cloneBrushStroke = new BrushStroke(
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
        for (const layer of this.cloneOnLayers) {
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

        window.requestAnimationFrame(this.cloneLoop);
    }

    private setSourceFromCanvasPosition(canvasPosition: DOMPoint) {
        if (!this.sourceLayer) return;
        const sourcePosition = canvasPosition.matrixTransform(
            new DOMMatrix()
                .scaleSelf(1 / this.sourceLayer.width, 1 / this.sourceLayer.height)
                .multiplySelf(this.sourceLayer.transform.inverse())
        )
        sourceX.value = sourcePosition.x;
        sourceY.value = sourcePosition.y;
        cursorIsHoveringSource.value = true;
        this.handleCursorIcon();
    }

    onPointerMove(e: PointerEvent): void {
        super.onPointerMove(e);

        if ((e.pointerType === 'pen' || !editorStore.state.isPenUser) && !isPreviewingSize.value) {
            cursorHoverPosition.value = new DOMPoint(
                this.lastCursorX * devicePixelRatio,
                this.lastCursorY * devicePixelRatio
            ).matrixTransform(canvasStore.state.transform.inverse());
            cursorHoverAngle.value = e.twist;
            if (this.sourceLayer) {
                const { width, height, transform: layerTransform } = this.sourceLayer;
                const point = new DOMPoint(
                    width * sourceX.value,
                    height * sourceY.value
                ).matrixTransform(layerTransform);
                if (pointDistance2d(point.x, point.y, cursorHoverPosition.value.x, cursorHoverPosition.value.y) < brushSize.value / 2) {
                    cursorIsHoveringSource.value = true;
                } else {
                    cursorIsHoveringSource.value = false;
                }
            } else {
                cursorIsHoveringSource.value = false;
            }
            this.handleCursorIcon();
        }

        if (
            this.sourceMovePointerId === e.pointerId
        ) {
            this.sourceMove();
        } else if (
            this.clonePointerId === e.pointerId
            || this.isQueueingInput
        ) {
            const transformedPoint = new DOMPoint(
                this.lastCursorX * devicePixelRatio,
                this.lastCursorY * devicePixelRatio
            ).matrixTransform(canvasStore.state.transform.inverse());

            sourceDrawingOffsetX.value = transformedPoint.x - this.cloneStartX;
            sourceDrawingOffsetY.value = transformedPoint.y - this.cloneStartY;
            
            const pressure = this.cloneUsePressure ? Math.min(1, (e.pressure) / (1 - this.pointerPenMaxPressureMargin)) : 1;
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
                this.cloneBrushStroke?.addPoint(point);
            }
            this.cloneLoopLastPointerMoveTimestamp = performance.now();
        }
    }

    private cloneLoop() {
        if (!this.cloneBrushStroke) return;

        const now = performance.now();

        let point: BrushStrokePoint | undefined;
        let count = 0;
        while (this.cloneBrushStroke.hasCollectedPoints()) {
            point = this.cloneBrushStroke.retrieveCatmullRomSegmentPoint();
            if (!point) continue;
            count++;
            this.cloneLoopDeltaAccumulator = 0;
            for (const layer of this.cloneOnLayers) {
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
        
        if (now - this.cloneLoopLastPointerMoveTimestamp > 25) {
            this.cloneLoopDeltaAccumulator += now - this.cloneLoopLastRunTimestamp;

            if (this.cloneLoopDeltaAccumulator > 16.66) {
                this.cloneLoopDeltaAccumulator -= 16.66;
                this.cloneBrushStroke.advanceLine();

                if (this.cloneLoopDeltaAccumulator > 16.66 * 6) {
                    this.cloneLoopDeltaAccumulator = 0;
                }
            }
        }
        this.cloneLoopLastRunTimestamp = now;

        window.requestAnimationFrame(this.cloneLoop);
    }

    private sourceMove() {
        const pointer = this.pointers.find((pointer) => pointer.down.pointerId === this.sourceMovePointerId);
        if (!pointer?.move || !this.sourceLayer) return;
        const point = new DOMPoint(
            this.sourceLayer.width * this.sourceMoveStartX,
            this.sourceLayer.height * this.sourceMoveStartY,
        ).matrixTransform(
            new DOMMatrix()
                .translateSelf(
                    (pointer.move.x - pointer.down.x) * devicePixelRatio * (1 / canvasStore.state.decomposedTransform.scaleX),
                    (pointer.move.y - pointer.down.y) * devicePixelRatio * (1 / canvasStore.state.decomposedTransform.scaleY),
                )
                .multiplySelf(this.sourceLayer.transform)
        )
        this.setSourceFromCanvasPosition(point);
    }

    async onPointerUpBeforePurge(e: PointerEvent): Promise<void> {
        super.onPointerUpBeforePurge(e);
        const pointer = this.pointers.filter((pointer) => pointer.id === e.pointerId)[0];
        if (pointer == null || pointer.type === 'touch') return;
        this.sourceMoveEnd(e);
        this.cloneEnd(e);
    }

    onMultiTouchUp(): void {
        super.onMultiTouchUp();
        if (this.multiTouchDownCount != 1) return;
        const pointer = this.multiTouchDownTouches[0];
        this.sourceMoveEnd(pointer.up ?? pointer.down);
        this.cloneEnd(pointer.up ?? pointer.down);
    }

    private async cloneEnd(e: PointerEvent) {
        if (this.clonePointerId === e.pointerId) {
            this.clonePointerId = null;

            sourceDrawingOffsetX.value = 0;
            sourceDrawingOffsetY.value = 0;

            const collectedTiles: Array<Promise<Array<RendererTextureTile>>> = [];

            if (this.cloneBrushStroke && this.renderer) {
                this.cloneBrushStroke.finalizeLine();
                let point: BrushStrokePoint | undefined;
                while (this.cloneBrushStroke.hasCollectedPoints()) {
                    point = this.cloneBrushStroke.retrieveCatmullRomSegmentPoint();
                    if (!point) continue;
                    for (const layer of this.cloneOnLayers) {
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
                while (point = this.cloneBrushStroke.retrieveFinalPoints()) {
                    for (const layer of this.cloneOnLayers) {
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

                for (const layer of this.cloneOnLayers) {
                    collectedTiles.push(
                        this.renderer.stopBrushStroke(
                            layer.id,
                        )
                    );
                }
            }

            const cloneOnLayers = this.cloneOnLayers.slice();
            this.cloneBrushStroke = null;
            this.cloneOnLayers = [];

            const updateLayerReserveToken = createHistoryReserveToken();

            await historyReserveQueueFree();

            await historyStore.dispatch('reserve', { token: updateLayerReserveToken });

            const layerActions: BaseAction[] = [];

            for (const [layerIndex, layer] of cloneOnLayers.entries()) {
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
                    action: new BundleAction('updateCloneBrushLayer', 'action.updateCloneBrushLayer', layerActions),
                    reserveToken: updateLayerReserveToken,
                });
            } else {
                await historyStore.dispatch('unreserve', { token: updateLayerReserveToken });
            }
        }
    }

    private sourceMoveEnd(e: PointerEvent) {
        this.sourceMovePointerId = null;
    }

    private async onDelete() {
        if (this.clonePointerId != null) return;
        if (activeSelectionMask.value || appliedSelectionMask.value) {
            await historyStore.dispatch('runAction', {
                action: new DeleteLayerSelectionAreaAction(workingFileStore.state.selectedLayerIds),
            });
        } else if (workingFileStore.state.selectedLayerIds.length > 0) {
            await historyStore.dispatch('runAction', {
                action: new DeleteLayersAction(workingFileStore.state.selectedLayerIds),
            });
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
        return 1;
    }

    protected handleCursorIcon() {
        let newIcon = super.handleCursorIcon();
        if (cursorIsHoveringSource.value) {
            newIcon = 'move';
        }
        canvasStore.set('cursor', newIcon);
        return newIcon;
    }

}
