import { watch, WatchStopHandle } from 'vue';
import { Bezier } from 'bezier-js';

import { PointerTracker } from './base';
import BaseCanvasMovementController from './base-movement';
import { cursorHoverPosition, brushShape, brushColor, brushSize } from '../store/draw-state';

import { decomposeMatrix } from '@/lib/dom-matrix';
import { isCtrlOrMetaKeyPressed } from '@/lib/keyboard';
import { dismissTutorialNotification, scheduleTutorialNotification, waitForNoOverlays } from '@/lib/tutorial';
import { createEmptyImage, createImageFromBlob, createImageFromCanvas } from '@/lib/image';
import { pointDistance2d, nearestPowerOf2 } from '@/lib/math';

import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import historyStore from '@/store/history';
import workingFileStore, { getSelectedLayers, ensureUniqueLayerSiblingName, getLayerGlobalTransform } from '@/store/working-file';

import { BundleAction } from '@/actions/bundle';
import { InsertLayerAction } from '@/actions/insert-layer';
import { UpdateLayerAction } from '@/actions/update-layer';

import type { InsertRasterLayerOptions, UpdateRasterLayerOptions, WorkingFileAnyLayer } from '@/types';

const devicePixelRatio = window.devicePixelRatio || 1;

export default class CanvasZoomController extends BaseCanvasMovementController {

    private brushShapeUnwatch: WatchStopHandle | null = null;
    private brushSizeUnwatch: WatchStopHandle | null = null;
    private ctrlKeyUnwatch: WatchStopHandle | null = null;

    private drawingDraftChunkSize: number = 64;
    private drawingDraftCanvases: HTMLCanvasElement[] = [];
    private drawingPointerId: number | null = null;
    private drawingOnLayers: WorkingFileAnyLayer[] = [];
    private drawingOnLayerScales: { x: number; y: number }[] = [];
    private drawingDraftCanvas: HTMLCanvasElement | null = null;
    private drawingPoints: DOMPoint[] = [];

    private brushShapeImage: HTMLImageElement | null = null;

    onEnter(): void {
        super.onEnter();

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
        this.brushShapeUnwatch?.();
        this.brushShapeUnwatch = null;
        this.brushSizeUnwatch?.();
        this.brushSizeUnwatch = null;
        this.ctrlKeyUnwatch?.();
        this.ctrlKeyUnwatch = null;

        this.drawingDraftCanvases = [];

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

        if ((e.pointerType === 'pen' || (!editorStore.state.isPenUser && e.pointerType === 'mouse')) && e.isPrimary && e.button === 0) {
            this.drawingPointerId = e.pointerId;
            this.onDrawStart();
        }
    }

    onMultiTouchDown() {
        super.onMultiTouchDown();
        if (this.touches.length === 1) {
            this.drawingPointerId = this.touches[0].id;
            this.onDrawStart();
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

            const layerActions = [];

            const previewRatioX = canvasStore.get('decomposedTransform').scaleX;
            const previewRatioY = canvasStore.get('decomposedTransform').scaleY;
            const previewBrushSize = brushSize.value * previewRatioX;

            for (const layer of this.drawingOnLayers) {
                if (layer.type === 'raster') {

                    const layerUpdateCanvas = document.createElement('canvas');
                    layerUpdateCanvas.width = layer.width;
                    layerUpdateCanvas.height = layer.height;
                    const layerUpdateCtx = layerUpdateCanvas.getContext('2d');
                    if (!layerUpdateCtx) continue;
                    if (layer.data.sourceImage) {
                        layerUpdateCtx.drawImage(layer.data.sourceImage, 0, 0);
                    }
                    // TODO - transform layer before draw
                    layerUpdateCtx.save();
                    const layerGlobalTransform = getLayerGlobalTransform(layer);
                    const decomposedCanvasTransform = decomposeMatrix(canvasStore.state.transform.inverse());
                    const layerTransform = layerGlobalTransform.inverse().scale(decomposedCanvasTransform.scaleX, decomposedCanvasTransform.scaleY);
                    layerUpdateCtx.transform(layerTransform.a, layerTransform.b, layerTransform.c, layerTransform.d, layerTransform.e, layerTransform.f);
                    this.drawPreviewPoints(this.drawingPoints, layerUpdateCtx, previewRatioX, previewRatioY, previewBrushSize);
                    layerUpdateCtx.restore();

                    layerActions.push(
                        new UpdateLayerAction<UpdateRasterLayerOptions>({
                            id: layer.id,
                            data: {
                                sourceImage: await createImageFromCanvas(layerUpdateCanvas),
                                sourceImageIsObjectUrl: true,
                            }
                        })
                    );
                }
            }

            if (layerActions.length > 0) {
                await historyStore.dispatch('runAction', {
                    action: new BundleAction('updateDrawLayer', 'action.updateDrawLayer', layerActions)
                });

                for (const layer of this.drawingOnLayers) {
                    layer.draft = null;
                }
            }

            this.drawingPoints = [];
            this.drawingOnLayers = [];
            this.drawingDraftCanvas = null;
        }
    }

