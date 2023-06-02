import { watch, WatchStopHandle } from 'vue';
import { Bezier } from 'bezier-js';

import { PointerTracker } from './base';
import BaseCanvasMovementController from './base-movement';
import { cursorHoverPosition, brushShape, brushColor, brushSize } from '../store/draw-state';

import { isCtrlOrMetaKeyPressed } from '@/lib/keyboard';
import { dismissTutorialNotification, scheduleTutorialNotification, waitForNoOverlays } from '@/lib/tutorial';
import { createEmptyImage, createImageFromBlob } from '@/lib/image';
import { lineIntersectsLine2d, pointDistance2d } from '@/lib/math';

import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import historyStore from '@/store/history';
import workingFileStore, { getSelectedLayers, ensureUniqueLayerSiblingName } from '@/store/working-file';

import { BundleAction } from '@/actions/bundle';
import { InsertLayerAction } from '@/actions/insert-layer';
import { UpdateLayerAction } from '@/actions/update-layer';

import type { InsertRasterLayerOptions, UpdateRasterLayerOptions, WorkingFileAnyLayer } from '@/types';

const devicePixelRatio = window.devicePixelRatio || 1;

export default class CanvasZoomController extends BaseCanvasMovementController {

    private brushShapeUnwatch: WatchStopHandle | null = null;
    private ctrlKeyUnwatch: WatchStopHandle | null = null;

    private drawingPointerId: number | null = null;
    private drawingOnLayers: WorkingFileAnyLayer[] = [];
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
        this.ctrlKeyUnwatch?.();
        this.ctrlKeyUnwatch = null;

        // Tutorial Message
        if (!editorStore.state.tutorialFlags.drawToolIntroduction) {
            dismissTutorialNotification('drawToolIntroduction');
        }
    }

    async onPointerDown(e: PointerEvent) {
        super.onPointerDown(e);
        if (e.pointerType === 'pen' || !editorStore.state.isPenUser) {
            cursorHoverPosition.value = new DOMPoint(
                this.lastCursorX * devicePixelRatio,
                this.lastCursorY * devicePixelRatio
            ).matrixTransform(canvasStore.state.transform.inverse());

            if (e.isPrimary && e.button === 0) {
                this.drawingPointerId = e.pointerId;

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
                selectedLayers = getSelectedLayers();
                this.drawingOnLayers = selectedLayers as WorkingFileAnyLayer[];

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

        // if (pointer && (pointer.type !== 'touch' || this.multiTouchDownCount === 1)) {
        //     if (pointer.isDragging && e.isPrimary && pointer.down.button === 0) {
        //         this.isDragging = true;
        //         this.handleCursorIcon();
        //         const lastCursorX = (pointer.movePrev || pointer.down).pageX;
        //         const lastCursorY = (pointer.movePrev || pointer.down).pageY;
        //         const cursorX = e.pageX;
        //         const cursorY = e.pageY;
        //         let transform = canvasStore.get('transform');
        //         const transformInverse = transform.inverse();
        //         const moveTranslateStart = new DOMPoint(lastCursorX * devicePixelRatio, lastCursorY * devicePixelRatio).matrixTransform(transformInverse);
        //         // Pan View
        //         const translateMove = new DOMPoint(cursorX * devicePixelRatio, cursorY * devicePixelRatio).matrixTransform(transformInverse);
        //         transform.translateSelf(translateMove.x - moveTranslateStart.x, translateMove.y - moveTranslateStart.y);
        //         canvasStore.set('transform', transform);
        //         canvasStore.set('viewDirty', true);
        //     }
        // }
    }

    onPointerUpBeforePurge(e: PointerEvent): void {
        super.onPointerUpBeforePurge(e);

        if (this.drawingPointerId === e.pointerId) {
            this.drawingPoints = [];
            this.drawingOnLayers = [];
            this.drawingDraftCanvas = null;
        }

        // const pointer = this.pointers.filter((pointer) => pointer.id === e.pointerId)[0];
        // if (pointer && pointer.down.button === 0) {
        //     if (pointer.isDragging) {
        //         this.isDragging = false;
        //         this.handleCursorIcon();
        //     } else {
        //         if (e.isPrimary && ['mouse', 'pen'].includes(e.pointerType) && e.button === 0) {
        //             if (isCtrlOrMetaKeyPressed.value === true) {
        //                 this.onZoomOut();
        //             } else {
        //                 this.onZoomIn();
        //             }
        //         }
        //     }
        // }
    }

    protected handleCursorIcon() {
        let newIcon = super.handleCursorIcon();
        // if (!newIcon) {
        //     if (this.isDragging) {
        //         newIcon = 'grabbing';
        //     } else if (isCtrlOrMetaKeyPressed.value) {
        //         newIcon = 'zoom-out';
        //     } else {
        //         newIcon = 'zoom-in';
        //     }
        // }
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

            const time = window.performance.now();

            const canvas = this.drawingDraftCanvas;
            canvas.id = 'bar';
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const points = this.smoothPoints(this.drawingPoints);

            
            // ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            // const lookAroundLength = 2;
            // const previousStack = [];
            // const nextStack = [];
            // for (let i = 1; i < points.length; i++) {
            //     let previousPoint1 = points[i - 1];
            //     let previousPoint2 = points[i - 2] ?? previousPoint1;
            //     let nextPoint1 = points[i];
            //     let nextPoint2 = points[i + 1] ?? nextPoint1;
            //     const averageX = (previousPoint1.x + nextPoint1.x) / 2;
            //     const averageY = (previousPoint1.y + nextPoint1.y) / 2;
            //     ctx.quadraticCurveTo(previousPoint1.x, previousPoint1.y, averageX, averageY);
            // }
            // ctx.lineWidth = brushSize.value;
            // ctx.stroke();

            console.log(window.performance.now() - time);

            
            // for (const point of this.drawingPoints) {

                // ctx.save();
                // ctx.translate(point.x, point.y);
                // ctx.scale(brushSize.value, brushSize.value);
                // ctx.translate(-1.5, -1.5);
                // ctx.drawImage(this.brushShapeImage, 0, 0);
                // ctx.restore();
            // }

            for (const layer of this.drawingOnLayers) {
                if (layer.type === 'raster') {
                    let draftImage = layer.data.draftImage;
                    if (!draftImage) {
                        draftImage = document.createElement('canvas');
                        draftImage.width = layer.width;
                        draftImage.height = layer.height;
                        layer.data.draftImage = draftImage;
                    }

                    const layerDraftCanvasCtx = draftImage.getContext('2d');
                    if (!layerDraftCanvasCtx) continue;
                    // layerDraftCanvasCtx.clearRect(0, 0, layer.width, layer.height);
                    // layerDraftCanvasCtx.drawImage(canvas, 0, 0);
                }
            }


            canvasStore.set('dirty', true);
        }
    }
}
