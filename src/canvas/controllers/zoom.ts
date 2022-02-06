import { isCtrlKeyPressed } from '@/lib/keyboard';
import { PointerTracker } from './base';
import BaseCanvasMovementController from './base-movement';
import { DecomposedMatrix } from '@/lib/dom-matrix';
import canvasStore from '@/store/canvas';
import preferencesStore from '@/store/preferences';
import workingFileStore from '@/store/working-file';
import appEmitter from '@/lib/emitter';

const devicePixelRatio = window.devicePixelRatio || 1;

export default class CanvasZoomController extends BaseCanvasMovementController {

    onEnter(): void {
        super.onEnter();
    }

    onMultiTouchTap(touches: PointerTracker[]) {
        super.onMultiTouchTap(touches);
        if (touches.length === 1) {
            this.onZoomIn();
        } else if (touches.length === 2) {
            this.onZoomOut();
        }
    }

    onPointerMove(e: PointerEvent): void {
        super.onPointerMove(e);
        const pointer = this.pointers.filter((pointer) => pointer.id === e.pointerId)[0];
        if (pointer && pointer.isDragging && e.isPrimary) {
            canvasStore.set('cursor', 'grabbing');
            const lastCursorX = (pointer.movePrev || pointer.down).pageX;
            const lastCursorY = (pointer.movePrev || pointer.down).pageY;
            const cursorX = e.pageX;
            const cursorY = e.pageY;
            let transform = canvasStore.get('transform');
            const moveTranslateStart = new DOMPoint(lastCursorX * devicePixelRatio, lastCursorY * devicePixelRatio).matrixTransform(transform.inverse());
            // Pan View
            const translateMove = new DOMPoint(cursorX * devicePixelRatio, cursorY * devicePixelRatio).matrixTransform(transform.inverse());
            transform.translateSelf(translateMove.x - moveTranslateStart.x, translateMove.y - moveTranslateStart.y);
            canvasStore.set('transform', transform);
            canvasStore.set('viewDirty', true);
        }
    }

    onPointerUpBeforePurge(e: PointerEvent): void {
        super.onPointerUpBeforePurge(e);

        const pointer = this.pointers.filter((pointer) => pointer.id === e.pointerId)[0];
        if (pointer) {
            if (pointer.isDragging) {
                canvasStore.set('cursor', null);
            } else {
                if (e.isPrimary && ['mouse', 'pen'].includes(e.pointerType) && e.button === 0) {
                    if (isCtrlKeyPressed.value === true) {
                        this.onZoomOut();
                    } else {
                        this.onZoomIn();
                    }
                }
            }
        }
    }

    onZoomIn() {
        this.zoomCanvas(3);
    }

    onZoomOut() {
        this.zoomCanvas(-3);
    }
}