    protected async onDrawStart() {
        // Create layer if one does not exist
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
                    sourceImage: await createEmptyImage(width, height),
                    sourceImageIsObjectUrl: true,
                }
            }));
        }
        for (let i = selectedLayers.length - 1; i >= 0; i--) {
            const selectedLayer = selectedLayers[i];
            if (selectedLayer.type === 'empty') {
                layerActions.push(
                    // Switch layer type
                    new UpdateLayerAction<UpdateRasterLayerOptions>({
                        id: selectedLayer.id,
                        type: 'raster',
                        width,
                        height,
                        data: {}
                    }),
                    // Update data separately, the action will have issues with the type change otherwise
                    new UpdateLayerAction<UpdateRasterLayerOptions>({
                        id: selectedLayer.id,
                        data: {
                            sourceImage: await createEmptyImage(width, height),
                            sourceImageIsObjectUrl: true,
                        }
                    })
                );
            } else if (selectedLayer.type !== 'raster') {
                selectedLayers.splice(i, 1);
            }
        }
        if (layerActions.length > 0) {
            await historyStore.dispatch('runAction', {
                action: new BundleAction('createDrawLayer', 'action.createDrawLayer', layerActions)
            });
        }

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
                layer.draft = {
                    width,
                    height,
                    logicalWidth,
                    logicalHeight,
                    transform: layerGlobalTransformSelfExcluded.inverse(),
                    updateChunks: []
                };
            }
            this.drawingOnLayerScales.push({
                x: scaleX,
                y: scaleY,
            });
        }

        // Create a draft canvas
        this.drawingDraftCanvas = document.createElement('canvas');
        this.drawingDraftCanvas.width = width;
        this.drawingDraftCanvas.height = height;

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

    private smoothPoints(pointListSource: DOMPoint[]) {
        const pointList = [...pointListSource];
        const smoothedPoints: DOMPoint[] = [];
        for (let i = 1; i < pointList.length - 1; i++) {
            const point1 = pointList[i - 1];
            const point2 = pointList[i];
            if (pointDistance2d(point1.x, point1.y, point2.x, point2.y) < 30) {
                pointList.splice(i, 1);
                i--;
            }
        }

        if (pointList.length < 4) return pointListSource;

        smoothedPoints.push(pointList[0]);

        for (let i = 1; i < pointList.length - 2; i++) {
            smoothedPoints.push(pointList[i]);

            // smoothedPoints.push(Vector2.CatmullRom(pointList[i - 1], pointList[i], pointList[i + 1], pointList[i + 2], .5f));
        }

        smoothedPoints.push(pointList[pointList.length - 2]);
        smoothedPoints.push(pointList[pointList.length - 1]);
        return smoothedPoints;
    }

    private drawPreview() {
        if (this.drawingOnLayers.length > 0 && this.drawingDraftCanvas && this.brushShapeImage) {

            const canvas = this.drawingDraftCanvas;
            canvas.id = 'bar';
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const points = this.smoothPoints(this.drawingPoints);

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

            // Draw the line to each canvas chunk
            try {
                let draftCanvasIndex = 0;
                for (let quadrantX = minQuadrantX; quadrantX <= maxQuadrantX; quadrantX++) {
                    for (let quadrantY = minQuadrantY; quadrantY <= maxQuadrantY; quadrantY++) {
                        let draftCanvas = this.drawingDraftCanvases[draftCanvasIndex];
                        if (!draftCanvas) {
                            draftCanvas = document.createElement('canvas');
                            draftCanvas.width = chunkSize;
                            draftCanvas.height = chunkSize;
                            this.drawingDraftCanvases[draftCanvasIndex] = draftCanvas;
                        }
                        const ctx = draftCanvas.getContext('2d');
                        if (!ctx) throw new Error('Couldn\'t create a canvas chunk.');
                        ctx.clearRect(0, 0, chunkSize, chunkSize);

                        // Draw the line
                        this.drawPreviewPoints(points, ctx, previewRatioX, previewRatioY, previewBrushSize, -quadrantX * chunkSize, -quadrantY * chunkSize);

                        draftCanvasIndex++;
                    }
                }
            } catch (error) {
                console.log(error);
                // TODO - fallback
            }

            for (const [layerIndex, layer] of this.drawingOnLayers.entries()) {
                const layerScale = this.drawingOnLayerScales[layerIndex];
                if (layer.type === 'raster') {
                    if (!layer.draft) continue;
                    // let draftImage = layer.data.draftImage;

                    // const screenTexelWidth = layer.width * layerScale.x * devicePixelRatio;
                    // const screenTexelHeight = layer.height * layerScale.y * devicePixelRatio;

                    let layerDraftCanvasCtx: CanvasRenderingContext2D | null = null;

                    // if (!draftImage) {
                    //     draftImage = document.createElement('canvas');
                    //     draftImage.width = Math.ceil(screenTexelWidth);
                    //     draftImage.height = Math.ceil(screenTexelHeight);
                    //     layer.data.draftImage = draftImage;
                    // }

                    // layerDraftCanvasCtx = draftImage.getContext('2d');
                    // if (!layerDraftCanvasCtx) continue;

                    let draftCanvasIndex = 0;
                    for (let quadrantX = minQuadrantX; quadrantX <= maxQuadrantX; quadrantX++) {
                        for (let quadrantY = minQuadrantY; quadrantY <= maxQuadrantY; quadrantY++) {
                            layer.draft.updateChunks.push({
                                x: quadrantX * chunkSize,
                                y: quadrantY * chunkSize,
                                width: chunkSize,
                                height: chunkSize,
                                data: this.drawingDraftCanvases[draftCanvasIndex]
                            });

                            draftCanvasIndex++;
                        }
                    }
                }
            }

            canvasStore.set('dirty', true);
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
