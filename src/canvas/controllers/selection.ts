import BaseMovementController from './base-movement';
import { ref, watch, toRefs, WatchStopHandle } from 'vue';
import {
    isDrawingSelection, selectionAddShape, activeSelectionPath, selectionCombineMode, selectionEmitter,
    SelectionPathPoint, appliedSelectionMask, previewSelectedLayersSelectionMask, discardSelectedLayersSelectionMask,
    type SelectionPathPointBezierCurve,
} from '../store/selection-state';
import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import historyStore from '@/store/history';
import workingFileStore from '@/store/working-file';
import appEmitter from '@/lib/emitter';
import { normalizedDirectionVector2d, rotateDirectionVector2d, pointDistance2d, lineIntersectsLine2d } from '@/lib/math';
import { dismissTutorialNotification, scheduleTutorialNotification, waitForNoOverlays } from '@/lib/tutorial';
import { ApplyActiveSelectionAction } from '@/actions/apply-active-selection';
import { BundleAction } from '@/actions/bundle';
import { ClearSelectionAction } from '@/actions/clear-selection';
import { UpdateActiveSelectionAction } from '@/actions/update-active-selection';
import { UpdateSelectionCombineModeAction } from '@/actions/update-selection-combine-mode';

import type { PointerTracker } from './base';

export default class SelectionController extends BaseMovementController {
    private asyncActionStack: Array<{ callback: (...args: any[]) => Promise<any>, args?: any[] }> = [];
    private currentAsyncAction: ({ callback: (...args: any[]) => Promise<any>, args?: any[] }) | undefined = undefined;
    private dragStartActiveSelectionPath: Array<SelectionPathPoint> | undefined = undefined;
    private dragStartActiveSelectionPathIsClosed: boolean = false;
    private dragStartHandleIndex: number = -1;
    private dragStartRectangleOriginToLeftDirection: { x: number, y: number } | null = null; 
    private dragStartRectangleOriginToRightDirection: { x: number, y: number } | null = null;
    private dragStartEllipsePerpendicularRadius: number | null = null;
    private freePathStartActiveSelectionPath: Array<SelectionPathPoint> | undefined = undefined;
    private selectedLayerUnwatch: WatchStopHandle | null = null;

    private hoveringActiveSelectionPathIndex: number = -1;
    private dragHandleRadius: number = 6;
    private dragHandleRadiusTouch: number = 10;

    queueAsyncAction(callback: (...args: any[]) => Promise<any>, args?: any[]) {
        this.asyncActionStack.push({
            callback,
            args
        });
        this.runCurrentAsyncAction();
    }

    runCurrentAsyncAction() {
        if (this.currentAsyncAction == null) {
            this.currentAsyncAction = this.asyncActionStack.shift();
            if (this.currentAsyncAction) {
                this.currentAsyncAction.callback.apply(this, this.currentAsyncAction.args || []).then(() => {
                    this.currentAsyncAction = undefined;
                    this.runCurrentAsyncAction();
                }).catch(() => {
                    this.currentAsyncAction = undefined;
                    this.runCurrentAsyncAction();
                });
            }
        }
    }

