import { CanvasRenderingContext2DEnhanced } from '@/types';
import canvasStore from '@/store/canvas';
import preferencesStore from '@/store/preferences';
import appEmitter from '@/lib/emitter';

export interface PointerTracker {
    id: number,
    type: 'mouse' | 'pen' | 'touch',
    primary: boolean,
    down: PointerEvent,
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

    /**
     * Fires when switching to this controller.
     */
    onEnter(): void {
        // Override
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
        const touchCount = this.touches.length;
        this.multiTouchDownCount = this.touches.length;
        clearTimeout(this.multiTouchTapTimeoutHandle);
        this.multiTouchTapTimeoutHandle = window.setTimeout(() => {
            this.multiTouchDownTimeoutHandle = undefined;
            this.multiTouchTapTimeoutHandle = undefined;
            this.purgeTouches();
            if (this.touches.length === 0) {
                this.onMultiTouchTap(touchCount);
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
    onMultiTouchTap(count: number): void {
        // Override
    }

    onPointerDown(e: PointerEvent): void {
        const pointer: PointerTracker = {
            id: e.pointerId,
            type: e.pointerType as any,
            primary: e.isPrimary,
            down: e
        };
        this.pointers.push(pointer as any);
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
        }
    }

    onPointerUp(e: PointerEvent): void {
        const pointer = this.pointers.filter((pointer) => pointer.id === e.pointerId)[0];
        if (pointer) {
            pointer.up = e;
        }
        const pointerIndex = this.pointers.findIndex((pointer) => pointer.id === e.pointerId);
        if (pointerIndex > -1) {
            this.pointers.splice(pointerIndex, 1);
        }
        this.purgeTouches();
        if (this.pointers.length === 0) {
            canvasStore.set('preventPostProcess', false);
        }
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
