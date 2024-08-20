import { v4 as uuidv4 } from 'uuid';
import { nextTick, watch, WatchStopHandle } from 'vue';

import BaseCanvasMovementController from './base-movement';
import { cursorHoverPosition, brushShape, brushSize } from '../store/erase-brush-state';
import { blitActiveSelectionMask, activeSelectionMask, appliedSelectionMask } from '../store/selection-state';

import { decomposeMatrix } from '@/lib/dom-matrix';
import { isOffscreenCanvasSupported } from '@/lib/feature-detection';
import { dismissTutorialNotification, scheduleTutorialNotification, waitForNoOverlays } from '@/lib/tutorial';
import { createImageFromBlob, createEmptyCanvasWith2dContext } from '@/lib/image';
import { findPointListBounds } from '@/lib/math';
import { t, tm, rt } from '@/i18n';

import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import { getStoredImageOrCanvas, createStoredImage, prepareStoredImageForArchival, prepareStoredImageForEditing, getStoredImageCanvas } from '@/store/image';
import historyStore, { createHistoryReserveToken, historyReserveQueueFree, historyBlockInteractionUntilComplete } from '@/store/history';
import workingFileStore, { getSelectedLayers, getLayerById, getLayerGlobalTransform } from '@/store/working-file';

import DrawableCanvas from '@/canvas/renderers/drawable/canvas';
import { prepareTextureCompositor } from '@/workers/texture-compositor.interface';

import type { BaseAction } from '@/actions/base';
import { BundleAction } from '@/actions/bundle';
import { UpdateLayerAction } from '@/actions/update-layer';

import type { UpdateRasterLayerOptions, WorkingFileAnyLayer } from '@/types';
import type { BrushStrokeData } from '@/canvas/drawables/brush-stroke';

const devicePixelRatio = window.devicePixelRatio || 1;

export default class CanvasEraseController extends BaseCanvasMovementController {

    private brushShapeUnwatch: WatchStopHandle | null = null;
    private brushSizeUnwatch: WatchStopHandle | null = null;
    private selectedLayerIdsUnwatch: WatchStopHandle | null = null;

    private erasingPointerId: number | null = null;
    private erasingOnLayers: WorkingFileAnyLayer[] = [];
    private erasingPoints: DOMPoint[] = [];

    private activeDraftUuid: string | null = null;
    private drawablePreviewCanvas: DrawableCanvas | null = null;
    private brushStrokeDrawableUuid: string | null = null;

    private brushShapeImage: HTMLImageElement | null = null;

