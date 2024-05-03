import { nextTick, watch, WatchStopHandle } from 'vue';
import { Bezier } from 'bezier-js';

import { PointerTracker } from './base';
import BaseCanvasMovementController from './base-movement';
import { cursorHoverPosition, brushShape, brushColor, brushSize } from '../store/draw-state';

import { decomposeMatrix } from '@/lib/dom-matrix';
import { isCtrlOrMetaKeyPressed } from '@/lib/keyboard';
import { dismissTutorialNotification, scheduleTutorialNotification, waitForNoOverlays } from '@/lib/tutorial';
import { createEmptyImage, createImageFromBlob, createEmptyCanvas, createEmptyCanvasWith2dContext } from '@/lib/image';
import { pointDistance2d, nearestPowerOf2 } from '@/lib/math';

import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import { getStoredImageOrCanvas, createStoredImage, prepareStoredImageForArchival, prepareStoredImageForEditing } from '@/store/image';
import historyStore, { createHistoryReserveToken, historyReserveQueueFree } from '@/store/history';
import workingFileStore, { getSelectedLayers, getLayerById, getLayerGlobalTransform } from '@/store/working-file';

import DrawableCanvas from '@/canvas/renderers/drawable/canvas';

import type { BaseAction } from '@/actions/base';
import { BundleAction } from '@/actions/bundle';
import { InsertLayerAction } from '@/actions/insert-layer';
import { UpdateLayerAction } from '@/actions/update-layer';

import type { InsertRasterLayerOptions, UpdateRasterLayerOptions, WorkingFileAnyLayer } from '@/types';
import type { BrushStrokeData } from '@/canvas/drawables/brush-stroke';

const devicePixelRatio = window.devicePixelRatio || 1;

export default class CanvasZoomController extends BaseCanvasMovementController {

    private brushShapeUnwatch: WatchStopHandle | null = null;
    private brushSizeUnwatch: WatchStopHandle | null = null;
    private ctrlKeyUnwatch: WatchStopHandle | null = null;
    private selectedLayerIdsUnwatch: WatchStopHandle | null = null;

    private drawingDraftChunkSize: number = 64;
    private drawingDraftCanvases: HTMLCanvasElement[] = [];
    private drawingPointerId: number | null = null;
    private drawingOnLayers: WorkingFileAnyLayer[] = [];
    private drawingOnLayerScales: { x: number; y: number }[] = [];
    private drawingPoints: DOMPoint[] = [];

    private drawablePreviewCanvas: DrawableCanvas | null = null;
    private brushStrokeDrawableUuid: string | null = null;

    private brushShapeImage: HTMLImageElement | null = null;

    private updateChunkBounds = {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity,
    };

