import BaseMovementController from './base-movement';
import { PointerTracker } from './base';
import {
    appliedSelectionMask, appliedSelectionMaskCanvasOffset, activeSelectionMask, activeSelectionMaskCanvasOffset, selectionMaskDrawMargin,
    isDrawingSelection, selectionAddShape, workingSelectionPath, selectionEmitter, discardActiveSelectionMask, discardAppliedSelectionMask,
    applyActiveSelection, previewActiveSelectionMask
} from '../store/selection-state';
import canvasStore from '@/store/canvas';
import appEmitter from '@/lib/emitter';



export default class SelectionController extends BaseMovementController {
    onEnter(): void {
        super.onEnter();
        appEmitter.on('editor.tool.commitCurrentAction', this.applyActiveSelection.bind(this));
        appEmitter.on('editor.tool.selectAll', this.clearSelection.bind(this));
        selectionEmitter.on('applyActiveSelection', this.applyActiveSelection.bind(this));
        selectionEmitter.on('clearSelection', this.clearSelection.bind(this));
    }

    onLeave(): void {
        super.onLeave();
        appEmitter.off('editor.tool.commitCurrentAction', this.applyActiveSelection.bind(this));
        appEmitter.off('editor.tool.selectAll', this.clearSelection.bind(this));
        selectionEmitter.off('applyActiveSelection', this.applyActiveSelection.bind(this));
        selectionEmitter.off('clearSelection', this.clearSelection.bind(this));
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

    async onPointerDragStart(e: PointerEvent) {
        super.onPointerDragStart(e);
        const pointer = this.pointers.filter((pointer) => pointer.id === e.pointerId)[0];
        if (pointer && (pointer.type !== 'touch' || this.multiTouchDownCount === 1)) {
            if (e.isPrimary && pointer.down.button === 0) {
                await this.applyActiveSelection();
            }
        }
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
                this.previewActiveSelectionMask();
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

    async applyActiveSelection() {
        await applyActiveSelection();
        canvasStore.set('viewDirty', true);
    }

    async discardActiveSelectionMaskPreview() {
        discardActiveSelectionMask();
        canvasStore.set('viewDirty', true);
    }

    async previewActiveSelectionMask() {
        await previewActiveSelectionMask();
        canvasStore.set('viewDirty', true);
    }

    clearSelection() {
        discardActiveSelectionMask();
        discardAppliedSelectionMask();
        workingSelectionPath.value = [];
        canvasStore.set('viewDirty', true);
    }
}
