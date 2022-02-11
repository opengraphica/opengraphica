import { nextTick } from 'vue';
import { CanvasRenderingContext2DEnhanced } from '@/types';
import canvasStore from '@/store/canvas';
import preferencesStore from '@/store/preferences';
import appEmitter from '@/lib/emitter';
import { isInput } from '@/lib/events';

export interface PointerTracker {
    id: number,
    type: 'mouse' | 'pen' | 'touch',
    primary: boolean,
    isDragging: boolean,
    down: PointerEvent,
    downTimestamp: number,
    move?: PointerEvent,
    movePrev?: PointerEvent,
    up?: PointerEvent
}

/**
 * Handles basic pointer inputs.
 * 
 * Multi-touch
 * When the user touches the canvas with one or more fingers at the same time. Multi-touch does not fire again until all fingers are released.
 * Event order: onMultiTouchDown, onMultiTouchUp, onMultiTouchTap (tap only fires upon quick release)
 * 
 * Pointer
 * When any mouse, pen, or touch input touches the screen. Fires once for each.
 * Event order: onPointerDown, onPointerMove, onPointerUp
 * 
 * Wheel
 * When a mouse scroll wheel or other trackpad scroll is used.
 * 
 */
export default class BaseCanvasController {

    protected canvas!: HTMLCanvasElement; 
    protected ctx!: CanvasRenderingContext2DEnhanced;
    protected pointers: PointerTracker[] = [];
    protected touches: PointerTracker[] = []; // Populated at onMultiTouchDown(), once the multi-touch tap timeout extinquishes.
    protected multiTouchDownCount: number = 0;
    
    private multiTouchDownTimeoutHandle: number | undefined;
    private multiTouchTapTimeoutHandle: number | undefined;
    private dragStartRadius = preferencesStore.get('dragStartRadius');

    /**
     * Fires when switching to this controller.
     */
    onEnter(): void {
        // View can shift due to toolbar show/hiding. If it was previously reset, reset again for correct layout.
        setTimeout(async () => {
            await nextTick();
            const canvasTransformResetOptions = canvasStore.get('transformResetOptions');
            if (canvasTransformResetOptions) {
                appEmitter.emit('app.canvas.resetTransform', canvasTransformResetOptions !== true ? canvasTransformResetOptions : undefined);
            }
        }, 0);
    }

    /**
     * Fires right before switching to another controller.
     */
    onLeave(): void {
        // Override
    }

    /**
     * Fires when one or more finger is tapped at around the same time.
     */
    onMultiTouchDown(): void {
        this.multiTouchDownCount = this.touches.length;
        const touches: PointerTracker[] = [...this.touches];
        clearTimeout(this.multiTouchTapTimeoutHandle);
        this.multiTouchTapTimeoutHandle = window.setTimeout(() => {
            this.multiTouchDownTimeoutHandle = undefined;
            this.multiTouchTapTimeoutHandle = undefined;
            this.purgeTouches();
            if (this.touches.length === 0) {
                this.onMultiTouchTap(touches);
            }
        }, preferencesStore.get('multiTouchTapTimeout'));
    }

    /**
     * Fires when all fingers are released after onMultiTouchDown.
     */
    onMultiTouchUp(): void {
        // Override
    }

    /**
     * Fires when multi-touch down and up happen in quick succession.
     * @param count - Number of touches in the tap. By the time this event fires, this.touches array will be empty.
     */
    onMultiTouchTap(touches: PointerTracker[]): void {
        // Override
    }

    onPointerDown(e: PointerEvent): void {
        if (isInput(e.target)) return;

        const pointer: PointerTracker = {
            id: e.pointerId,
            type: e.pointerType as any,
            primary: e.isPrimary,
            isDragging: false,
            down: e,
            downTimestamp: window.performance.now()
        };
        this.pointers.push(pointer as any);
        this.dragStartRadius = preferencesStore.get('dragStartRadius');
        if (e.pointerType === 'touch') {
            if (!this.multiTouchDownTimeoutHandle && this.touches.length === 0) {
                this.touches = [pointer];
                this.multiTouchDownTimeoutHandle = window.setTimeout(() => {
                    this.onMultiTouchDown();
                }, preferencesStore.get('multiTouchDownTimeout'));
            } else {
                this.touches.push(pointer);
            }
        }
        canvasStore.set('preventPostProcess', true);
    }

    onPointerMove(e: PointerEvent): void {
        const pointer = this.pointers.filter((pointer) => pointer.id === e.pointerId)[0];
        if (pointer) {
            pointer.movePrev = pointer.move;
            pointer.move = e;
            if (
                Math.abs(pointer.down.pageX - pointer.move.pageX) >= this.dragStartRadius ||
                Math.abs(pointer.down.pageY - pointer.move.pageY) >= this.dragStartRadius
            ) {
                pointer.isDragging = true;
            }
        }
    }

    onPointerUp(e: PointerEvent): void {
        const pointer = this.pointers.filter((pointer) => pointer.id === e.pointerId)[0];
        if (pointer) {
            pointer.up = e;
        }
        this.onPointerUpBeforePurge(e);
        const pointerIndex = this.pointers.findIndex((pointer) => pointer.id === e.pointerId);
        if (pointerIndex > -1) {
            this.pointers.splice(pointerIndex, 1);
        }
        this.purgeTouches();
        if (this.pointers.length === 0) {
            canvasStore.set('preventPostProcess', false);
        }
    }

    onPointerUpBeforePurge(e: PointerEvent): void {
        // Override
    }

    onWheel(e: WheelEvent): void {
        // Override
    }

    private purgeTouches() {
        if (!this.multiTouchDownTimeoutHandle) {
            const actualTouches = this.pointers.filter((pointer) => pointer.type === 'touch');
            if (actualTouches.length === 0) {
                this.touches = [];
            }
            else if (this.touches.length !== 0) {
                for (let i = this.touches.length - 1; i >= 0; i--) {
                    const touch = this.touches[i];
                    const pointerIndex = this.pointers.findIndex((pointer) => pointer.id === touch.id);
                    if (pointerIndex === -1) {
                        this.touches.splice(i, 1);
                    }
                }
            }
            if (this.multiTouchDownCount > 0 && this.touches.length === 0) {
                this.onMultiTouchUp();
                this.multiTouchDownCount = 0; // <- Must occur after the callback for information purposes.
            }
        }
    }

}
