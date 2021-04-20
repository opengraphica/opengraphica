import BaseCanvasMovementController from './base-movement';
import { top, left, width, height, cropResizeEmitter } from '../store/crop-resize-state';
import canvasStore from '@/store/canvas';
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

    onEnter(): void {
        super.onEnter();
        this.remToPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
        top.value = 0;
        left.value = 0;
        width.value = workingFileStore.get('width');
        height.value = workingFileStore.get('height');
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
        if (e.isPrimary && ['mouse', 'pen'].includes(e.pointerType)) {
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
        const handleSize = 2 * this.remToPx / decomposedTransform.scaleX * devicePixelRatio;
        const halfHandleSize = handleSize / 2;
        this.cropDragType = 0;
        if (point.y >= top.value - halfHandleSize && point.y <= top.value + handleSize) {
            this.cropDragType |= DRAG_TYPE_TOP;
        }
        if (point.y >= top.value + height.value - handleSize && point.y <= top.value + height.value + halfHandleSize) {
            this.cropDragType |= DRAG_TYPE_BOTTOM;
        }
        if (point.x >= left.value - halfHandleSize && point.x <= left.value + handleSize) {
            this.cropDragType |= DRAG_TYPE_LEFT;
        }
        if (point.x >= left.value + width.value - handleSize && point.x <= left.value + width.value + halfHandleSize) {
            this.cropDragType |= DRAG_TYPE_RIGHT;
        }
        if (
            point.x < left.value - halfHandleSize ||
            point.x > left.value + width.value + halfHandleSize ||
            point.y < top.value - halfHandleSize ||
            point.y > top.value + height.value + halfHandleSize
        ) {
            this.cropTranslateStart = null;
        }
    }

    onPointerMove(e: PointerEvent): void {
        super.onPointerMove(e);
        if (e.isPrimary && this.cropTranslateStart) {
            const devicePixelRatio = window.devicePixelRatio || 1;
            const transform = canvasStore.get('transform');
            const cropTranslateMove = new DOMPoint(this.lastCursorX * devicePixelRatio, this.lastCursorY * devicePixelRatio).matrixTransform(transform.inverse());

            const isDragLeft = Math.floor(this.cropDragType / DRAG_TYPE_LEFT) % 2 === 1;
			const isDragRight = Math.floor(this.cropDragType / DRAG_TYPE_RIGHT) % 2 === 1;
			const isDragTop = Math.floor(this.cropDragType / DRAG_TYPE_TOP) % 2 === 1;
			const isDragBottom = Math.floor(this.cropDragType / DRAG_TYPE_BOTTOM) % 2 === 1;

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
            if (this.cropDragType === DRAG_TYPE_ALL) {
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
                    left -= width;
                } else {
                    left = this.cropStartDimensions.left - width;
                }
            }
            if (height <= 0) {
                height = Math.abs(height);
                if (isDragTop) {
                    top -= height;
                } else {
                    top = this.cropStartDimensions.top - height;
                }
            }

            cropResizeEmitter.emit('setCrop', {
                top, left, width, height
            });
        }
    }

    onPointerUp(e: PointerEvent): void {
        super.onPointerUp(e);
        if (e.isPrimary && this.cropTranslateStart) {
            this.cropTranslateStart = null;
        }
    }

}