    onEnter(): void {
        super.onEnter();

        this.drawablePreviewCanvas = new DrawableCanvas({ scale: 1 });
        this.drawablePreviewCanvas.onDrawn((event) => {
            for (const layer of this.drawingOnLayers) {
                if (!layer.draft) continue;
                layer.draft.updateChunks.push({
                    x: event.sourceX,
                    y: event.sourceY,
                    width: event.canvas.width,
                    height: event.canvas.height,
                    data: event.canvas,
                });
                layer.draft.lastUpdateTimestamp = window.performance.now();
            }
            canvasStore.set('dirty', true);
        });
        this.brushStrokeDrawableUuid = this.drawablePreviewCanvas.add<BrushStrokeData>('brushStroke', { smoothing: 1 });

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

        this.ctrlKeyUnwatch = watch([isCtrlOrMetaKeyPressed], ([isCtrlOrMetaKeyPressed]) => {
            this.handleCursorIcon();
        });

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
        }, { immediate: true });

        this.brushSizeUnwatch = watch([brushSize], ([brushSize]) => {
            this.drawingDraftChunkSize = Math.max(64, nearestPowerOf2(brushSize / 4));
            this.drawingDraftCanvases = (this.drawingDraftCanvases ?? []).slice(0, 9);
            for (let i = 0; i < 9; i++) {
                let draftCanvas = this.drawingDraftCanvases[i];
                if (!draftCanvas) {
                    draftCanvas = document.createElement('canvas');
                }
                draftCanvas.width = this.drawingDraftChunkSize;
                draftCanvas.height = this.drawingDraftChunkSize;
                const ctx = draftCanvas.getContext('2d');
                ctx?.clearRect(0, 0, this.drawingDraftChunkSize, this.drawingDraftChunkSize);
                this.drawingDraftCanvases[i] = draftCanvas;
            }
        }, { immediate: true });

        cursorHoverPosition.value = new DOMPoint(
            -100000000000,
            -100000000000
        )

        // Tutorial message
        if (!editorStore.state.tutorialFlags.zoomToolIntroduction) {
            waitForNoOverlays().then(() => {
                let message = `
                    <p class="mb-3">The draw tool lets you create lines and shapes.</p>
                `;
                scheduleTutorialNotification({
                    flag: 'drawToolIntroduction',
                    title: 'Draw Tool',
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
        this.ctrlKeyUnwatch?.();
        this.ctrlKeyUnwatch = null;
        this.selectedLayerIdsUnwatch?.();
        this.selectedLayerIdsUnwatch = null;

        this.drawingDraftCanvases = [];

        for (const layer of getSelectedLayers()) {
            if (layer.type === 'raster') {
                prepareStoredImageForArchival(layer.data.sourceUuid);
            }
        }

        // Tutorial Message
        if (!editorStore.state.tutorialFlags.drawToolIntroduction) {
            dismissTutorialNotification('drawToolIntroduction');
        }
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
            this.onDrawStart();
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
                    layer.draft = null;
                }
            })();
            // this.drawingPointerId = this.touches[0].id;
            // this.onDrawStart();
        }
    }

    onMultiTouchTap(touches: PointerTracker[]) {
        super.onMultiTouchTap(touches);
        // if (touches.length === 1) {
        //     this.onZoomIn();
        // } else if (touches.length === 2) {
        //     this.onZoomOut();
        // }
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

        if (this.drawingPointerId === e.pointerId) {
            const points = this.drawingPoints.slice();
            const drawingOnLayers = this.drawingOnLayers.slice();
            const updateHistoryStartTimestamp = window.performance.now();

            this.drawingPoints = [];
            this.drawingOnLayers = [];
            this.drawingPointerId = null;
            const updateLayerReserveToken = createHistoryReserveToken();

            await historyReserveQueueFree();

            await historyStore.dispatch('reserve', { token: updateLayerReserveToken });

            const layerActions: BaseAction[] = [];

            const previewRatioX = canvasStore.get('decomposedTransform').scaleX;
            const previewRatioY = canvasStore.get('decomposedTransform').scaleY;
            const previewBrushSize = brushSize.value * previewRatioX;

            for (const layer of drawingOnLayers) {
                if (layer.type === 'raster') {
                    // TODO - START - This is fairly slow, speed it up?

                    const decomposedCanvasTransform = decomposeMatrix(canvasStore.state.transform.inverse());
                    const layerGlobalTransform = getLayerGlobalTransform(layer);
                    const layerSpaceTransform = layerGlobalTransform.inverse();

                    // Project the drawing preview box bounds to the layer's coordinates,
                    // and determine min/max update coordinates for updating the layer image.
                    let minX = Infinity;
                    let maxX = -Infinity;
                    let minY = Infinity;
                    let maxY = -Infinity;
                    const updateChunkBoundsPoints = [
                        new DOMPoint(this.updateChunkBounds.minX, this.updateChunkBounds.minY).matrixTransform(layerSpaceTransform),
                        new DOMPoint(this.updateChunkBounds.minX, this.updateChunkBounds.maxY).matrixTransform(layerSpaceTransform),
                        new DOMPoint(this.updateChunkBounds.maxX, this.updateChunkBounds.minY).matrixTransform(layerSpaceTransform),
                        new DOMPoint(this.updateChunkBounds.maxX, this.updateChunkBounds.maxY).matrixTransform(layerSpaceTransform),
                    ];
                    for (const point of updateChunkBoundsPoints) {
                        if (point.x < minX) minX = point.x;
                        if (point.x > maxX) maxX = point.x;
                        if (point.y < minY) minY = point.y;
                        if (point.y > maxY) maxY = point.y;
                    }
                    minX = Math.max(0, Math.floor(minX));
                    minY = Math.max(0, Math.floor(minY));
                    maxX = Math.min(layer.width, Math.ceil(maxX));
                    maxY = Math.min(layer.height, Math.ceil(maxY));

                    const updateChunkWidth = maxX - minX;
                    const updateChunkHeight = maxY - minY;

                    // Draw the line to a new canvas which will be merged with the existing layer's canvas
                    const { canvas: layerUpdateCanvas, ctx: layerUpdateCtx } = createEmptyCanvasWith2dContext(updateChunkWidth, updateChunkHeight);
                    if (!layerUpdateCtx) continue;
                    layerUpdateCtx.save();

                    const layerTransform = new DOMMatrix().translate(-minX, -minY).multiply(layerGlobalTransform.inverse())
                        .scale(decomposedCanvasTransform.scaleX, decomposedCanvasTransform.scaleY);
                    layerUpdateCtx.transform(layerTransform.a, layerTransform.b, layerTransform.c, layerTransform.d, layerTransform.e, layerTransform.f);
                    this.drawPreviewPoints(points, layerUpdateCtx, previewRatioX, previewRatioY, previewBrushSize);
                    layerUpdateCtx.restore();

                    layerActions.push(
                        new UpdateLayerAction<UpdateRasterLayerOptions>({
                            id: layer.id,
                            data: {
                                updateChunks: [{
                                    x: minX,
                                    y: minY,
                                    width: updateChunkWidth,
                                    height: updateChunkHeight,
                                    data: layerUpdateCanvas,
                                    mode: 'overlay',
                                }],
                            }
                        })
                    );

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
                if (layer?.draft?.lastUpdateTimestamp ?? 0 < updateHistoryStartTimestamp) {
                    layer.draft = null;
                }
            }
        }
    }

    protected async onDrawStart() {
        // Create layer if one does not exist
        const startDrawReserveToken = createHistoryReserveToken();
        await historyStore.dispatch('reserve', { token: startDrawReserveToken });

        this.updateChunkBounds = {
            minX: Infinity,
            maxX: -Infinity,
            minY: Infinity,
            maxY: -Infinity,
        }

        const { width, height } = workingFileStore.state;
        let selectedLayers = getSelectedLayers();
        let layerActions = [];
        if (selectedLayers.length === 0) {
            layerActions.push(new InsertLayerAction<InsertRasterLayerOptions>({
                type: 'raster',
                name: 'New Paint',
                width,
                height,
                data: {
                    sourceUuid: await createStoredImage(createEmptyCanvas(width, height)),
                },
            }));
        }
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
        selectedLayers = getSelectedLayers();
        this.drawingOnLayers = selectedLayers as WorkingFileAnyLayer[];
        this.drawingOnLayerScales = [];
        for (const layer of this.drawingOnLayers) {
            const layerGlobalTransformSelfExcluded = getLayerGlobalTransform(layer, { excludeSelf: true });
            const layerGlobalTransform = decomposeMatrix(getLayerGlobalTransform(layer));
            const viewTransform = canvasStore.get('decomposedTransform');
            let scaleX = viewTransform.scaleX * layerGlobalTransform.scaleX;
            let scaleY = viewTransform.scaleY * layerGlobalTransform.scaleY;
            const width = workingFileStore.get('width');
            const height = workingFileStore.get('height');
            const logicalWidth = Math.min(width, workingFileStore.get('width') * viewTransform.scaleX);
            const logicalHeight = Math.min(height, workingFileStore.get('height') * viewTransform.scaleY);
            if (layer.type === 'raster') {
                if (!layer.draft) {
                    layer.draft = {
                        lastUpdateTimestamp: window.performance.now(),
                        width,
                        height,
                        logicalWidth,
                        logicalHeight,
                        transform: layerGlobalTransformSelfExcluded.inverse(),
                        updateChunks: [],
                    };
                } else {
                    Object.assign(layer.draft, {
                        lastUpdateTimestamp: window.performance.now(),
                        width,
                        height,
                        logicalWidth,
                        logicalHeight,
                        transform: layerGlobalTransformSelfExcluded.inverse(),
                    });
                }
            }
            this.drawingOnLayerScales.push({
                x: scaleX,
                y: scaleY,
            });
        }

        // Populate first drawing point
        this.drawingPoints = [
            new DOMPoint(
                this.lastCursorX * devicePixelRatio,
                this.lastCursorY * devicePixelRatio
            ).matrixTransform(canvasStore.state.transform.inverse())
        ];

        // Generate draw preview
        this.drawPreview();
    }

    protected handleCursorIcon() {
        let newIcon = super.handleCursorIcon();
        canvasStore.set('cursor', newIcon);
        return newIcon;
    }

    private drawPreview() {
        if (this.drawingOnLayers.length > 0 && this.brushShapeImage) {

            const points = this.drawingPoints;

            const previewRatioX = Math.min(1, canvasStore.get('decomposedTransform').scaleX);
            const previewRatioY = Math.min(1, canvasStore.get('decomposedTransform').scaleY);

            const chunkSize = Math.max(64, nearestPowerOf2(this.drawingDraftChunkSize * previewRatioX));
            const previewBrushSize = brushSize.value * previewRatioX;

            // For area of the canvas that the line between the last few drawn points affect,
            // Determine the range of subdivided canvas chunks we need to replace
            let minQuadrantX = Infinity;
            let maxQuadrantX = -Infinity;
            let minQuadrantY = Infinity;
            let maxQuadrantY = -Infinity;
            for (let i = Math.max(0, points.length - 3); i < points.length; i++) {
                const offsetPoint = new DOMPoint(
                    points[i].x * previewRatioX,
                    points[i].y * previewRatioY
                );
                const minX = Math.floor((offsetPoint.x - previewBrushSize / 2) / chunkSize);
                const maxX = Math.floor((offsetPoint.x + previewBrushSize / 2) / chunkSize);
                const minY = Math.floor((offsetPoint.y - previewBrushSize / 2) / chunkSize);
                const maxY = Math.floor((offsetPoint.y + previewBrushSize / 2) / chunkSize);
                if (minX < minQuadrantX) {
                    minQuadrantX = minX;
                }
                if (maxX > maxQuadrantX) {
                    maxQuadrantX = maxX;
                }
                if (minY < minQuadrantY) {
                    minQuadrantY = minY;
                }
                if (maxY > maxQuadrantY) {
                    maxQuadrantY = maxY;
                }
            }
            
            const globalMinX = (minQuadrantX * chunkSize) * (1 / previewRatioX);
            const globalMaxX = ((maxQuadrantX * chunkSize) + (chunkSize * 3)) * (1 / previewRatioX);
            const globalMinY = (minQuadrantY * chunkSize) * (1 / previewRatioX);
            const globalMaxY = ((maxQuadrantY * chunkSize) + (chunkSize * 3)) * (1 / previewRatioX);
            if (globalMinX < this.updateChunkBounds.minX) {
                this.updateChunkBounds.minX = globalMinX;
            }
            if (globalMaxX > this.updateChunkBounds.maxX) {
                this.updateChunkBounds.maxX = globalMaxX;
            }
            if (globalMinY < this.updateChunkBounds.minY) {
                this.updateChunkBounds.minY = globalMinY;
            }
            if (globalMaxY > this.updateChunkBounds.maxY) {
                this.updateChunkBounds.maxY = globalMaxY;
            }

            // Draw the line to each canvas chunk

            this.drawablePreviewCanvas?.setScale(previewRatioX);
            this.drawablePreviewCanvas?.draw([
                {
                    uuid: this.brushStrokeDrawableUuid!,
                    data: {
                        color: brushColor.value.style,
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
            ]);
        }
    }

    private drawPreviewPoints(points: DOMPoint[], ctx: CanvasRenderingContext2D, previewRatioX: number, previewRatioY: number, lineWidth: number, offsetX: number = 0, offsetY: number = 0) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.fillStyle = brushColor.value.style;
        if (points.length === 1) {
            ctx.beginPath();
            ctx.arc(points[0].x * previewRatioX + offsetX, points[0].y * previewRatioY + offsetY, lineWidth / 2, 0, 1.999999 * Math.PI);
            ctx.fill();
        }
        
        // let startX = points[0].x * previewRatioX + offsetX;
        // let startY = points[0].y * previewRatioY + offsetY;
        // let averageX = 0;
        // let averageY = 0;
        // for (let i = 1; i < points.length; i++) {
        //     let previousPoint1 = {
        //         x: points[i - 1].x * previewRatioX + offsetX,
        //         y: points[i - 1].y * previewRatioY + offsetY,
        //     };
        //     let nextPoint1 = {
        //         x: points[i].x * previewRatioX + offsetX,
        //         y: points[i].y * previewRatioY + offsetY,
        //     };
        //     averageX = (previousPoint1.x + nextPoint1.x) / 2;
        //     averageY = (previousPoint1.y + nextPoint1.y) / 2;
        //     const quadraticLine = new Bezier(startX, startY, previousPoint1.x, previousPoint1.y, averageX, averageY);
        //     const renderShapes = quadraticLine.outline(lineWidth / 2);
        //     if (renderShapes.curves.length > 0) {
        //         ctx.beginPath();
        //         ctx.moveTo(renderShapes.curves[0].points[0].x, renderShapes.curves[0].points[0].y);
        //         for (let curve of renderShapes.curves) {
        //             if (curve.points.length == 4) {
        //                 ctx.bezierCurveTo(curve.points[1].x, curve.points[1].y, curve.points[2].x, curve.points[2].y, curve.points[3].x, curve.points[3].y);
        //             } else if (curve.points.length == 3) {
        //                 ctx.quadraticCurveTo(curve.points[1].x, curve.points[1].y, curve.points[2].x, curve.points[2].y);
        //             }
        //         }
        //         ctx.fill();
        //     }
        //     startX = averageX;
        //     startY = averageY;
        // }


        ctx.beginPath();
        ctx.moveTo(points[0].x * previewRatioX + offsetX, points[0].y * previewRatioY + offsetY);
        let averageX = 0;
        let averageY = 0;
        for (let i = 1; i < points.length; i++) {
            let previousPoint1 = {
                x: points[i - 1].x * previewRatioX + offsetX,
                y: points[i - 1].y * previewRatioY + offsetY,
            };
            let nextPoint1 = {
                x: points[i].x * previewRatioX + offsetX,
                y: points[i].y * previewRatioY + offsetY,
            };
            averageX = (previousPoint1.x + nextPoint1.x) / 2;
            averageY = (previousPoint1.y + nextPoint1.y) / 2;
            ctx.quadraticCurveTo(previousPoint1.x, previousPoint1.y, averageX, averageY);
        }
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = brushColor.value.style;
        ctx.stroke();
    }
}
