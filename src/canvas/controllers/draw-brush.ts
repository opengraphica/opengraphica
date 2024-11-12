import { v4 as uuidv4 } from 'uuid';
import { markRaw, nextTick, watch, WatchStopHandle } from 'vue';

import BaseCanvasMovementController from './base-movement';
import {
    cursorHoverPosition, brushShape, brushColor, brushSize, brushMinDensity, brushMaxDensity,
} from '../store/draw-brush-state';
import { blitActiveSelectionMask, activeSelectionMask, appliedSelectionMask } from '../store/selection-state';

import { isOffscreenCanvasSupported } from '@/lib/feature-detection';
import { dismissTutorialNotification, scheduleTutorialNotification, waitForNoOverlays } from '@/lib/tutorial';
import { createImageFromBlob, createEmptyCanvas } from '@/lib/image';
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
import type { BrushStrokeData, BrushStrokePoint } from '@/canvas/drawables/brush-stroke';

const devicePixelRatio = window.devicePixelRatio || 1;

export default class CanvasDrawBrushController extends BaseCanvasMovementController {

    private brushShapeUnwatch: WatchStopHandle | null = null;
    private brushSizeUnwatch: WatchStopHandle | null = null;
    private selectedLayerIdsUnwatch: WatchStopHandle | null = null;

    private drawingPointerId: number | null = null;
    private drawingOnLayers: WorkingFileAnyLayer[] = [];
    private drawingPoints: BrushStrokePoint[] = [];

    private activeDraftUuid: string | null = null;
    private drawablePreviewCanvas: DrawableCanvas | null = null;
    private brushStrokeDrawableUuid: string | null = null;

    private brushShapeImage: HTMLImageElement | null = null;
    private brushPreviewUpdate: BrushStrokeData | null = null;
    private brushColorStyle: string = '#000000';
    private brushColorAlpha: number = 1;

    onEnter(): void {
        super.onEnter();

        isOffscreenCanvasSupported().then((isSupported) => {
            isSupported && prepareTextureCompositor();
        });

        this.drawablePreviewCanvas = new DrawableCanvas({ scale: 1 });
        this.drawablePreviewCanvas.initialized().then(() => console.log('Drawable preview initialized.'));
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
        this.drawablePreviewCanvas.add<BrushStrokeData>('brushStroke', { smoothing: 1 }).then((uuid) => {
            this.brushStrokeDrawableUuid = uuid;
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

        this.drawablePreviewCanvas?.dispose();
        this.drawablePreviewCanvas = null;

        this.brushShapeUnwatch?.();
        this.brushShapeUnwatch = null;
        this.brushSizeUnwatch?.();
        this.brushSizeUnwatch = null;
        this.selectedLayerIdsUnwatch?.();
        this.selectedLayerIdsUnwatch = null;

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
            this.drawingPoints = [];
            (async () => {
                await historyReserveQueueFree();
                for (const layer of getSelectedLayers()) {
                    layer.drafts = [];
                }
            })();
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
            const transformedPoint = new DOMPoint(
                this.lastCursorX * devicePixelRatio,
                this.lastCursorY * devicePixelRatio
            ).matrixTransform(canvasStore.state.transform.inverse());
            this.drawingPoints.push({
                x: transformedPoint.x,
                y: transformedPoint.y,
                size: brushSize.value,
                tiltX: e.tiltX,
                tiltY: e.tiltY,
                twist: e.twist,
            });

            this.drawPreview();
        }
    }

    async onPointerUpBeforePurge(e: PointerEvent): Promise<void> {
        super.onPointerUpBeforePurge(e);

        this.drawEnd(e);
    }

    protected async drawStart() {
        // Create layer if one does not exist
        const startDrawReserveToken = createHistoryReserveToken();
        await historyStore.dispatch('reserve', { token: startDrawReserveToken });

        const { width, height } = workingFileStore.state;
        let selectedLayers = getSelectedLayers().filter(layer => layer.type === 'raster' || layer.type === 'empty');
        let layerActions = [];
        // Insert gradient layer if none selected
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
            const layerGlobalTransformSelfExcluded = getLayerGlobalTransform(layer, { excludeSelf: true });
            const viewTransform = canvasStore.get('decomposedTransform');
            const width = workingFileStore.get('width');
            const height = workingFileStore.get('height');
            const logicalWidth = Math.min(width, workingFileStore.get('width') * viewTransform.scaleX);
            const logicalHeight = Math.min(height, workingFileStore.get('height') * viewTransform.scaleY);
            if (layer.type === 'raster') {
                if (!layer.drafts) layer.drafts = [];
                this.activeDraftUuid = uuidv4();
                layer.drafts.push({
                    uuid: this.activeDraftUuid,
                    lastUpdateTimestamp: window.performance.now(),
                    mode: 'source-over',
                    width,
                    height,
                    logicalWidth,
                    logicalHeight,
                    transform: layerGlobalTransformSelfExcluded.inverse(),
                    updateChunks: [],
                });
            }
        }

        // Populate first drawing point
        const transformedPoint = new DOMPoint(
            this.lastCursorX * devicePixelRatio,
            this.lastCursorY * devicePixelRatio
        ).matrixTransform(canvasStore.state.transform.inverse())
        this.drawingPoints = markRaw([
            {
                x: transformedPoint.x,
                y: transformedPoint.y,
                size: brushSize.value,
                tiltX: 0,
                tiltY: 0,
                twist: 0,
            }
        ]);

        this.brushPreviewUpdate = markRaw({
            color: this.brushColorStyle,
            points: this.drawingPoints,
            isPointsFinalized: false,
        });
        this.drawablePreviewCanvas?.setGlobalAlpha(this.brushColorAlpha);

        // Generate draw preview
        this.drawPreview(true);
    }

