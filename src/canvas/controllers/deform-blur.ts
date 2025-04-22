import { v4 as uuidv4 } from 'uuid';
import { nextTick, watch, WatchStopHandle } from 'vue';

import BaseCanvasMovementController from './base-movement';
import { cursorHoverPosition, brushShape, brushSize } from '../store/deform-blur-state';
import { blitActiveSelectionMask, activeSelectionMask, appliedSelectionMask } from '../store/selection-state';

import { isOffscreenCanvasSupported } from '@/lib/feature-detection';
import { dismissTutorialNotification, scheduleTutorialNotification, waitForNoOverlays } from '@/lib/tutorial';
import { createImageFromBlob, createEmptyCanvasWith2dContext, cloneCanvas } from '@/lib/image';
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
import type { BlurStrokeData } from '@/canvas/drawables/blur-stroke';

const devicePixelRatio = window.devicePixelRatio || 1;

export default class CanvasDeformBlurController extends BaseCanvasMovementController {

    private brushShapeUnwatch: WatchStopHandle | null = null;
    private brushSizeUnwatch: WatchStopHandle | null = null;
    private selectedLayerIdsUnwatch: WatchStopHandle | null = null;

    private blurringPointerId: number | null = null;
    private blurringOnLayers: WorkingFileAnyLayer[] = [];
    private blurringPoints: DOMPoint[] = [];
    private previewDestinationCanvas: HTMLCanvasElement | null = null;
    private previewDestinationCanvasTransform: DOMMatrix | null = null;

    private activeDraftUuid: string | null = null;
    private drawablePreviewCanvas: DrawableCanvas | null = null;
    private blurStrokeDrawableUuid: string | null = null;

    private brushShapeImage: HTMLImageElement | null = null;