    async onEnter(): Promise<void> {
        super.onEnter();

        this.queueApplyActiveSelection = this.queueApplyActiveSelection.bind(this);
        this.queueClearSelection = this.queueClearSelection.bind(this);
        this.queueUpdateSelectionCombineMode = this.queueUpdateSelectionCombineMode.bind(this);
        appEmitter.on('editor.tool.commitCurrentAction', this.queueApplyActiveSelection);
        appEmitter.on('editor.tool.selectAll', this.queueClearSelection);
        selectionEmitter.on('applyActiveSelection', this.queueApplyActiveSelection);
        selectionEmitter.on('clearSelection', this.queueClearSelection);
        selectionEmitter.on('updateSelectionCombineMode', this.queueUpdateSelectionCombineMode);
        this.selectedLayerUnwatch = watch([toRefs(workingFileStore.state).selectedLayerIds], async () => {
            await previewSelectedLayersSelectionMask();
            canvasStore.set('viewDirty', true);
        }, { immediate: true });

        // Tutorial message
        if (!editorStore.state.tutorialFlags.selectionToolIntroduction) {
            waitForNoOverlays().then(() => {
                let messageStart = `
                    <p class="mb-3">The selection tool allows you to select specific parts of the image to restrict what editing affects.</p>
                `;
                let messageEnd = `
                    <p class="mb-3"><strong class="has-text-weight-bold"><span class="bi bi-square"></span> Selection Shape</strong> - What shape is used to draw the selection.<p>
                    <p><strong class="has-text-weight-bold"><span class="bi bi-plus-circle-dotted"></span> Selection Combine Mode</strong> - How the current selection combines with the existing selection.<p>
                `;
                scheduleTutorialNotification({
                    flag: 'selectionToolIntroduction',
                    title: 'Selection Tool',
                    message: {
                        touch: messageStart + `
                            <p class="mb-3"><strong class="has-text-weight-bold"><span class="bi bi-bounding-box"></span> Create Selection</strong> - Draw with one finger to create a selection.</p>
                        ` + messageEnd,
                        mouse: messageStart + `
                            <p class="mb-3"><strong class="has-text-weight-bold"><span class="bi bi-bounding-box"></span> Create Selection</strong> - Click and drag with <em>Left Click</em> to create a selection.</p>
                        ` + messageEnd
                    }
                });
            });
        }
    }

    onLeave(): void {
        super.onLeave();
        appEmitter.off('editor.tool.commitCurrentAction', this.queueApplyActiveSelection);
        appEmitter.off('editor.tool.selectAll', this.queueClearSelection);
        selectionEmitter.off('applyActiveSelection', this.queueApplyActiveSelection);
        selectionEmitter.off('clearSelection', this.queueClearSelection);
        selectionEmitter.off('updateSelectionCombineMode', this.queueUpdateSelectionCombineMode);
        if (this.selectedLayerUnwatch) {
            this.selectedLayerUnwatch();
        }
        discardSelectedLayersSelectionMask();
        canvasStore.set('viewDirty', true);

        // Tutorial Message
        if (!editorStore.state.tutorialFlags.selectionToolIntroduction) {
            dismissTutorialNotification('selectionToolIntroduction');
        }
    }

    onPointerDown(e: PointerEvent): void {
        super.onPointerDown(e);

        const pointer = this.pointers.filter((pointer) => pointer.id === e.pointerId)[0];
        if (pointer && pointer.down.isPrimary && pointer.type !== 'touch' && pointer.down.button === 0) {
            const dragHandleIndex = this.getDragHandleIndexAtPagePoint(e.pageX, e.pageY);
            if (pointer && dragHandleIndex === -1 && this.canAddPoint()) {
                this.addPoint(pointer);
            }
        }
    }

    onMultiTouchDown() {
        super.onMultiTouchDown();
        if (this.touches.length === 1) {
            const dragHandleIndex = this.getDragHandleIndexAtPagePoint(this.touches[0].down.pageX, this.touches[0].down.pageY);
            if (dragHandleIndex === -1 && this.canAddPoint()) {
                this.addPoint(this.touches[0]);
            }
        }
    }

    // onMultiTouchUp() {
    //     super.onMultiTouchUp();
    //     // this.isListenToTouchMove = false;
    // }
    
    // onMultiTouchTap(touches: PointerTracker[]) {
    //     super.onMultiTouchTap(touches);
    //     if (touches.length === 1) {
            
    //     }
    // }

