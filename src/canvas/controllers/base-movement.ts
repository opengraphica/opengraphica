import BaseCanvasController, { PointerTracker } from './base';
import canvasStore from '@/store/canvas';
import preferencesStore from '@/store/preferences';
import { pointDistance2d } from '@/lib/math';

export default class BaseCanvasMovementController extends BaseCanvasController {

    protected lastCursorX: number = 0;
    protected lastCursorY: number = 0;

    protected moveTranslateStart: DOMPoint | null = null;
    protected moveTouchDistanceStart: number = 0;
    protected moveTouchDistanceLatest: number = 0;
    protected moveScaleStart: number = 1;
    protected moveTouchAngleStart: number = 0;
    protected moveTouchAngleLatest: number = 0;
    protected moveRotationStart: number = 0;
    protected moveTouchCountTracker: number = 0;

    constructor() {
        super();
    }

    onPointerDown(e: PointerEvent): void {
        super.onPointerDown(e);
        const devicePixelRatio = window.devicePixelRatio || 1;
        const touches = this.touches;
        if (e.isPrimary) {
            this.lastCursorX = e.pageX;
            this.lastCursorY = e.pageY;
        }
        if (e.pointerType === 'mouse' && (e.button === 1 || e.button === 2)) {
            const transform = canvasStore.get('transform');
            this.moveTranslateStart = new DOMPoint(this.lastCursorX * devicePixelRatio, this.lastCursorY * devicePixelRatio).matrixTransform(transform.inverse());
            this.handleCursorIcon();
            canvasStore.set('cursorX', e.pageX * devicePixelRatio);
            canvasStore.set('cursorY', e.pageY * devicePixelRatio);
            canvasStore.set('viewDirty', true);
        }
    }

    onMultiTouchDown() {
        super.onMultiTouchDown();
        const devicePixelRatio = window.devicePixelRatio || 1;
        const touches = this.touches;
        if (touches.length === 2) {
            this.lastCursorX = (touches[0].down.pageX + touches[1].down.pageX) / 2;
            this.lastCursorY = (touches[0].down.pageY + touches[1].down.pageY) / 2;
            const transform = canvasStore.get('transform');
            this.moveTranslateStart = new DOMPoint(this.lastCursorX * devicePixelRatio, this.lastCursorY * devicePixelRatio).matrixTransform(transform.inverse());
            this.moveTouchDistanceStart = pointDistance2d(touches[0].down.pageX, touches[0].down.pageY, touches[1].down.pageX, touches[1].down.pageY);
            this.moveTouchAngleStart = Math.atan2(touches[1].down.pageY - touches[0].down.pageY, touches[1].down.pageX - touches[0].down.pageX);
            const decomposed = canvasStore.get('decomposedTransform');
            this.moveScaleStart = decomposed.scaleX;
            this.moveRotationStart = decomposed.rotation;
            this.moveTouchCountTracker = 2;
        }
    }

    onMultiTouchUp() {
        if (this.moveTranslateStart) {
            this.moveTranslateStart = null;
        }
    }

    onPointerMove(e: PointerEvent): void {
        super.onPointerMove(e);
        const devicePixelRatio = window.devicePixelRatio || 1;
        if (e.isPrimary) {
            this.lastCursorX = e.pageX;
            this.lastCursorY = e.pageY;
        }
        if (this.moveTranslateStart) {
            const touches = this.touches;
            if (touches.length > 0) {
                const isNumberTouchesChanged = this.moveTouchCountTracker != this.touches.length;
                this.moveTouchCountTracker = touches.length;

                const touch0 = (touches[0].move || touches[0].down);
                const touch1 = touches[1] && (touches[1].move || touches[1].down);
                let cursorX = touch0.x;
                let cursorY = touch0.y;
                if (touch1) {
                    cursorX = (touch0.x + touch1.x) / 2;
                    cursorY = (touch0.y + touch1.y) / 2;
                }

                if (isNumberTouchesChanged) {
                    const transform = canvasStore.get('transform');
                    this.moveTranslateStart = new DOMPoint(cursorX * devicePixelRatio, cursorY * devicePixelRatio).matrixTransform(transform.inverse());
                    if (touches.length > 1) {
                        this.moveTouchDistanceStart = pointDistance2d(touch0.pageX, touch0.pageY, touch1.pageX, touch1.pageY);
                        this.moveTouchAngleStart = Math.atan2(touch1.pageY - touch0.pageY, touch1.pageX - touch0.pageX);
                        const decomposed = canvasStore.get('decomposedTransform');
                        this.moveScaleStart = decomposed.scaleX;
                        this.moveRotationStart = decomposed.rotation;
                    }
                }

                this.lastCursorX = cursorX;
                this.lastCursorY = cursorY;
                const transform = new DOMMatrix([1, 0, 0, 1, 0, 0]);

                // Pan View
                const translateMove = new DOMPoint(this.lastCursorX * devicePixelRatio, this.lastCursorY * devicePixelRatio).matrixTransform(transform.inverse());
                transform.translateSelf(translateMove.x - this.moveTranslateStart.x, translateMove.y - this.moveTranslateStart.y);

                // Scale/Rotate View
                let touchDistance = this.moveTouchDistanceLatest;
                if (touches.length >= 2) {
                    touchDistance = pointDistance2d(touch0.x, touch0.y, touch1.x, touch1.y);
                }
                this.moveTouchDistanceLatest = touchDistance;
                const scaleFactor = touchDistance / this.moveTouchDistanceStart;

                const touchRotation = preferencesStore.get('touchRotation');
                let angleDifference: number = 0;
                if (touchRotation === 'on' || touchRotation === 'snap') {
                    let touchAngle = this.moveTouchAngleLatest;
                    if (touches.length >= 2) {
                        touchAngle = Math.atan2(touch1.y - touch0.y, touch1.x - touch0.x);
                    }
                    this.moveTouchAngleLatest = touchAngle;
                    angleDifference = touchAngle - this.moveTouchAngleStart;
                    if (touchRotation === 'snap') {
                        let finalAngle = (this.moveRotationStart + angleDifference);
                        finalAngle = Math.round(finalAngle / (Math.PI/24)) * (Math.PI/24);
                        angleDifference = -this.moveRotationStart + finalAngle;
                    }
                }

                // Apply
                const point = new DOMPoint(this.lastCursorX * devicePixelRatio, this.lastCursorY * devicePixelRatio).matrixTransform(transform.inverse());
                transform.translateSelf(point.x, point.y);
                transform.scaleSelf(this.moveScaleStart * scaleFactor, this.moveScaleStart * scaleFactor);
                transform.rotateSelf((this.moveRotationStart + angleDifference) * Math.RADIANS_TO_DEGREES);
                transform.translateSelf(-point.x, -point.y);
                canvasStore.set('transform', transform);
                canvasStore.set('viewDirty', true);
            } else if (e.pointerType === 'mouse') {
                const transform = canvasStore.get('transform');
                const translateMove = new DOMPoint(this.lastCursorX * devicePixelRatio, this.lastCursorY * devicePixelRatio).matrixTransform(transform.inverse());
                transform.translateSelf(translateMove.x - this.moveTranslateStart.x, translateMove.y - this.moveTranslateStart.y);
                canvasStore.set('transform', transform);
                canvasStore.set('cursorX', e.pageX * devicePixelRatio);
                canvasStore.set('cursorY', e.pageY * devicePixelRatio);
                canvasStore.set('viewDirty', true);
            }
        }
    }

