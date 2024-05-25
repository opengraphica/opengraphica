import BaseCanvasMovementController from './base-movement';
import canvasStore from '@/store/canvas';

const DRAG_TYPE_ALL = 0;
const DRAG_TYPE_TOP = 1;
const DRAG_TYPE_BOTTOM = 2;
const DRAG_TYPE_LEFT = 4;
const DRAG_TYPE_RIGHT = 8;

export default class CanvasTextController extends BaseCanvasMovementController {
    onEnter(): void {
        super.onEnter();
        
    }

    protected handleCursorIcon() {
        let newIcon = super.handleCursorIcon();
        if (!newIcon) {
            newIcon = 'text';
        }
        canvasStore.set('cursor', newIcon);
        return newIcon;
    }
}
