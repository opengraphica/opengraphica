import BaseMovementController from './base-movement';
import { PointerTracker } from './base';
import { appliedSelectionMask, appliedSelectionMaskCanvasOffset, activeSelectionMask, isDrawingSelection, selectionAddShape, workingSelectionPath, selectionEmitter } from '../store/selection-state';
import canvasStore from '@/store/canvas';
import appEmitter from '@/lib/emitter';

export default class SelectionController extends BaseMovementController {
    onEnter(): void {
        super.onEnter();
        appEmitter.on('editor.tool.commitCurrentAction', this.commitActiveSelection.bind(this));
        selectionEmitter.on('commitActiveSelection', this.commitActiveSelection.bind(this));
        selectionEmitter.on('clearSelection', this.clearSelection.bind(this));
    }

    onLeave(): void {
        super.onLeave();
        appEmitter.off('editor.tool.commitCurrentAction', this.commitActiveSelection.bind(this));
        selectionEmitter.off('commitActiveSelection', this.commitActiveSelection.bind(this));
        selectionEmitter.off('clearSelection', this.clearSelection.bind(this));
    }

    getActiveSelectionBounds(): { left: number; right: number; top: number; bottom: number; } {
        let left = Infinity;
        let right = -Infinity;
        let top = Infinity;
        let bottom = -Infinity;
        for (const point of workingSelectionPath.value) {
            if (point.x < left) {
                left = point.x;
            }
            if (point.x > right) {
                right = point.x;
            }
            if (point.y < top) {
                top = point.y;
            }
            if (point.y > bottom) {
                bottom = point.y;
            }
            if (point.type === 'quadraticBezierCurve') {
                if (point.shx < left) {
                    left = point.shx;
                }
                if (point.shx > right) {
                    right = point.shx;
                }
                if (point.shy < top) {
                    top = point.shy;
                }
                if (point.shy > bottom) {
                    bottom = point.shy;
                }
                if (point.ehx < left) {
                    left = point.ehx;
                }
                if (point.ehx > right) {
                    right = point.ehx;
                }
                if (point.ehy < top) {
                    top = point.ehy;
                }
                if (point.ehy > bottom) {
                    bottom = point.ehy;
                }
            }
        }
        return { left, right, top, bottom };
    }

