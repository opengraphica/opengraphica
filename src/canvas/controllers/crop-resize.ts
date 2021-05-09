import BaseCanvasMovementController from './base-movement';
import { top, left, width, height, cropResizeEmitter, enableSnapping, dragHandleHighlight, previewXSnap, previewYSnap, dimensionLockRatio } from '../store/crop-resize-state';
import { DecomposedMatrix } from '@/lib/dom-matrix';
import canvasStore from '@/store/canvas';
import preferencesStore from '@/store/preferences';
import workingFileStore from '@/store/working-file';
import appEmitter from '@/lib/emitter';

const DRAG_TYPE_ALL = 0;
const DRAG_TYPE_TOP = 1;
const DRAG_TYPE_BOTTOM = 2;
const DRAG_TYPE_LEFT = 4;
const DRAG_TYPE_RIGHT = 8;

export default class CanvasCropResizeontroller extends BaseCanvasMovementController {

    private remToPx: number = 16;
    private cropTranslateStart: DOMPoint | null = null;
    private cropStartDimensions: { top: number, left: number, width: number, height: number } = { top: 0, left: 0, width: 0, height: 0};
    private cropDragType: number = 0;
    private xAxisSnap: number[] = [];
    private yAxisSnap: number[] = [];
    private snapSensitivity = 0;

    onEnter(): void {
        super.onEnter();
        this.remToPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
        dimensionLockRatio.value = null;
        top.value = 0;
        left.value = 0;
        width.value = workingFileStore.get('width');
        height.value = workingFileStore.get('height');
        this.xAxisSnap = [0, Math.floor(width.value / 2), width.value];
        this.yAxisSnap = [0, Math.floor(height.value / 2), height.value];
        appEmitter.emit('app.canvas.resetTransform', { margin: Math.floor(Math.min(window.innerWidth, window.innerHeight) / 3) });
    }

    onMultiTouchDown() {
        super.onMultiTouchDown();
        if (this.touches.length === 1) {
            this.onCropDown();
        }
    }

    onPointerDown(e: PointerEvent): void {
        super.onPointerDown(e);
        if (e.isPrimary && ['mouse', 'pen'].includes(e.pointerType) && e.button === 0) {
            this.onCropDown();
        }
    }

    onCropDown() {
        const devicePixelRatio = window.devicePixelRatio || 1;
        const transform = canvasStore.get('transform');
        const decomposedTransform = canvasStore.get('decomposedTransform');
        const point = new DOMPoint(this.lastCursorX * devicePixelRatio, this.lastCursorY * devicePixelRatio).matrixTransform(transform.inverse());
        this.cropTranslateStart = point;
        this.cropStartDimensions = { top: top.value, left: left.value, width: width.value, height: height.value };
        this.snapSensitivity = preferencesStore.get('snapSensitivity') / decomposedTransform.scaleX * devicePixelRatio;

        // Determine which dimensions to drag on
        let cropDragType = this.getCropDragType(point, decomposedTransform);
        if (cropDragType != null) {
            this.cropDragType = cropDragType;
            dragHandleHighlight.value = cropDragType;
        } else {
            this.cropTranslateStart = null;
            dragHandleHighlight.value = null;
        }
    }