    onEnter(): void {
        super.onEnter();

        isOffscreenCanvasSupported().then((isSupported) => {
            isSupported && prepareTextureCompositor();
        });

        this.drawablePreviewCanvas = new DrawableCanvas({
            scale: 1,
            forceDrawOnMainThread: true, // TODO - remove this!!!!
        });
        this.drawablePreviewCanvas.onDrawn(async (event) => {
            if (this.activeDraftUuid == null) return;
            for (const layer of this.blurringOnLayers) {
                const draftIndex = layer.drafts?.findIndex((draft) => draft.uuid === this.activeDraftUuid) ?? -1;
                if (!layer.drafts?.[draftIndex]) continue;
                if (layer.type !== 'raster') continue;

                // const { logicalWidth, logicalHeight, width, height } = layer.drafts[draftIndex];

                // // Transform layer content to the view of the draft preview
                // const draftTransform = new DOMMatrix()
                //     .scaleSelf(logicalWidth / width, logicalHeight / height)
                //     .multiplySelf(layer.transform);

                // // Draw current layer on draft preview
                // const { canvas: draftCanvas, ctx: draftCtx } = createEmptyCanvasWith2dContext(event.canvas.width, event.canvas.height);
                // if (!draftCtx) continue;
                // draftCtx.globalCompositeOperation = 'copy';
                // draftCtx.save();
                // draftCtx.translate(-event.sourceX, -event.sourceY);
                // draftCtx.transform(draftTransform.a, draftTransform.b, draftTransform.c, draftTransform.d, draftTransform.e, draftTransform.f);
                // draftCtx.drawImage(getStoredImageOrCanvas(layer.data.sourceUuid)!, 0, 0);
                // draftCtx.restore();
                // draftCtx.globalCompositeOperation = 'destination-out';
                // draftCtx.drawImage(event.canvas, 0, 0);
                // draftCtx.globalCompositeOperation = 'source-over';

                const canvasUuid = await createStoredImage(event.canvas);

                layer.drafts[draftIndex].tileUpdates.push({
                    x: event.sourceX,
                    y: event.sourceY,
                    sourceUuid: canvasUuid,
                });
                layer.drafts[draftIndex].lastUpdateTimestamp = window.performance.now();
            }
            canvasStore.set('dirty', true);
        });
        this.drawablePreviewCanvas.add<BlurStrokeData>('blurStroke', { smoothing: 1 }).then((uuid) => {
            this.blurStrokeDrawableUuid = uuid;
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
        if (!editorStore.state.tutorialFlags.deformBlurToolIntroduction) {
            waitForNoOverlays().then(() => {
                let message = (tm('tutorialTip.deformBlurToolIntroduction.introduction') as string[]).map((message) => {
                    return `<p class="mb-3">${rt(message)}</p>`;
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
        }

        if (
            this.blurringPointerId == null && e.isPrimary && e.button === 0 &&
            (
                e.pointerType === 'pen' ||
                e.pointerType === 'touch' ||
                (!editorStore.state.isPenUser && e.pointerType === 'mouse')
            )
        ) {
            this.blurringPointerId = e.pointerId;
            this.blurStart();
        }
    }

    onMultiTouchDown() {
        super.onMultiTouchDown();
        if (this.touches.length > 1) {
            this.blurringPointerId = null;
            this.blurringPoints = [];
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
            this.blurringPointerId === e.pointerId
        ) {
            this.blurringPoints.push(
                new DOMPoint(
                    this.lastCursorX * devicePixelRatio,
                    this.lastCursorY * devicePixelRatio
                ).matrixTransform(canvasStore.state.transform.inverse())
            );

            this.blurPreview();
        }
    }

    async onPointerUpBeforePurge(e: PointerEvent): Promise<void> {
        super.onPointerUpBeforePurge(e);

        this.blurEnd(e);
    }

    protected async blurStart() {
        let selectedLayers = getSelectedLayers().filter((layer) => layer.type === 'raster');
        if (selectedLayers.length === 0) {
            return;
        }

        await nextTick();

        // Create a draft image for each of the selected layers
        selectedLayers = getSelectedLayers();
        this.blurringOnLayers = selectedLayers as WorkingFileAnyLayer[];
        this.previewDestinationCanvas = null;
        this.previewDestinationCanvasTransform = null;
        for (const layer of this.blurringOnLayers) {
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
                draftCtx.save();
                draftCtx.translate(-leftBound, -topBound);
                draftCtx.transform(draftTransform.a, draftTransform.b, draftTransform.c, draftTransform.d, draftTransform.e, draftTransform.f);
                const sourceImage = getStoredImageOrCanvas(layer.data.sourceUuid)!;
                draftCtx.imageSmoothingEnabled = true;
                draftCtx.drawImage(sourceImage, 0, 0);
                draftCtx.restore();

                this.previewDestinationCanvas = draftCanvas;
                this.previewDestinationCanvasTransform = new DOMMatrix()
                    .scaleSelf(width / logicalWidth, height / logicalHeight)
                    .translateSelf(leftBound, topBound);

                const draftCanvasUuid = await createStoredImage(draftCanvas);

                layer.drafts.push({
                    uuid: this.activeDraftUuid,
                    lastUpdateTimestamp: window.performance.now(),
                    width,
                    height,
                    logicalWidth,
                    logicalHeight,
                    mode: 'source-over',
                    transform: layerGlobalTransformSelfExcluded.inverse(),
                    tileUpdates: [{
                        x: leftBound,
                        y: topBound,
                        sourceUuid: draftCanvasUuid,
                    }],
                });
            }
        }

        // Populate first drawing point
        this.blurringPoints = [
            new DOMPoint(
                this.lastCursorX * devicePixelRatio,
                this.lastCursorY * devicePixelRatio
            ).matrixTransform(canvasStore.state.transform.inverse())
        ];

        // Generate draw preview
        this.blurPreview(true);
    }

    private blurPreview(refresh = false) {
        if (
            this.blurringOnLayers.length > 0 &&
            this.brushShapeImage &&
            this.previewDestinationCanvas &&
            this.previewDestinationCanvasTransform
        ) {

            const points = this.blurringPoints;

            const previewRatioX = Math.min(1, canvasStore.get('decomposedTransform').scaleX);
  
            // Draw the line to each canvas chunk
            // TODO - need to do this per selected layer
            this.drawablePreviewCanvas?.setScale(previewRatioX);
            this.drawablePreviewCanvas?.draw({
                refresh,
                destinationCanvas: this.previewDestinationCanvas,
                destinationCanvasTransform: this.previewDestinationCanvasTransform,
                updates: [
                    {
                        uuid: this.blurStrokeDrawableUuid!,
                        data: {
                            points: points.map(point => ({
                                x: point.x,
                                y: point.y,
                                size: brushSize.value,
                                tiltX: 0,
                                tiltY: 0,
                                twist: 0,
                            }))
                        } as BlurStrokeData,
                    }
                ],
            });
        }
    }

    private async blurEnd(e: PointerEvent) {
        if (this.blurringPointerId === e.pointerId) {
            const points = this.blurringPoints.slice();
            const blurringOnLayers = this.blurringOnLayers.slice();
            const draftId = this.activeDraftUuid;

            this.blurringPoints = [];
            this.blurringOnLayers = [];
            this.blurringPointerId = null;
            this.activeDraftUuid = null;
            this.previewDestinationCanvas = null;
            this.previewDestinationCanvasTransform = null;

            const updateLayerReserveToken = createHistoryReserveToken();

            await historyReserveQueueFree();

            await historyStore.dispatch('reserve', { token: updateLayerReserveToken });

            const layerActions: BaseAction[] = [];

            for (const layer of blurringOnLayers) {
                if (layer.type === 'raster') {

                    const layerGlobalTransform = getLayerGlobalTransform(layer);

                    const layerTransform = new DOMMatrix().multiply(layerGlobalTransform.inverse());

                    let drawableCanvas = new DrawableCanvas({ forceDrawOnMainThread: true, scale: 1 });
                    let layerUpdateCanvas: HTMLCanvasElement | undefined = undefined;
                    let sourceX = 0;
                    let sourceY = 0;
                    try {
                        await drawableCanvas.initialized();
                        const blurStrokeUuid = await drawableCanvas.add('blurStroke');
                        await drawableCanvas.draw({
                            refresh: true,
                            transform: layerTransform,
                            updates: [
                                {
                                    uuid: blurStrokeUuid,
                                    data: {
                                        points: points.map(point => ({
                                            x: point.x,
                                            y: point.y,
                                            size: brushSize.value,
                                            tiltX: 0,
                                            tiltY: 0,
                                            twist: 0,
                                        }))
                                    } as BlurStrokeData,
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

                        const { canvas: blurCanvas, ctx: blurCtx } = createEmptyCanvasWith2dContext(layerUpdateCanvas.width, layerUpdateCanvas.height);
                        if (!blurCtx) continue;
                        blurCtx.globalCompositeOperation = 'copy';
                        blurCtx.drawImage(getStoredImageOrCanvas(layer.data.sourceUuid)!, -sourceX, -sourceY);
                        blurCtx.globalCompositeOperation = 'destination-out';
                        blurCtx.drawImage(layerUpdateCanvas, 0, 0);
                        blurCtx.globalCompositeOperation = 'source-over';
                        layerUpdateCanvas = blurCanvas;

                        const layerUpdateCanvasUuid = await createStoredImage(layerUpdateCanvas);

                        layerActions.push(
                            new UpdateLayerAction<UpdateRasterLayerOptions>({
                                id: layer.id,
                                data: {
                                    tileUpdates: [{
                                        x: sourceX,
                                        y: sourceY,
                                        sourceUuid: layerUpdateCanvasUuid,
                                        mode: 'replace',
                                    }],
                                }
                            })
                        );
                    }

                }
            }

            if (layerActions.length > 0) {
                await historyStore.dispatch('runAction', {
                    action: new BundleAction('updateDeformBlurLayer', 'action.updateDeformBlurLayer', layerActions),
                    reserveToken: updateLayerReserveToken,
                });
            } else {
                await historyStore.dispatch('unreserve', { token: updateLayerReserveToken });
            }
            for (const layer of blurringOnLayers) {
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