    onPointerUp(e: PointerEvent): void {
        super.onPointerUp(e);
        if (this.moveTranslateStart) {
            if ((e.pointerType === 'mouse' && (e.button === 1 || e.button === 2))) {
                this.moveTranslateStart = null;
                this.handleCursorIcon();
            }
        }
        canvasStore.set('viewDirty', true);
    }

    onWheel(e: WheelEvent): void {
        super.onWheel(e);

        const wheelSpeed = this.normalizeWheel(e);

        const delta = wheelSpeed.pixelY;

        if (delta) {
            this.zoomCanvas(-delta / 80.0);
        }

        e.preventDefault();
    }

    protected normalizeWheel(event: WheelEvent | any) {
        let pixelStep = 10;
        let lineHeight = 40;
        let pageHeight = 800;
    
        let sX = 0, sY = 0, // spinX, spinY
            pX = 0, pY = 0; // pixelX, pixelY
    
        // Legacy
        if ('detail' in event) { sY = event.detail; }
        if ('wheelDelta' in event) { sY = -event.wheelDelta / 120; }
        if ('wheelDeltaY' in event) { sY = -event.wheelDeltaY / 120; }
        if ('wheelDeltaX' in event) { sX = -event.wheelDeltaX / 120; }
    
        // Side scrolling on FF with DOMMouseScroll
        if ('axis' in event && event.axis === event.HORIZONTAL_AXIS) {
            sX = sY;
            sY = 0;
        }
    
        pX = sX * pixelStep;
        pY = sY * pixelStep;
    
        if ('deltaY' in event) { pY = event.deltaY; }
        if ('deltaX' in event) { pX = event.deltaX; }
    
        if ((pX || pY) && event.deltaMode) {
            if (event.deltaMode == 1) { // delta in LINE units
                pX *= lineHeight;
                pY *= lineHeight;
            } else { // delta in PAGE units
                pX *= pageHeight;
                pY *= pageHeight;
            }
        }
    
        // Fall-back if spin cannot be determined
        if (pX && !sX) { sX = (pX < 1) ? -1 : 1; }
        if (pY && !sY) { sY = (pY < 1) ? -1 : 1; }
    
        return {
            spinX: sX,
            spinY: sY,
            pixelX: pX,
            pixelY: pY
        };
    }

    protected zoomCanvas(clicks: number) {
        const devicePixelRatio = window.devicePixelRatio || 1;
        const scaleFactor: number = 1.1;
        const transform = canvasStore.get('transform');
        const point = new DOMPoint(this.lastCursorX * devicePixelRatio, this.lastCursorY * devicePixelRatio).matrixTransform(transform.inverse());
        transform.translateSelf(point.x, point.y);
        const factor = Math.pow(scaleFactor, clicks);
        transform.scaleSelf(factor, factor);
        transform.translateSelf(-point.x, -point.y);
        canvasStore.set('transform', transform);
        canvasStore.set('viewDirty', true);
    }

    protected handleCursorIcon() {
        let newIcon = super.handleCursorIcon();
        if (!newIcon) {
            if (this.moveTranslateStart) {
                newIcon = 'grabbing';
            }
        }
        canvasStore.set('cursor', newIcon);
        return newIcon;
    }

}
