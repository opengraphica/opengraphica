import { watch, WatchStopHandle } from 'vue';
import { isCtrlOrMetaKeyPressed } from '@/lib/keyboard';
import { PointerTracker } from './base';
import BaseCanvasMovementController from './base-movement';
import { dismissTutorialNotification, scheduleTutorialNotification, waitForNoOverlays } from '@/lib/tutorial';
import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';

const devicePixelRatio = window.devicePixelRatio || 1;

export default class CanvasZoomController extends BaseCanvasMovementController {

    private ctrlKeyUnwatch: WatchStopHandle | null = null;
    private isDragging: boolean = false;

    onEnter(): void {
        super.onEnter();
        this.ctrlKeyUnwatch = watch([isCtrlOrMetaKeyPressed], ([isCtrlOrMetaKeyPressed]) => {
            this.handleCursorIcon();
        });

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
        if (this.ctrlKeyUnwatch) {
            this.ctrlKeyUnwatch();
            this.ctrlKeyUnwatch = null;
        }

        // Tutorial Message
        if (!editorStore.state.tutorialFlags.drawToolIntroduction) {
            dismissTutorialNotification('drawToolIntroduction');
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
        // const pointer = this.pointers.filter((pointer) => pointer.id === e.pointerId)[0];
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
}