    onEnter(): void {
        super.onEnter();

        super.onEnter();

        isOffscreenCanvasSupported().then((isSupported) => {
            isSupported && prepareTextureCompositor();
        });

        this.drawablePreviewCanvas = new DrawableCanvas({ scale: 1 });
        this.drawablePreviewCanvas.onDrawn((event) => {
            if (this.activeDraftUuid == null) return;
            for (const layer of this.erasingOnLayers) {
                const draftIndex = layer.drafts?.findIndex((draft) => draft.uuid === this.activeDraftUuid) ?? -1;
                if (!layer.drafts?.[draftIndex]) continue;
                if (layer.type !== 'raster') continue;

                const { logicalWidth, logicalHeight, width, height } = layer.drafts[draftIndex];

                // Transform layer content to the view of the draft preview
                const draftTransform = new DOMMatrix()
                    .scaleSelf(logicalWidth / width, logicalHeight / height)
                    .multiplySelf(layer.transform);

                // Draw current layer on draft preview
                const { canvas: draftCanvas, ctx: draftCtx } = createEmptyCanvasWith2dContext(event.canvas.width, event.canvas.height);
                if (!draftCtx) continue;
                draftCtx.globalCompositeOperation = 'copy';
                draftCtx.save();
                draftCtx.translate(-event.sourceX, -event.sourceY);
                draftCtx.transform(draftTransform.a, draftTransform.b, draftTransform.c, draftTransform.d, draftTransform.e, draftTransform.f);
                draftCtx.drawImage(getStoredImageOrCanvas(layer.data.sourceUuid)!, 0, 0);
                draftCtx.restore();
                draftCtx.globalCompositeOperation = 'destination-out';
                draftCtx.drawImage(event.canvas, 0, 0);
                draftCtx.globalCompositeOperation = 'source-over';

                layer.drafts[draftIndex].updateChunks.push({
                    x: event.sourceX,
                    y: event.sourceY,
                    data: draftCanvas,
                    mode: 'replace',
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

        this.brushShapeUnwatch = watch([brushShape], async ([brushShape]) => {
            if (this.brushShapeImage) {
                URL.revokeObjectURL(this.brushShapeImage.src);
                this.brushShapeImage = null;
            }
            const svg = `
                <svg xmlns="http://www.w3.org/2000/svg"
                    width="3"
                    height="3"
                    viewBox="-1 -1 3 3">
                    <path d="${brushShape}" fill="#000000" />
                </svg>`;
            this.brushShapeImage = await createImageFromBlob(new Blob([svg], { type: 'image/svg+xml' }));
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

        if (
            this.erasingPointerId == null && e.isPrimary && e.button === 0 &&
            (
                e.pointerType === 'pen' ||
                e.pointerType === 'touch' ||
                (!editorStore.state.isPenUser && e.pointerType === 'mouse')
            )
        ) {
            this.erasingPointerId = e.pointerId;
            this.eraseStart();
        }
    }

    onMultiTouchDown() {
        super.onMultiTouchDown();
        if (this.touches.length > 1) {
            this.erasingPointerId = null;
            this.erasingPoints = [];
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
            this.erasingPointerId === e.pointerId
        ) {
            this.erasingPoints.push(
                new DOMPoint(
                    this.lastCursorX * devicePixelRatio,
                    this.lastCursorY * devicePixelRatio
                ).matrixTransform(canvasStore.state.transform.inverse())
            );

            this.erasePreview();
        }
    }

    async onPointerUpBeforePurge(e: PointerEvent): Promise<void> {
        super.onPointerUpBeforePurge(e);

        this.eraseEnd(e);
    }

    protected async eraseStart() {
        let selectedLayers = getSelectedLayers().filter((layer) => layer.type === 'raster');
        if (selectedLayers.length === 0) {
            return;   
        }

        await nextTick();

        // Create a draft image for each of the selected layers
        selectedLayers = getSelectedLayers();
        this.erasingOnLayers = selectedLayers as WorkingFileAnyLayer[];
        for (const layer of this.erasingOnLayers) {
            const layerGlobalTransformSelfExcluded = getLayerGlobalTransform(layer, { excludeSelf: true });
            const viewTransform = canvasStore.get('decomposedTransform');
            const width = workingFileStore.get('width');
            const height = workingFileStore.get('height');
            const logicalWidth = Math.min(width, workingFileStore.get('width') * viewTransform.scaleX);
            const logicalHeight = Math.min(height, workingFileStore.get('height') * viewTransform.scaleY);
            if (layer.type === 'raster') {
                if (!layer.drafts) layer.drafts = [];
                this.activeDraftUuid = uuidv4();

                // Transform layer content to the view of the draft preview
                const draftTransform = new DOMMatrix()
                    .scaleSelf(logicalWidth / width, logicalHeight / height)
                    .multiplySelf(layer.transform);
                const transformedLayerBounds = findPointListBounds([
                    new DOMPoint(0, 0).matrixTransform(draftTransform),
                    new DOMPoint(layer.width, 0).matrixTransform(draftTransform),
                    new DOMPoint(0, layer.height).matrixTransform(draftTransform),
                    new DOMPoint(layer.width, layer.height).matrixTransform(draftTransform),
                ]);
                const leftBound = Math.max(0, transformedLayerBounds.left);
                const topBound = Math.max(0, transformedLayerBounds.top);
                const rightBound = Math.min(logicalWidth, transformedLayerBounds.right);
                const bottomBound = Math.min(logicalHeight, transformedLayerBounds.bottom);

                // Draw current layer on draft preview
                const { canvas: draftCanvas, ctx: draftCtx } = createEmptyCanvasWith2dContext(
                    rightBound - leftBound, bottomBound - topBound
                );
                if (!draftCtx) continue;
                draftCtx.translate(-leftBound, -topBound);
                draftCtx.transform(draftTransform.a, draftTransform.b, draftTransform.c, draftTransform.d, draftTransform.e, draftTransform.f);
                const sourceImage = getStoredImageOrCanvas(layer.data.sourceUuid)!;
                draftCtx.imageSmoothingEnabled = true;
                draftCtx.drawImage(sourceImage, 0, 0);

                layer.drafts.push({
                    uuid: this.activeDraftUuid,
                    lastUpdateTimestamp: window.performance.now(),
                    width,
                    height,
                    logicalWidth,
                    logicalHeight,
                    mode: 'replace',
                    transform: layerGlobalTransformSelfExcluded.inverse(),
                    updateChunks: [{
                        x: leftBound,
                        y: topBound,
                        data: draftCanvas,
                        mode: 'replace',
                    }],
                });
            }
        }

        // Populate first drawing point
        this.erasingPoints = [
            new DOMPoint(
                this.lastCursorX * devicePixelRatio,
                this.lastCursorY * devicePixelRatio
            ).matrixTransform(canvasStore.state.transform.inverse())
        ];

        // Generate draw preview
        this.erasePreview(true);
    }

    private erasePreview(refresh = false) {
        if (this.erasingOnLayers.length > 0 && this.brushShapeImage) {

            const points = this.erasingPoints;

            const previewRatioX = Math.min(1, canvasStore.get('decomposedTransform').scaleX);
  
            // Draw the line to each canvas chunk

            this.drawablePreviewCanvas?.setScale(previewRatioX);
            this.drawablePreviewCanvas?.draw({
                refresh,
                updates: [
                    {
                        uuid: this.brushStrokeDrawableUuid!,
                        data: {
                            color: '#000000',
                            points: points.map(point => ({
                                x: point.x,
                                y: point.y,
                                size: brushSize.value,
                                tiltX: 0,
                                tiltY: 0,
                                twist: 0,
                            }))
                        } as BrushStrokeData,
                    }
                ],
            });
        }
    }

    private async eraseEnd(e: PointerEvent) {
        if (this.erasingPointerId === e.pointerId) {
            const points = this.erasingPoints.slice();
            const erasingOnLayers = this.erasingOnLayers.slice();
            const updateHistoryStartTimestamp = window.performance.now();
            const draftId = this.activeDraftUuid;

            this.erasingPoints = [];
            this.erasingOnLayers = [];
            this.erasingPointerId = null;
            this.activeDraftUuid = null;

            const updateLayerReserveToken = createHistoryReserveToken();

            await historyReserveQueueFree();

            await historyStore.dispatch('reserve', { token: updateLayerReserveToken });

            const layerActions: BaseAction[] = [];

            for (const layer of erasingOnLayers) {
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
                        await drawableCanvas.draw({
                            refresh: true,
                            transform: layerTransform,
                            updates: [
                                {
                                    uuid: brushStrokeUuid,
                                    data: {
                                        color: '#000000',
                                        points: points.map(point => ({
                                            x: point.x,
                                            y: point.y,
                                            size: brushSize.value,
                                            tiltX: 0,
                                            tiltY: 0,
                                            twist: 0,
                                        }))
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

                        const { canvas: eraseCanvas, ctx: eraseCtx } = createEmptyCanvasWith2dContext(layerUpdateCanvas.width, layerUpdateCanvas.height);
                        if (!eraseCtx) continue;
                        eraseCtx.globalCompositeOperation = 'copy';
                        eraseCtx.drawImage(getStoredImageOrCanvas(layer.data.sourceUuid)!, -sourceX, -sourceY);
                        eraseCtx.globalCompositeOperation = 'destination-out';
                        eraseCtx.drawImage(layerUpdateCanvas, 0, 0);
                        eraseCtx.globalCompositeOperation = 'source-over';
                        layerUpdateCanvas = eraseCanvas;

                        layerActions.push(
                            new UpdateLayerAction<UpdateRasterLayerOptions>({
                                id: layer.id,
                                data: {
                                    updateChunks: [{
                                        x: sourceX,
                                        y: sourceY,
                                        data: layerUpdateCanvas,
                                        mode: 'replace',
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
                    action: new BundleAction('updateEraseLayer', 'action.updateEraseLayer', layerActions),
                    reserveToken: updateLayerReserveToken,
                });
            } else {
                await historyStore.dispatch('unreserve', { token: updateLayerReserveToken });
            }
            for (const layer of erasingOnLayers) {
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