    onPointerMove(e: PointerEvent): void {
        super.onPointerMove(e);
        if (e.isPrimary && this.cropTranslateStart) {
            const devicePixelRatio = window.devicePixelRatio || 1;
            const transform = canvasStore.get('transform');
            const cropTranslateMove = new DOMPoint(this.lastCursorX * devicePixelRatio, this.lastCursorY * devicePixelRatio).matrixTransform(transform.inverse());

            const isDragAll = this.cropDragType === DRAG_TYPE_ALL;
            let isDragLeft = Math.floor(this.cropDragType / DRAG_TYPE_LEFT) % 2 === 1;
			let isDragRight = Math.floor(this.cropDragType / DRAG_TYPE_RIGHT) % 2 === 1;
			let isDragTop = Math.floor(this.cropDragType / DRAG_TYPE_TOP) % 2 === 1;
			let isDragBottom = Math.floor(this.cropDragType / DRAG_TYPE_BOTTOM) % 2 === 1;

            const dx = Math.round(cropTranslateMove.x - this.cropTranslateStart.x);
            const dy = Math.round(cropTranslateMove.y - this.cropTranslateStart.y);
            let offsetWidth = this.cropStartDimensions.width + dx;
            let offsetHeight = this.cropStartDimensions.height + dy;
            if (isDragLeft) {
                offsetWidth = this.cropStartDimensions.width - dx;
            }
            if (isDragTop) {
                offsetHeight = this.cropStartDimensions.height - dy;
            }

            // Determine dimensions
            let left = this.cropStartDimensions.left;
            let top = this.cropStartDimensions.top;
            let width = this.cropStartDimensions.width;
            let height = this.cropStartDimensions.height;
            if (isDragAll) {
                top = this.cropStartDimensions.top + dy;
                left = this.cropStartDimensions.left + dx;
            }
            if (isDragTop) {
                top = this.cropStartDimensions.top - (offsetHeight - this.cropStartDimensions.height);
            }
            if (isDragLeft) {
                left = this.cropStartDimensions.left - (offsetWidth - this.cropStartDimensions.width);
            }
            if (isDragLeft || isDragRight) {
                width = offsetWidth;
            }
            if (isDragTop || isDragBottom) {
                height = offsetHeight;
            }

            // Don't allow negative width/height
            if (width <= 0) {
                width = Math.abs(width);
                if (isDragLeft) {
                    isDragLeft = false;
                    isDragRight = true;
                    left -= width;
                } else {
                    isDragLeft = true;
                    isDragRight = false;
                    left = this.cropStartDimensions.left - width;
                }
            }
            if (height <= 0) {
                height = Math.abs(height);
                if (isDragTop) {
                    isDragTop = false;
                    isDragBottom = true;
                    top -= height;
                } else {
                    isDragTop = true;
                    isDragBottom = false;
                    top = this.cropStartDimensions.top - height;
                }
            }

            // Snapping
            if (enableSnapping.value) {
                let xSnap: number | null = null;
                let ySnap: number | null = null;
                if (!dimensionLockRatio.value || !(isDragTop || isDragBottom)) {
                    if (isDragLeft || isDragAll) {
                        xSnap = this.snapPointX(left);
                        let difference = (xSnap != null ? xSnap : left) - left;
                        left += difference;
                        if (isDragAll) {
                            const halfWidth = Math.floor(width / 2);
                            let halfWidthXSnap = this.snapPointX(left + halfWidth);
                            if (halfWidthXSnap != null) {
                                xSnap = halfWidthXSnap;
                                left = (xSnap != null ? xSnap : (left + halfWidth)) - halfWidth;
                            }
                            let widthXSnap = this.snapPointX(left + width);
                            if (widthXSnap != null) {
                                xSnap = widthXSnap;
                                left = (xSnap != null ? xSnap : (left + width)) - width;
                            }
                        } else {
                            width -= difference;
                        }
                    } else if (isDragRight) {
                        xSnap = this.snapPointX(left + width);
                        width = (xSnap != null ? xSnap : (left + width)) - left;
                    }
                }
                if (isDragTop || isDragAll) {
                    ySnap = this.snapPointY(top);
                    let difference = (ySnap != null ? ySnap : top) - top;
                    top += difference;
                    if (isDragAll) {
                        const halfHeight = Math.floor(height / 2);
                        let halfHeightYSnap = this.snapPointY(top + halfHeight);
                        if (halfHeightYSnap != null) {
                            ySnap = halfHeightYSnap;
                            top = (ySnap != null ? ySnap : (top + halfHeight)) - halfHeight;
                        }
                        let heightYSnap = this.snapPointY(top + height);
                        if (heightYSnap != null) {
                            ySnap = heightYSnap;
                            top = (ySnap != null ? ySnap : (top + height)) - height;
                        }
                    } else {
                        height -= difference;                        
                    }
                } else if (isDragBottom) {
                    ySnap = this.snapPointY(top + height);
                    height = (ySnap != null ? ySnap : (top + height)) - top;
                }
                previewXSnap.value = xSnap;
                previewYSnap.value = ySnap;
            }

            // Enforce Width/Height Ratio (After Snap)
            if (dimensionLockRatio.value) {
                if (!(isDragTop || isDragBottom)) {
                    height = Math.round(width / dimensionLockRatio.value);
                } else {
                    let originalWidth = width;
                    width = Math.round(height * dimensionLockRatio.value);
                    if (isDragLeft) {
                        left += originalWidth - width;
                    }
                }
            }

            cropResizeEmitter.emit('setCrop', {
                top, left, width, height
            });
        }
        if (!this.cropTranslateStart && e.isPrimary && ['mouse', 'pen'].includes(e.pointerType)) {
            const transform = canvasStore.get('transform');
            const decomposedTransform = canvasStore.get('decomposedTransform');
            const point = new DOMPoint(this.lastCursorX * devicePixelRatio, this.lastCursorY * devicePixelRatio).matrixTransform(transform.inverse());
            let cropDragType = this.getCropDragType(point, decomposedTransform);
            if (cropDragType != null) {
                dragHandleHighlight.value = cropDragType;
            } else {
                dragHandleHighlight.value = null;
            }
        }
    }