    private drawPreview(refresh = false) {
        if (this.drawingOnLayers.length > 0 && this.brushShapeImage && this.brushPreviewUpdate) {

            const points = this.drawingPoints;

            const previewRatioX = Math.min(1, canvasStore.get('decomposedTransform').scaleX);
  
            // Draw the line to each canvas chunk

            this.drawablePreviewCanvas?.setScale(previewRatioX);
            this.drawablePreviewCanvas?.draw({
                refresh,
                updates: [
                    {
                        uuid: this.brushStrokeDrawableUuid!,
                        data: this.brushPreviewUpdate,
                    }
                ],
            });
        }
    }

    private async drawEnd(e: PointerEvent) {
        if (this.drawingPointerId === e.pointerId) {
            if (this.brushPreviewUpdate) {
                this.brushPreviewUpdate.isPointsFinalized = true;
            }
            this.drawPreview(false);

            const points = this.drawingPoints.slice();
            const drawingOnLayers = this.drawingOnLayers.slice();
            const updateHistoryStartTimestamp = window.performance.now();
            const draftId = this.activeDraftUuid;

            this.drawingPoints = [];
            this.drawingOnLayers = [];
            this.drawingPointerId = null;
            this.activeDraftUuid = null;

            const updateLayerReserveToken = createHistoryReserveToken();

            await historyReserveQueueFree();

            await historyStore.dispatch('reserve', { token: updateLayerReserveToken });

            const layerActions: BaseAction[] = [];

            for (const layer of drawingOnLayers) {
                if (layer.type === 'raster') {
                    // TODO - START - This is fairly slow, speed it up?

                    const layerGlobalTransform = getLayerGlobalTransform(layer);

                    const layerTransform = new DOMMatrix().multiply(layerGlobalTransform.inverse());

                    let drawableCanvas = new DrawableCanvas({ forceDrawOnMainThread: true, scale: 1 });
                    let layerUpdateCanvas: HTMLCanvasElement | undefined = undefined;
                    let sourceX = 0;
                    let sourceY = 0;
                    try {
                        await drawableCanvas.initialized();
                        const brushStrokeUuid = await drawableCanvas.add('brushStroke');
                        drawableCanvas.setGlobalAlpha(this.brushColorAlpha);
                        await drawableCanvas.draw({
                            refresh: true,
                            transform: layerTransform,
                            updates: [
                                {
                                    uuid: brushStrokeUuid,
                                    data: {
                                        color: brushColor.value.style,
                                        points,
                                        isPointsFinalized: true,
                                    } as BrushStrokeData,
                                }
                            ],
                        });
                        ({ canvas: layerUpdateCanvas, sourceX, sourceY } = await drawableCanvas.drawComplete());
                    } catch (error) {
                        console.error(error);
                    }
                    drawableCanvas.dispose();
                    
                    if (layerUpdateCanvas) {
                        if (activeSelectionMask.value || appliedSelectionMask.value) {
                            const layerGlobalTransform = getLayerGlobalTransform(layer.id);
                            const layerTransform = new DOMMatrix().multiplySelf(layerGlobalTransform).translateSelf(sourceX, sourceY);
                            layerUpdateCanvas = await blitActiveSelectionMask(layerUpdateCanvas, layerTransform);
                        }

                        layerActions.push(
                            new UpdateLayerAction<UpdateRasterLayerOptions>({
                                id: layer.id,
                                data: {
                                    updateChunks: [{
                                        x: sourceX,
                                        y: sourceY,
                                        data: layerUpdateCanvas,
                                        mode: 'source-over',
                                    }],
                                }
                            })
                        );
                    }

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

    protected handleCursorIcon() {
        let newIcon = super.handleCursorIcon();
        canvasStore.set('cursor', newIcon);
        return newIcon;
    }
}