    async commitActiveSelection() {
        const activeSelectionBounds = this.getActiveSelectionBounds();
        if (appliedSelectionMask.value != null) {
            if (appliedSelectionMaskCanvasOffset.value.x < activeSelectionBounds.left) {
                activeSelectionBounds.left = appliedSelectionMaskCanvasOffset.value.x;
            }
            if (appliedSelectionMaskCanvasOffset.value.y < activeSelectionBounds.top) {
                activeSelectionBounds.top = appliedSelectionMaskCanvasOffset.value.y;
            }
            if (appliedSelectionMaskCanvasOffset.value.x + appliedSelectionMask.value.width > activeSelectionBounds.right) {
                activeSelectionBounds.right = appliedSelectionMaskCanvasOffset.value.x + appliedSelectionMask.value.width;
            }
            if (appliedSelectionMaskCanvasOffset.value.y + appliedSelectionMask.value.height > activeSelectionBounds.bottom) {
                activeSelectionBounds.bottom = appliedSelectionMaskCanvasOffset.value.y + appliedSelectionMask.value.height;
            }
        }
        let workingCanvas = document.createElement('canvas');
        workingCanvas.width = activeSelectionBounds.right - activeSelectionBounds.left;
        workingCanvas.height = activeSelectionBounds.bottom - activeSelectionBounds.top;
        let ctx = workingCanvas.getContext('2d');
        if (!ctx) throw new Error('Couldn\'t draw to a new canvas when trying to apply selection mask.');
        ctx.clearRect(0, 0, workingCanvas.width, workingCanvas.height);
        if (appliedSelectionMask.value != null) {
            ctx.drawImage(appliedSelectionMask.value, appliedSelectionMaskCanvasOffset.value.x - activeSelectionBounds.left, appliedSelectionMaskCanvasOffset.value.y - activeSelectionBounds.top);            
        }
        ctx.beginPath();
        for (const point of workingSelectionPath.value) {
            if (point.type === 'move') {
                ctx.moveTo(point.x - activeSelectionBounds.left, point.y - activeSelectionBounds.top);
            } else if (point.type === 'line') {
                ctx.lineTo(point.x - activeSelectionBounds.left, point.y - activeSelectionBounds.top);
            } else if (point.type === 'quadraticBezierCurve') {
                ctx.bezierCurveTo(
                    point.shx - activeSelectionBounds.left,
                    point.shy - activeSelectionBounds.top,
                    point.ehx - activeSelectionBounds.left,
                    point.ehy - activeSelectionBounds.top,
                    point.x - activeSelectionBounds.left,
                    point.y - activeSelectionBounds.top
                );
            }
        }
        ctx.closePath();
        ctx.fillStyle = '#000000';
        ctx.fill();
        const newAppliedSelectionMask = await new Promise<InstanceType<typeof Image>>((resolve, reject) => {
            try {
                workingCanvas.toBlob((blob) => {
                    if (blob) {
                        let image = new Image();
                        image.onload = () => {
                            resolve(image);
                            (image as any) = null;
                        };
                        image.onerror = (error) => {
                            reject(error);
                            (image as any) = null;
                        };
                        image.src = URL.createObjectURL(blob);
                    } else {
                        reject(new Error('Canvas blob not created when drawing new selection shape.'));
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
        if (appliedSelectionMask.value) {
            URL.revokeObjectURL(appliedSelectionMask.value.src);
        }
        appliedSelectionMask.value = newAppliedSelectionMask;
        appliedSelectionMaskCanvasOffset.value.x = activeSelectionBounds.left;
        appliedSelectionMaskCanvasOffset.value.y = activeSelectionBounds.top;
        workingSelectionPath.value = [];
        canvasStore.set('viewDirty', true);
        (workingCanvas as any) = null;
        ctx = null;
    }

    clearSelection() {
        if (appliedSelectionMask.value) {
            URL.revokeObjectURL(appliedSelectionMask.value.src);
        }
        appliedSelectionMask.value = null;
        appliedSelectionMaskCanvasOffset.value.x = 0;
        appliedSelectionMaskCanvasOffset.value.y = 0;
        workingSelectionPath.value = [];
        canvasStore.set('viewDirty', true);
    }

    onMultiTouchDown() {
        super.onMultiTouchDown();
        if (this.touches.length === 1) {
            
        }
    }
    
    onMultiTouchTap(touches: PointerTracker[]) {
        super.onMultiTouchTap(touches);
        if (touches.length === 1) {
            if (this.canAddPoint()) {
                this.addPoint();
            }
        }
    }

    onDragStart() {

    }

    onPointerMove(e: PointerEvent): void {
        super.onPointerMove(e);
        const pointer = this.pointers.filter((pointer) => pointer.id === e.pointerId)[0];
        if (pointer && (pointer.type !== 'touch' || this.multiTouchDownCount === 1)) {
            if (pointer.isDragging && e.isPrimary && pointer.down.button === 0) {
                isDrawingSelection.value = true;
                const startCursorX = pointer.down.pageX;
                const startCursorY = pointer.down.pageY;
                const cursorX = e.pageX;
                const cursorY = e.pageY;
                const transform = canvasStore.get('transform');
                const decomposedTransform = canvasStore.get('decomposedTransform');
                const transformInverse = transform.inverse();

                if (['rectangle', 'ellipse'].includes(selectionAddShape.value)) {
                    const viewLeft = Math.min(startCursorX, cursorX);
                    const viewRight = Math.max(startCursorX, cursorX);
                    const viewTop = Math.min(startCursorY, cursorY);
                    const viewBottom = Math.max(startCursorY, cursorY);
                    const topLeft = new DOMPoint(viewLeft * devicePixelRatio, viewTop * devicePixelRatio).matrixTransform(transformInverse);
                    const topRight = new DOMPoint(viewRight * devicePixelRatio, viewTop * devicePixelRatio).matrixTransform(transformInverse);
                    const bottomLeft = new DOMPoint(viewLeft * devicePixelRatio, viewBottom * devicePixelRatio).matrixTransform(transformInverse);
                    const bottomRight = new DOMPoint(viewRight * devicePixelRatio, viewBottom * devicePixelRatio).matrixTransform(transformInverse);
                    if (Math.round(decomposedTransform.rotation * Math.RADIANS_TO_DEGREES) % 90 === 0) {
                        topLeft.x = Math.round(topLeft.x);
                        topLeft.y = Math.round(topLeft.y);
                        topRight.x = Math.round(topRight.x);
                        topRight.y = Math.round(topRight.y);
                        bottomLeft.x = Math.round(bottomLeft.x);
                        bottomLeft.y = Math.round(bottomLeft.y);
                        bottomRight.x = Math.round(bottomRight.x);
                        bottomRight.y = Math.round(bottomRight.y);
                    }

                    if (selectionAddShape.value === 'rectangle') {
                        workingSelectionPath.value = [
                            {
                                type: 'move',
                                x: topLeft.x,
                                y: topLeft.y
                            },
                            {
                                type: 'line',
                                x: topRight.x,
                                y: topRight.y
                            },
                            {
                                type: 'line',
                                x: bottomRight.x,
                                y: bottomRight.y
                            },
                            {
                                type: 'line',
                                x: bottomLeft.x,
                                y: bottomLeft.y
                            },
                            {
                                type: 'line',
                                x: topLeft.x,
                                y: topLeft.y
                            }
                        ];
                    } else { // Ellipse
                        // https://stackoverflow.com/questions/1734745/how-to-create-circle-with-b%C3%A9zier-curves
                        const circularHandleOffset = 0.552284749831;
                        const topX = topLeft.x + ((topRight.x - topLeft.x) / 2);
                        const topY = topLeft.y + ((topRight.y - topLeft.y) / 2);
                        const topRightHandleX = topX + ((topRight.x - topX) * circularHandleOffset);
                        const topRightHandleY = topY + ((topRight.y - topY) * circularHandleOffset);
                        const topLeftHandleX = topX + ((topLeft.x - topX) * circularHandleOffset);
                        const topLeftHandleY = topY + ((topLeft.y - topY) * circularHandleOffset);
                        const bottomX = bottomLeft.x + ((bottomRight.x - bottomLeft.x) / 2);
                        const bottomY = bottomLeft.y + ((bottomRight.y - bottomLeft.y) / 2);
                        const bottomLeftHandleX = bottomX + ((bottomLeft.x - bottomX) * circularHandleOffset);
                        const bottomLeftHandleY = bottomY + ((bottomLeft.y - bottomY) * circularHandleOffset);
                        const bottomRightHandleX = bottomX + ((bottomRight.x - bottomX) * circularHandleOffset);
                        const bottomRightHandleY = bottomY + ((bottomRight.y - bottomY) * circularHandleOffset);
                        const leftX = topLeft.x + ((bottomLeft.x - topLeft.x) / 2);
                        const leftY = topLeft.y + ((bottomLeft.y - topLeft.y) / 2);
                        const leftTopHandleX = leftX + ((topLeft.x - leftX) * circularHandleOffset);
                        const leftTopHandleY = leftY + ((topLeft.y - leftY) * circularHandleOffset);
                        const leftBottomHandleX = leftX + ((bottomLeft.x - leftX) * circularHandleOffset);
                        const leftBottomHandleY = leftY + ((bottomLeft.y - leftY) * circularHandleOffset);
                        const rightX = topRight.x + ((bottomRight.x - topRight.x) / 2);
                        const rightY = topRight.y + ((bottomRight.y - topRight.y) / 2);
                        const rightTopHandleX = rightX + ((topRight.x - rightX) * circularHandleOffset);
                        const rightTopHandleY = rightY + ((topRight.y - rightY) * circularHandleOffset);
                        const rightBottomHandleX = rightX + ((bottomRight.x - rightX) * circularHandleOffset);
                        const rightBottomHandleY = rightY + ((bottomRight.y - rightY) * circularHandleOffset);
                        workingSelectionPath.value = [
                            {
                                type: 'move',
                                x: topX,
                                y: topY
                            },
                            {
                                type: 'quadraticBezierCurve',
                                x: rightX,
                                y: rightY,
                                shx: topRightHandleX,
                                shy: topRightHandleY,
                                ehx: rightTopHandleX,
                                ehy: rightTopHandleY
                            },
                            {
                                type: 'quadraticBezierCurve',
                                x: bottomX,
                                y: bottomY,
                                shx: rightBottomHandleX,
                                shy: rightBottomHandleY,
                                ehx: bottomRightHandleX,
                                ehy: bottomRightHandleY
                            },
                            {
                                type: 'quadraticBezierCurve',
                                x: leftX,
                                y: leftY,
                                shx: bottomLeftHandleX,
                                shy: bottomLeftHandleY,
                                ehx: leftBottomHandleX,
                                ehy: leftBottomHandleY
                            },
                            {
                                type: 'quadraticBezierCurve',
                                x: topX,
                                y: topY,
                                shx: leftTopHandleX,
                                shy: leftTopHandleY,
                                ehx: topLeftHandleX,
                                ehy: topLeftHandleY
                            }
                        ];
                    }
                }
            }
        }
    }

    onPointerUpBeforePurge(e: PointerEvent): void {
        super.onPointerUpBeforePurge(e);

        const pointer = this.pointers.filter((pointer) => pointer.id === e.pointerId)[0];
        if (pointer && pointer.down.button === 0) {
            if (pointer.isDragging) {
                isDrawingSelection.value = false;
            } else {
                if (e.isPrimary && ['mouse', 'pen'].includes(e.pointerType) && e.button === 0) {
                    if (this.canAddPoint()) {
                        this.addPoint();
                    }
                }
            }
        }
    }

    private addPoint() {
        // TODO
    }

    private canAddPoint() {
        return selectionAddShape.value === 'free';
    }
}