    onPointerUp(e: PointerEvent): void {
        super.onPointerUp(e);
        if (e.isPrimary) {
            if (this.cropTranslateStart) {
                width.value = Math.max(1, width.value);
                height.value = Math.max(1, height.value);
                previewXSnap.value = null;
                previewYSnap.value = null;
                this.cropTranslateStart = null;
            }
            dragHandleHighlight.value = null;
        }
    }

    getCropDragType(point: DOMPoint, decomposedTransform: DecomposedMatrix): number | null {
        const devicePixelRatio = window.devicePixelRatio || 1;
        let cropDragType: number | null = 0;
        const handleSize = 2 * this.remToPx / decomposedTransform.scaleX * devicePixelRatio;
        const halfHandleSize = handleSize / 2;
        if (point.y >= top.value - halfHandleSize && point.y <= top.value + handleSize) {
            cropDragType |= DRAG_TYPE_TOP;
        }
        if (point.y >= top.value + height.value - handleSize && point.y <= top.value + height.value + halfHandleSize) {
            cropDragType |= DRAG_TYPE_BOTTOM;
        }
        if (point.x >= left.value - halfHandleSize && point.x <= left.value + handleSize) {
            cropDragType |= DRAG_TYPE_LEFT;
        }
        if (point.x >= left.value + width.value - handleSize && point.x <= left.value + width.value + halfHandleSize) {
            cropDragType |= DRAG_TYPE_RIGHT;
        }
        if (
            point.x < left.value - halfHandleSize ||
            point.x > left.value + width.value + halfHandleSize ||
            point.y < top.value - halfHandleSize ||
            point.y > top.value + height.value + halfHandleSize
        ) {
            cropDragType = null;
        }
        return cropDragType;
    }

    snapPointX(point: number): number | null {
        const snapSensitivity = this.snapSensitivity;
        for (let snapPoint of this.xAxisSnap) {
            if (point - snapSensitivity < snapPoint && point + snapSensitivity > snapPoint) {
                return snapPoint;
            }
            if (snapPoint - snapSensitivity > point) {
                break;
            }
        }
        return null;
    }

    snapPointY(point: number): number | null {
        const snapSensitivity = this.snapSensitivity;
        for (let snapPoint of this.yAxisSnap) {
            if (point - snapSensitivity < snapPoint && point + snapSensitivity > snapPoint) {
                return snapPoint;
            }
            if (snapPoint - snapSensitivity > point) {
                break;
            }
        }
        return null;
    }

}