    onPointerMove(e: PointerEvent): void {
        super.onPointerMove(e);

        if (
            e.isPrimary
        ) {
            const pointer = this.pointers.filter((pointer) => pointer.id === e.pointerId)[0];
            if (pointer && (pointer.type !== 'touch' || this.multiTouchDownCount === 1) && pointer.down.button === 0 && pointer.isDragging) {

                // Create selection path or find drag handle
                if (!this.dragStartActiveSelectionPath && this.dragStartHandleIndex == -1) {
                    this.dragStartHandleIndex = this.getDragHandleIndexAtPagePoint(pointer.down.pageX, pointer.down.pageY);
                    this.dragStartActiveSelectionPathIsClosed = this.isActiveSelectionPathClosed();
                    if (this.dragStartHandleIndex === -1) {
                        this.dragStartActiveSelectionPath = [];
                        if (activeSelectionPath.value.length > 0) {
                            this.queueAsyncAction((activeSelectionPathOverride: Array<SelectionPathPoint>) => {
                                return this.applyActiveSelection(activeSelectionPathOverride, { doNotClearActiveSelection: true });
                            }, [[...activeSelectionPath.value]]);
                        }
                    } else {
                        this.dragStartActiveSelectionPath = JSON.parse(JSON.stringify(activeSelectionPath.value));
                    }
                }

                const transform = canvasStore.get('transform');
                const transformInverse = transform.inverse();
                const startCursorX = pointer.down.pageX;
                const startCursorY = pointer.down.pageY;
                const cursorX = e.pageX;
                const cursorY = e.pageY;

                // Drag handle of active path
                if (this.dragStartHandleIndex > -1 && activeSelectionPath.value.length - 1 >= this.dragStartHandleIndex && this.dragStartActiveSelectionPath) {
                    const editorShapeIntent = activeSelectionPath.value[0]?.editorShapeIntent;

                    // Resize rectangle
                    if (editorShapeIntent === 'rectangle') {
                        const dragHandle = activeSelectionPath.value[this.dragStartHandleIndex];
                        let staticHandleIndex = this.dragStartHandleIndex + 2;
                        if (staticHandleIndex > activeSelectionPath.value.length - 1) staticHandleIndex -= 4;
                        const staticHandle = activeSelectionPath.value[staticHandleIndex];
                        let leftHandleIndex = this.dragStartHandleIndex - 1;
                        if (leftHandleIndex < 1) leftHandleIndex += 4;
                        const leftHandle = activeSelectionPath.value[leftHandleIndex];
                        let rightHandleIndex = this.dragStartHandleIndex + 1;
                        if (rightHandleIndex > activeSelectionPath.value.length - 1) rightHandleIndex -= 4;
                        const rightHandle = activeSelectionPath.value[rightHandleIndex];
                        if (!this.dragStartRectangleOriginToLeftDirection) {
                            this.dragStartRectangleOriginToLeftDirection = normalizedDirectionVector2d(
                                staticHandle.x, staticHandle.y, leftHandle.x, leftHandle.y
                            );
                        }
                        if (!this.dragStartRectangleOriginToRightDirection) {
                            this.dragStartRectangleOriginToRightDirection = normalizedDirectionVector2d(
                                staticHandle.x, staticHandle.y, rightHandle.x, rightHandle.y
                            );
                        }
                        const newDragHandlePosition = new DOMPoint(cursorX * devicePixelRatio, cursorY * devicePixelRatio).matrixTransform(transformInverse);
                        newDragHandlePosition.x = Math.round(newDragHandlePosition.x);
                        newDragHandlePosition.y = Math.round(newDragHandlePosition.y);
                        const leftIntersection = lineIntersectsLine2d(
                            staticHandle.x, staticHandle.y, staticHandle.x + this.dragStartRectangleOriginToLeftDirection.x, staticHandle.y + this.dragStartRectangleOriginToLeftDirection.y,
                            newDragHandlePosition.x, newDragHandlePosition.y, newDragHandlePosition.x + this.dragStartRectangleOriginToRightDirection.x, newDragHandlePosition.y + this.dragStartRectangleOriginToRightDirection.y
                        );
                        const rightIntersection = lineIntersectsLine2d(
                            staticHandle.x, staticHandle.y, staticHandle.x + this.dragStartRectangleOriginToRightDirection.x, staticHandle.y + this.dragStartRectangleOriginToRightDirection.y,
                            newDragHandlePosition.x, newDragHandlePosition.y, newDragHandlePosition.x + this.dragStartRectangleOriginToLeftDirection.x, newDragHandlePosition.y + this.dragStartRectangleOriginToLeftDirection.y
                        );
                        if (leftIntersection != null && rightIntersection != null) {
                            dragHandle.x = newDragHandlePosition.x;
                            dragHandle.y = newDragHandlePosition.y;
                            leftHandle.x = Math.round(leftIntersection.x);
                            leftHandle.y = Math.round(leftIntersection.y);
                            rightHandle.x = Math.round(rightIntersection.x);
                            rightHandle.y = Math.round(rightIntersection.y);
                            activeSelectionPath.value[0].x = activeSelectionPath.value[4].x;
                            activeSelectionPath.value[0].y = activeSelectionPath.value[4].y;
                            activeSelectionPath.value = [...activeSelectionPath.value];
                        }
                    }

                    // Resize ellipse
                    else if (editorShapeIntent === 'ellipse') {
                        const dragHandle = activeSelectionPath.value[this.dragStartHandleIndex] as SelectionPathPointBezierCurve;
                        let staticHandleIndex = this.dragStartHandleIndex + 2;
                        if (staticHandleIndex > activeSelectionPath.value.length - 1) staticHandleIndex -= 4;
                        const staticHandle = activeSelectionPath.value[staticHandleIndex] as SelectionPathPointBezierCurve;
                        let leftHandleIndex = this.dragStartHandleIndex - 1;
                        if (leftHandleIndex < 1) leftHandleIndex += 4;
                        const leftHandle = activeSelectionPath.value[leftHandleIndex] as SelectionPathPointBezierCurve;
                        let rightHandleIndex = this.dragStartHandleIndex + 1;
                        if (rightHandleIndex > activeSelectionPath.value.length - 1) rightHandleIndex -= 4;
                        const rightHandle = activeSelectionPath.value[rightHandleIndex] as SelectionPathPointBezierCurve;
                        if (this.dragStartEllipsePerpendicularRadius == null) {
                            const oldMiddlePoint = { x: (dragHandle.x + staticHandle.x) / 2, y: (dragHandle.y + staticHandle.y) / 2 };
                            this.dragStartEllipsePerpendicularRadius = pointDistance2d(oldMiddlePoint.x, oldMiddlePoint.y, leftHandle.x, leftHandle.y);
                        }
                        const newDragHandlePosition = new DOMPoint(cursorX * devicePixelRatio, cursorY * devicePixelRatio).matrixTransform(transformInverse);
                        const middlePoint = { x: (newDragHandlePosition.x + staticHandle.x) / 2, y: (newDragHandlePosition.y + staticHandle.y) / 2 };
                        const parallelRadius = pointDistance2d(middlePoint.x, middlePoint.y, staticHandle.x, staticHandle.y);
                        const staticToDragBearing = normalizedDirectionVector2d(staticHandle.x, staticHandle.y, newDragHandlePosition.x, newDragHandlePosition.y);
                        const middleToRightBearing = rotateDirectionVector2d(staticToDragBearing.x, staticToDragBearing.y, Math.PI / 2);
                        const middleToLeftBearing = rotateDirectionVector2d(staticToDragBearing.x, staticToDragBearing.y, -Math.PI / 2);
                        dragHandle.x = newDragHandlePosition.x;
                        dragHandle.y = newDragHandlePosition.y;
                        leftHandle.x = middlePoint.x + (middleToLeftBearing.x * this.dragStartEllipsePerpendicularRadius);
                        leftHandle.y = middlePoint.y + (middleToLeftBearing.y * this.dragStartEllipsePerpendicularRadius);
                        rightHandle.x = middlePoint.x + (middleToRightBearing.x * this.dragStartEllipsePerpendicularRadius);
                        rightHandle.y = middlePoint.y + (middleToRightBearing.y * this.dragStartEllipsePerpendicularRadius);
                        activeSelectionPath.value[0].x = activeSelectionPath.value[4].x;
                        activeSelectionPath.value[0].y = activeSelectionPath.value[4].y;
                        const circularHandleOffset = 0.552284749831;
                        // Handles around static point
                        staticHandle.ehx = staticHandle.x + (middleToRightBearing.x * this.dragStartEllipsePerpendicularRadius * circularHandleOffset);
                        staticHandle.ehy = staticHandle.y + (middleToRightBearing.y * this.dragStartEllipsePerpendicularRadius * circularHandleOffset);
                        leftHandle.shx = staticHandle.x + (middleToLeftBearing.x * this.dragStartEllipsePerpendicularRadius * circularHandleOffset);
                        leftHandle.shy = staticHandle.y + (middleToLeftBearing.y * this.dragStartEllipsePerpendicularRadius * circularHandleOffset);
                        // Handles around drag point
                        dragHandle.ehx = dragHandle.x + (middleToLeftBearing.x * this.dragStartEllipsePerpendicularRadius * circularHandleOffset);
                        dragHandle.ehy = dragHandle.y + (middleToLeftBearing.y * this.dragStartEllipsePerpendicularRadius * circularHandleOffset);
                        rightHandle.shx = dragHandle.x + (middleToRightBearing.x * this.dragStartEllipsePerpendicularRadius * circularHandleOffset);
                        rightHandle.shy = dragHandle.y + (middleToRightBearing.y * this.dragStartEllipsePerpendicularRadius * circularHandleOffset);
                        // Handles around left point
                        leftHandle.ehx = leftHandle.x + (-staticToDragBearing.x * parallelRadius * circularHandleOffset);
                        leftHandle.ehy = leftHandle.y + (-staticToDragBearing.y * parallelRadius * circularHandleOffset);
                        dragHandle.shx = leftHandle.x + (staticToDragBearing.x * parallelRadius * circularHandleOffset);
                        dragHandle.shy = leftHandle.y + (staticToDragBearing.y * parallelRadius * circularHandleOffset);
                        // Handles around right point
                        rightHandle.ehx = rightHandle.x + (staticToDragBearing.x * parallelRadius * circularHandleOffset);
                        rightHandle.ehy = rightHandle.y + (staticToDragBearing.y * parallelRadius * circularHandleOffset);
                        staticHandle.shx = rightHandle.x + (-staticToDragBearing.x * parallelRadius * circularHandleOffset);
                        staticHandle.shy = rightHandle.y + (-staticToDragBearing.y * parallelRadius * circularHandleOffset);
                        activeSelectionPath.value = [...activeSelectionPath.value];
                    }
                    
                    // Modify free select handle placement
                    else {
                        const newDragHandlePosition = new DOMPoint(cursorX * devicePixelRatio, cursorY * devicePixelRatio).matrixTransform(transformInverse);
                        const dragHandle = activeSelectionPath.value[this.dragStartHandleIndex];
                        dragHandle.x = newDragHandlePosition.x;
                        dragHandle.y = newDragHandlePosition.y;
                        if (this.dragStartHandleIndex === 0 && this.dragStartActiveSelectionPathIsClosed) {
                            activeSelectionPath.value[activeSelectionPath.value.length - 1].x = newDragHandlePosition.x;
                            activeSelectionPath.value[activeSelectionPath.value.length - 1].y = newDragHandlePosition.y;
                        } else if (this.dragStartHandleIndex === activeSelectionPath.value.length - 1 && this.dragStartActiveSelectionPathIsClosed) {
                            activeSelectionPath.value[0].x = newDragHandlePosition.x;
                            activeSelectionPath.value[0].y = newDragHandlePosition.y;
                        }
                        activeSelectionPath.value = [...activeSelectionPath.value];
                    }
                }
                else { // Create a shape
                    isDrawingSelection.value = true;
                    
                    const decomposedTransform = canvasStore.get('decomposedTransform');

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

                        // Create a rectangle
                        if (selectionAddShape.value === 'rectangle') {
                            activeSelectionPath.value = [
                                {
                                    type: 'move',
                                    editorShapeIntent: 'rectangle',
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
                        }
                        
                        // Create an ellipse
                        else {
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
                            activeSelectionPath.value = [
                                {
                                    type: 'move',
                                    editorShapeIntent: 'ellipse',
                                    x: topX,
                                    y: topY
                                },
                                {
                                    type: 'bezierCurve',
                                    x: rightX,
                                    y: rightY,
                                    shx: topRightHandleX,
                                    shy: topRightHandleY,
                                    ehx: rightTopHandleX,
                                    ehy: rightTopHandleY
                                },
                                {
                                    type: 'bezierCurve',
                                    x: bottomX,
                                    y: bottomY,
                                    shx: rightBottomHandleX,
                                    shy: rightBottomHandleY,
                                    ehx: bottomRightHandleX,
                                    ehy: bottomRightHandleY
                                },
                                {
                                    type: 'bezierCurve',
                                    x: leftX,
                                    y: leftY,
                                    shx: bottomLeftHandleX,
                                    shy: bottomLeftHandleY,
                                    ehx: leftBottomHandleX,
                                    ehy: leftBottomHandleY
                                },
                                {
                                    type: 'bezierCurve',
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
            } else {
                // Track hover state over drag handles
                this.hoveringActiveSelectionPathIndex = -1;
                if (activeSelectionPath.value.length > 0) {
                    this.hoveringActiveSelectionPathIndex = this.getDragHandleIndexAtPagePoint(e.pageX, e.pageY);
                }
            }

            this.handleCursorIcon();
        }
    }

    async onPointerUpBeforePurge(e: PointerEvent): Promise<void> {
        super.onPointerUpBeforePurge(e);

        const pointer = this.pointers.filter((pointer) => pointer.id === e.pointerId)[0];
        if (pointer && pointer.down.isPrimary && pointer.down.button === 0) {
            if (pointer.isDragging) {
                isDrawingSelection.value = false;
                if (this.dragStartHandleIndex > -1 || this.dragStartActiveSelectionPath) {
                    // Update active selection path in history
                    if (activeSelectionPath.value[0]?.editorShapeIntent === 'free') {
                        let isFinished = false;
                        if (activeSelectionPath.value.length > 2) {
                            if (this.dragStartHandleIndex === activeSelectionPath.value.length - 1) {
                                const dragHandleIndex = this.getDragHandleIndexAtPagePoint(pointer.up?.pageX ?? pointer.down.pageX, pointer.up?.pageY ?? pointer.down.pageX, activeSelectionPath.value.length - 1);
                                if (dragHandleIndex === 0) {
                                    activeSelectionPath.value[activeSelectionPath.value.length - 1].x = activeSelectionPath.value[0].x;
                                    activeSelectionPath.value[activeSelectionPath.value.length - 1].y = activeSelectionPath.value[0].y;
                                    activeSelectionPath.value = [...activeSelectionPath.value];
                                    isFinished = true;
                                }
                            } else if (this.dragStartHandleIndex === 0) {
                                const dragHandleIndex = this.getDragHandleIndexAtPagePoint(pointer.up?.pageX ?? pointer.down.pageX, pointer.up?.pageY ?? pointer.down.pageX, 0);
                                if (dragHandleIndex === activeSelectionPath.value.length - 1) {
                                    activeSelectionPath.value[0].x = activeSelectionPath.value[activeSelectionPath.value.length - 1].x;
                                    activeSelectionPath.value[0].y = activeSelectionPath.value[activeSelectionPath.value.length - 1].y;
                                    activeSelectionPath.value = [...activeSelectionPath.value];
                                    isFinished = true;
                                }
                            }
                            if (
                                !isFinished &&
                                this.isActiveSelectionPathClosed()
                            ) {
                                isFinished = true;
                            }
                        }
                        if (isFinished) {
                            this.queueAsyncAction((newPath: Array<SelectionPathPoint>, oldPath?: Array<SelectionPathPoint>) => {
                                return this.updateActiveSelectionContinuousFinish(newPath, oldPath);
                            }, [activeSelectionPath.value, this.dragStartActiveSelectionPath]);
                            this.freePathStartActiveSelectionPath = undefined;
                        } else {
                            this.queueAsyncAction((newPath: Array<SelectionPathPoint>, oldPath?: Array<SelectionPathPoint>) => {
                                return this.updateActiveSelectionContinuous(newPath, oldPath);
                            }, [activeSelectionPath.value, this.freePathStartActiveSelectionPath ?? []]);
                        }
                    } else {
                        this.queueAsyncAction((newPath: Array<SelectionPathPoint>, oldPath?: Array<SelectionPathPoint>) => {
                            return this.updateActiveSelection(newPath, oldPath);
                        }, [activeSelectionPath.value, this.dragStartActiveSelectionPath]);
                    }
                }
                this.dragStartActiveSelectionPath = undefined;
                this.dragStartHandleIndex = -1;
                this.dragStartRectangleOriginToLeftDirection = null;
                this.dragStartRectangleOriginToRightDirection = null;
                this.dragStartEllipsePerpendicularRadius = null;
            } else {
                // Close free select path 
                const dragHandleIndex = this.getDragHandleIndexAtPagePoint(pointer.down.pageX, pointer.down.pageY);
                if (activeSelectionPath.value.length > 2 && activeSelectionPath.value[0]?.editorShapeIntent === 'free' && dragHandleIndex === 0) {
                    activeSelectionPath.value.push({
                        type: 'line',
                        x: activeSelectionPath.value[0].x,
                        y: activeSelectionPath.value[0].y,
                    })
                    this.queueAsyncAction((newPath: Array<SelectionPathPoint>, oldPath?: Array<SelectionPathPoint>) => {
                        return this.updateActiveSelectionContinuousFinish(newPath, oldPath);
                    }, [activeSelectionPath.value, this.freePathStartActiveSelectionPath ?? []]);
                    this.freePathStartActiveSelectionPath = undefined;
                }
            }

            this.handleCursorIcon();
        }
    }

    private getDragHandleIndexAtPagePoint(x: number, y: number, excludeIndex?: number) {
        const isTouch = this.pointers.filter((pointer) => pointer.down.isPrimary)[0]?.type === 'touch';

        let pointIndex = -1;
        const transform = canvasStore.get('transform');
        const decomposedTransform = canvasStore.get('decomposedTransform');
        const transformInverse = transform.inverse();
        const cursor = new DOMPoint(x * devicePixelRatio, y * devicePixelRatio).matrixTransform(transformInverse);

        const dragHandleRadius = isTouch ? this.dragHandleRadiusTouch : this.dragHandleRadius ;

        for (const [pathPointIndex, pathPoint] of activeSelectionPath.value.entries()) {
            if (
                (pathPoint.type === 'move' && pathPoint.editorShapeIntent === 'free') ||
                pathPoint.type === 'line' ||
                pathPoint.type === 'bezierCurve'
            ) {
                if (
                    Math.abs(cursor.x - pathPoint.x) < dragHandleRadius * devicePixelRatio / decomposedTransform.scaleX &&
                    Math.abs(cursor.y - pathPoint.y) < dragHandleRadius * devicePixelRatio / decomposedTransform.scaleY
                ) {
                    if (pathPointIndex === excludeIndex) {
                        continue;
                    } else {
                        pointIndex = pathPointIndex;
                        break;
                    }
                }
            }
        }
        return pointIndex;
    }

    private addPoint(pointer: PointerTracker) {
        if (
            // Active path is a different shape
            (activeSelectionPath.value.length > 0 && activeSelectionPath.value[0]?.editorShapeIntent !== 'free') ||
            // Active path is an already closed path
            this.isActiveSelectionPathClosed()
        ) {
            this.queueAsyncAction((activeSelectionPathOverride: Array<SelectionPathPoint>) => {
                return this.applyActiveSelection(activeSelectionPathOverride, { doNotClearActiveSelection: true });
            }, [JSON.parse(JSON.stringify(activeSelectionPath.value))]);
            this.freePathStartActiveSelectionPath = [];
            activeSelectionPath.value = [];
        }

        const transformInverse = canvasStore.get('transform').inverse();
        const cursor = new DOMPoint(pointer.down.pageX * devicePixelRatio, pointer.down.pageY * devicePixelRatio).matrixTransform(transformInverse);

        if (activeSelectionPath.value.length < 1) {
            activeSelectionPath.value = [
                {
                    type: 'move',
                    editorShapeIntent: 'free',
                    x: cursor.x,
                    y: cursor.y,
                }
            ];
        } else {
            activeSelectionPath.value.push({
                type: 'line',
                x: cursor.x,
                y: cursor.y,
            });
        }

        this.queueAsyncAction((newPath: Array<SelectionPathPoint>, oldPath?: Array<SelectionPathPoint>) => {
            return this.updateActiveSelectionContinuous(newPath, oldPath);
        }, [activeSelectionPath.value, this.freePathStartActiveSelectionPath ?? []]);
    }

    private isActiveSelectionPathClosed() {
        if (activeSelectionPath.value[0]?.editorShapeIntent === 'free') {
            return (
                activeSelectionPath.value.length > 2 &&
                activeSelectionPath.value[activeSelectionPath.value.length - 1].x === activeSelectionPath.value[0].x &&
                activeSelectionPath.value[activeSelectionPath.value.length - 1].y === activeSelectionPath.value[0].y
            );
        }
        return true;
    }

    private canAddPoint() {
        return selectionAddShape.value === 'free';
    }

    async applyActiveSelection(activeSelectionPathOverride: Array<SelectionPathPoint> = activeSelectionPath.value, options?: any) {
        await historyStore.dispatch('runAction', {
            action: new ApplyActiveSelectionAction(activeSelectionPathOverride, options)
        });
    }

    async queueApplyActiveSelection() {
        this.queueAsyncAction((activeSelectionPathOverride: Array<SelectionPathPoint>) => {
            return this.applyActiveSelection(activeSelectionPathOverride);
        }, [[...activeSelectionPath.value]]);
    }

    async updateActiveSelection(newPath: Array<SelectionPathPoint>, oldPath?: Array<SelectionPathPoint>) {
        await historyStore.dispatch('runAction', {
            action: new UpdateActiveSelectionAction(newPath, oldPath)
        });
    }

    async updateActiveSelectionContinuous(newPath: Array<SelectionPathPoint>, oldPath?: Array<SelectionPathPoint>) {
        await historyStore.dispatch('runAction', {
            action: new BundleAction('createFreeSelectPath', 'action.updateActiveSelection', [
                new UpdateActiveSelectionAction(newPath, oldPath, { updatePreview: false })
            ]),
            replaceHistory: 'createFreeSelectPath',
        });
    }

    async updateActiveSelectionContinuousFinish(newPath: Array<SelectionPathPoint>, oldPath?: Array<SelectionPathPoint>) {
        await historyStore.dispatch('runAction', {
            action: new BundleAction('finishFreeSelectPath', 'action.updateActiveSelection', [
                new UpdateActiveSelectionAction(newPath, oldPath, { updatePreview: true })
            ]),
            replaceHistory: 'createFreeSelectPath',
        });
    }

    async clearSelection() {
        await historyStore.dispatch('runAction', {
            action: new ClearSelectionAction()
        });
    }

    async queueClearSelection() {
        this.queueAsyncAction(() => {
            return this.clearSelection();
        });
    }

    async queueUpdateSelectionCombineMode(event: any) {
        this.queueAsyncAction(async () => {
            await historyStore.dispatch('runAction', {
                action: new UpdateSelectionCombineModeAction(event, selectionCombineMode.value),
                mergeWithHistory: ['applyActiveSelection']
            });
        });
    }

    protected handleCursorIcon() {
        let newIcon = super.handleCursorIcon();
        if (!newIcon) {
            if (this.hoveringActiveSelectionPathIndex > -1) {
                if (
                    this.hoveringActiveSelectionPathIndex === 0 &&
                    activeSelectionPath.value.length > 2 &&
                    activeSelectionPath.value[0]?.editorShapeIntent === 'free' &&
                    !this.isActiveSelectionPathClosed()
                ) {
                    newIcon = 'pointer';
                } else {
                    newIcon = 'grabbing';
                }
            } else {
                newIcon = 'crosshair';
            }
        }
        canvasStore.set('cursor', newIcon);
        return newIcon;
    }
}
