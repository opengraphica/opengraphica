import BaseMovementController from './base-movement';
import { ref, watch, toRefs, WatchStopHandle } from 'vue';
import {
    isDrawingSelection, selectionAddShape, activeSelectionPath, selectionCombineMode, selectionEmitter,
    activeSelectionMask, appliedSelectionMask, previewSelectedLayersSelectionMask, discardSelectedLayersSelectionMask,
} from '../store/selection-state';
import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import historyStore from '@/store/history';
import workingFileStore, { getSelectedLayers } from '@/store/working-file';
import appEmitter from '@/lib/emitter';
import { normalizedDirectionVector2d, rotateDirectionVector2d, pointDistance2d, lineIntersectsLine2d } from '@/lib/math';
import { dismissTutorialNotification, scheduleTutorialNotification, waitForNoOverlays } from '@/lib/tutorial';
import { ApplyActiveSelectionAction } from '@/actions/apply-active-selection';
import { BundleAction } from '@/actions/bundle';
import { ClearSelectionAction } from '@/actions/clear-selection';
import { DeleteLayerSelectionAreaAction } from '@/actions/delete-layer-selection-area';
import { UpdateActiveSelectionAction } from '@/actions/update-active-selection';
import { UpdateSelectionCombineModeAction } from '@/actions/update-selection-combine-mode';
import { t, tm, rt } from '@/i18n';

import type { PointerTracker } from './base';
import { VectorPathCommandType, type AnyVectorPathCommand, type VectorPathCommand, type VectorPathCommandCubicBezierCurve } from '@/types';

export default class SelectionController extends BaseMovementController {
    private asyncActionStack: Array<{ callback: (...args: any[]) => Promise<any>, args?: any[] }> = [];
    private currentAsyncAction: ({ callback: (...args: any[]) => Promise<any>, args?: any[] }) | undefined = undefined;
    private dragStartActiveSelectionPath: Array<VectorPathCommand> | undefined = undefined;
    private dragStartActiveSelectionPathIsClosed: boolean = false;
    private dragStartHandleIndex: number = -1;
    private dragStartRectangleOriginToLeftDirection: { x: number, y: number } | null = null; 
    private dragStartRectangleOriginToRightDirection: { x: number, y: number } | null = null;
    private dragStartEllipsePerpendicularRadius: number | null = null;
    private freePathStartActiveSelectionPath: Array<VectorPathCommand> | undefined = undefined;
    private selectedLayerUnwatch: WatchStopHandle | null = null;

    private hoveringActiveSelectionPathIndex: number = -1;
    private dragHandleRadius: number = 6;
    private dragHandleRadiusTouch: number = 10;

    private deleteSelectionHandler: (() => Promise<void>) | null = null;

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
        this.deleteSelectionHandler = this.queueDeleteSelection.bind(this);

        appEmitter.on('editor.tool.commitCurrentAction', this.queueApplyActiveSelection);
        appEmitter.on('editor.tool.delete', this.deleteSelectionHandler);
        appEmitter.on('editor.tool.selectAll', this.queueClearSelection);

        selectionEmitter.on('applyActiveSelection', this.queueApplyActiveSelection);
        selectionEmitter.on('clearSelection', this.queueClearSelection);
        selectionEmitter.on('updateSelectionCombineMode', this.queueUpdateSelectionCombineMode);

        this.selectedLayerUnwatch = watch([toRefs(workingFileStore.state).selectedLayerIds], async () => {
            // await previewSelectedLayersSelectionMask();
            canvasStore.set('viewDirty', true);
        }, { immediate: true });

        // Tutorial message
        if (!editorStore.state.tutorialFlags.selectionToolIntroduction) {
            waitForNoOverlays().then(() => {
                let messageStart = (tm('tutorialTip.selectionToolIntroduction.introduction') as string[]).map((message) => {
                    return `<p class="mb-3!">${rt(message)}</p>`;
                }).join('');
                let messageEnd = (tm('tutorialTip.selectionToolIntroduction.body.end') as string[]).map((message) => {
                    return `<p class="mb-3!">${rt(message, {
                        selectionShape: `<strong class="font-bold"><span class="bi bi-square"></span> ${t('tutorialTip.selectionToolIntroduction.bodyTitle.selectionShape')}</strong>`,
                        selectionCombineMode: `<strong class="font-bold"><span class="bi bi-plus-circle-dotted"></span> ${t('tutorialTip.selectionToolIntroduction.bodyTitle.selectionCombineMode')}</strong>`
                    })}</p>`;
                }).join('');
                scheduleTutorialNotification({
                    flag: 'selectionToolIntroduction',
                    title: t('tutorialTip.selectionToolIntroduction.title'),
                    message: {
                        touch: messageStart + (tm('tutorialTip.selectionToolIntroduction.body.touch') as string[]).map((message) => {
                            return `<p class="mb-3!">${rt(message, {
                                createSelection: `<strong class="font-bold"><span class="bi bi-bounding-box"></span> ${t('tutorialTip.selectionToolIntroduction.bodyTitle.createSelection')}</strong>`,
                            })}</p>`
                        }).join('') + messageEnd,
                        mouse: messageStart + (tm('tutorialTip.selectionToolIntroduction.body.mouse') as string[]).map((message) => {
                            return `<p class="mb-3!">${rt(message, {
                                createSelection: `<strong class="font-bold"><span class="bi bi-bounding-box"></span> ${t('tutorialTip.selectionToolIntroduction.bodyTitle.createSelection')}</strong>`,
                                leftClick: `<em>${t('tutorialTip.selectionToolIntroduction.bodyTitle.leftClick')}</em>`,
                            })}</p>`
                        }).join('') + messageEnd,
                    }
                });
            });
        }
    }

    onLeave(): void {
        super.onLeave();
        appEmitter.off('editor.tool.commitCurrentAction', this.queueApplyActiveSelection);
        if (this.deleteSelectionHandler) {
            appEmitter.off('editor.tool.delete', this.deleteSelectionHandler);
        }
        appEmitter.off('editor.tool.selectAll', this.queueClearSelection);
        
        selectionEmitter.off('applyActiveSelection', this.queueApplyActiveSelection);
        selectionEmitter.off('clearSelection', this.queueClearSelection);
        selectionEmitter.off('updateSelectionCombineMode', this.queueUpdateSelectionCombineMode);

        this.selectedLayerUnwatch?.()
        this.selectedLayerUnwatch = null;

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
            if (dragHandleIndex === -1 && this.canAddPoint()) {
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

                const editorSelectionShapeIntent = activeSelectionPath.value[0]?.editorSelectionShapeIntent;

                // Create selection path or find drag handle
                if (!this.dragStartActiveSelectionPath && this.dragStartHandleIndex == -1) {
                    if (editorSelectionShapeIntent !== 'lasso') {
                        this.dragStartHandleIndex = this.getDragHandleIndexAtPagePoint(pointer.down.pageX, pointer.down.pageY);
                    }
                    this.dragStartActiveSelectionPathIsClosed = this.isActiveSelectionPathClosed();
                    if (this.dragStartHandleIndex === -1) {
                        this.dragStartActiveSelectionPath = [];
                        if (activeSelectionPath.value.length > 0) {
                            this.queueAsyncAction((activeSelectionPathOverride: Array<VectorPathCommand>) => {
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
                if (
                    this.dragStartHandleIndex > -1
                    && activeSelectionPath.value.length - 1 >= this.dragStartHandleIndex
                    && this.dragStartActiveSelectionPath
                ) {

                    // Resize rectangle
                    if (editorSelectionShapeIntent === 'rectangle') {
                        const dragHandle: AnyVectorPathCommand = activeSelectionPath.value[this.dragStartHandleIndex];
                        let staticHandleIndex = this.dragStartHandleIndex + 2;
                        if (staticHandleIndex > activeSelectionPath.value.length - 1) staticHandleIndex -= 4;
                        const staticHandle: AnyVectorPathCommand = activeSelectionPath.value[staticHandleIndex];
                        let leftHandleIndex = this.dragStartHandleIndex - 1;
                        if (leftHandleIndex < 1) leftHandleIndex += 4;
                        const leftHandle: AnyVectorPathCommand = activeSelectionPath.value[leftHandleIndex];
                        let rightHandleIndex = this.dragStartHandleIndex + 1;
                        if (rightHandleIndex > activeSelectionPath.value.length - 1) rightHandleIndex -= 4;
                        const rightHandle: AnyVectorPathCommand = activeSelectionPath.value[rightHandleIndex];
                        if (!this.dragStartRectangleOriginToLeftDirection) {
                            this.dragStartRectangleOriginToLeftDirection = normalizedDirectionVector2d(
                                staticHandle.x!, staticHandle.y!, leftHandle.x!, leftHandle.y!
                            );
                        }
                        if (!this.dragStartRectangleOriginToRightDirection) {
                            this.dragStartRectangleOriginToRightDirection = normalizedDirectionVector2d(
                                staticHandle.x!, staticHandle.y!, rightHandle.x!, rightHandle.y!
                            );
                        }
                        const newDragHandlePosition = new DOMPoint(cursorX * devicePixelRatio, cursorY * devicePixelRatio).matrixTransform(transformInverse);
                        newDragHandlePosition.x = Math.round(newDragHandlePosition.x);
                        newDragHandlePosition.y = Math.round(newDragHandlePosition.y);
                        const leftIntersection = lineIntersectsLine2d(
                            staticHandle.x!, staticHandle.y!, staticHandle.x! + this.dragStartRectangleOriginToLeftDirection.x, staticHandle.y! + this.dragStartRectangleOriginToLeftDirection.y,
                            newDragHandlePosition.x, newDragHandlePosition.y, newDragHandlePosition.x + this.dragStartRectangleOriginToRightDirection.x, newDragHandlePosition.y + this.dragStartRectangleOriginToRightDirection.y
                        );
                        const rightIntersection = lineIntersectsLine2d(
                            staticHandle.x!, staticHandle.y!, staticHandle.x! + this.dragStartRectangleOriginToRightDirection.x, staticHandle.y! + this.dragStartRectangleOriginToRightDirection.y,
                            newDragHandlePosition.x, newDragHandlePosition.y, newDragHandlePosition.x + this.dragStartRectangleOriginToLeftDirection.x, newDragHandlePosition.y + this.dragStartRectangleOriginToLeftDirection.y
                        );
                        if (leftIntersection != null && rightIntersection != null) {
                            dragHandle.x = newDragHandlePosition.x;
                            dragHandle.y = newDragHandlePosition.y;
                            leftHandle.x = Math.round(leftIntersection.x);
                            leftHandle.y = Math.round(leftIntersection.y);
                            rightHandle.x = Math.round(rightIntersection.x);
                            rightHandle.y = Math.round(rightIntersection.y);
                            (activeSelectionPath.value[0] as AnyVectorPathCommand).x = (activeSelectionPath.value[4] as AnyVectorPathCommand).x!;
                            (activeSelectionPath.value[0] as AnyVectorPathCommand).y = (activeSelectionPath.value[4] as AnyVectorPathCommand).y!;
                            activeSelectionPath.value = [...activeSelectionPath.value];
                        }
                    }

                    // Resize ellipse
                    else if (editorSelectionShapeIntent === 'ellipse') {
                        const dragHandle = activeSelectionPath.value[this.dragStartHandleIndex] as VectorPathCommandCubicBezierCurve;
                        let staticHandleIndex = this.dragStartHandleIndex + 2;
                        if (staticHandleIndex > activeSelectionPath.value.length - 1) staticHandleIndex -= 4;
                        const staticHandle = activeSelectionPath.value[staticHandleIndex] as VectorPathCommandCubicBezierCurve;
                        let leftHandleIndex = this.dragStartHandleIndex - 1;
                        if (leftHandleIndex < 1) leftHandleIndex += 4;
                        const leftHandle = activeSelectionPath.value[leftHandleIndex] as VectorPathCommandCubicBezierCurve;
                        let rightHandleIndex = this.dragStartHandleIndex + 1;
                        if (rightHandleIndex > activeSelectionPath.value.length - 1) rightHandleIndex -= 4;
                        const rightHandle = activeSelectionPath.value[rightHandleIndex] as VectorPathCommandCubicBezierCurve;
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
                        (activeSelectionPath.value[0] as VectorPathCommandCubicBezierCurve).x = (activeSelectionPath.value[4] as VectorPathCommandCubicBezierCurve).x;
                        (activeSelectionPath.value[0] as VectorPathCommandCubicBezierCurve).y = (activeSelectionPath.value[4] as VectorPathCommandCubicBezierCurve).y;
                        const circularHandleOffset = 0.552284749831;
                        // Handles around static point
                        staticHandle.x2 = staticHandle.x + (middleToRightBearing.x * this.dragStartEllipsePerpendicularRadius * circularHandleOffset);
                        staticHandle.y2 = staticHandle.y + (middleToRightBearing.y * this.dragStartEllipsePerpendicularRadius * circularHandleOffset);
                        leftHandle.x1 = staticHandle.x + (middleToLeftBearing.x * this.dragStartEllipsePerpendicularRadius * circularHandleOffset);
                        leftHandle.y1 = staticHandle.y + (middleToLeftBearing.y * this.dragStartEllipsePerpendicularRadius * circularHandleOffset);
                        // Handles around drag point
                        dragHandle.x2 = dragHandle.x + (middleToLeftBearing.x * this.dragStartEllipsePerpendicularRadius * circularHandleOffset);
                        dragHandle.y2 = dragHandle.y + (middleToLeftBearing.y * this.dragStartEllipsePerpendicularRadius * circularHandleOffset);
                        rightHandle.x1 = dragHandle.x + (middleToRightBearing.x * this.dragStartEllipsePerpendicularRadius * circularHandleOffset);
                        rightHandle.y1 = dragHandle.y + (middleToRightBearing.y * this.dragStartEllipsePerpendicularRadius * circularHandleOffset);
                        // Handles around left point
                        leftHandle.x2 = leftHandle.x + (-staticToDragBearing.x * parallelRadius * circularHandleOffset);
                        leftHandle.y2 = leftHandle.y + (-staticToDragBearing.y * parallelRadius * circularHandleOffset);
                        dragHandle.x1 = leftHandle.x + (staticToDragBearing.x * parallelRadius * circularHandleOffset);
                        dragHandle.y1 = leftHandle.y + (staticToDragBearing.y * parallelRadius * circularHandleOffset);
                        // Handles around right point
                        rightHandle.x2 = rightHandle.x + (staticToDragBearing.x * parallelRadius * circularHandleOffset);
                        rightHandle.y2 = rightHandle.y + (staticToDragBearing.y * parallelRadius * circularHandleOffset);
                        staticHandle.x1 = rightHandle.x + (-staticToDragBearing.x * parallelRadius * circularHandleOffset);
                        staticHandle.y1 = rightHandle.y + (-staticToDragBearing.y * parallelRadius * circularHandleOffset);
                        activeSelectionPath.value = [...activeSelectionPath.value];
                    }

                    // Modify free select handle placement
                    else if (editorSelectionShapeIntent === 'freePolygon') {
                        const newDragHandlePosition = new DOMPoint(cursorX * devicePixelRatio, cursorY * devicePixelRatio).matrixTransform(transformInverse);
                        const dragHandle: AnyVectorPathCommand = activeSelectionPath.value[this.dragStartHandleIndex];
                        dragHandle.x = newDragHandlePosition.x;
                        dragHandle.y = newDragHandlePosition.y;
                        if (this.dragStartHandleIndex === 0 && this.dragStartActiveSelectionPathIsClosed) {
                            (activeSelectionPath.value[activeSelectionPath.value.length - 1] as AnyVectorPathCommand).x = newDragHandlePosition.x;
                            (activeSelectionPath.value[activeSelectionPath.value.length - 1] as AnyVectorPathCommand).y = newDragHandlePosition.y;
                        } else if (this.dragStartHandleIndex === activeSelectionPath.value.length - 1 && this.dragStartActiveSelectionPathIsClosed) {
                            (activeSelectionPath.value[0] as AnyVectorPathCommand).x = newDragHandlePosition.x;
                            (activeSelectionPath.value[0] as AnyVectorPathCommand).y = newDragHandlePosition.y;
                        }
                        activeSelectionPath.value = [...activeSelectionPath.value];
                    }
                }
                else { // Create a shape
                    
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
                                    type: VectorPathCommandType.MOVE,
                                    editorSelectionShapeIntent: 'rectangle',
                                    x: topLeft.x,
                                    y: topLeft.y
                                },
                                {
                                    type: VectorPathCommandType.LINE,
                                    x: topRight.x,
                                    y: topRight.y
                                },
                                {
                                    type: VectorPathCommandType.LINE,
                                    x: bottomRight.x,
                                    y: bottomRight.y
                                },
                                {
                                    type: VectorPathCommandType.LINE,
                                    x: bottomLeft.x,
                                    y: bottomLeft.y
                                },
                                {
                                    type: VectorPathCommandType.LINE,
                                    x: topLeft.x,
                                    y: topLeft.y
                                },
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
                                    type: VectorPathCommandType.MOVE,
                                    editorSelectionShapeIntent: 'ellipse',
                                    x: topX,
                                    y: topY
                                },
                                {
                                    type: VectorPathCommandType.CUBIC_BEZIER_CURVE,
                                    x: rightX,
                                    y: rightY,
                                    x1: topRightHandleX,
                                    y1: topRightHandleY,
                                    x2: rightTopHandleX,
                                    y2: rightTopHandleY
                                },
                                {
                                    type: VectorPathCommandType.CUBIC_BEZIER_CURVE,
                                    x: bottomX,
                                    y: bottomY,
                                    x1: rightBottomHandleX,
                                    y1: rightBottomHandleY,
                                    x2: bottomRightHandleX,
                                    y2: bottomRightHandleY
                                },
                                {
                                    type: VectorPathCommandType.CUBIC_BEZIER_CURVE,
                                    x: leftX,
                                    y: leftY,
                                    x1: bottomLeftHandleX,
                                    y1: bottomLeftHandleY,
                                    x2: leftBottomHandleX,
                                    y2: leftBottomHandleY
                                },
                                {
                                    type: VectorPathCommandType.CUBIC_BEZIER_CURVE,
                                    x: topX,
                                    y: topY,
                                    x1: leftTopHandleX,
                                    y1: leftTopHandleY,
                                    x2: topLeftHandleX,
                                    y2: topLeftHandleY
                                },
                            ];
                        }
                    } else if (selectionAddShape.value === 'lasso') {
                        const cursor = new DOMPoint(cursorX * devicePixelRatio, cursorY * devicePixelRatio).matrixTransform(transformInverse)
                        if (!isDrawingSelection.value) {
                            const start = new DOMPoint(startCursorX * devicePixelRatio, startCursorY * devicePixelRatio).matrixTransform(transformInverse)
                            activeSelectionPath.value = [
                                {
                                    type: VectorPathCommandType.MOVE,
                                    editorSelectionShapeIntent: 'lasso',
                                    x: start.x,
                                    y: start.y,
                                },
                                {
                                    type: VectorPathCommandType.LINE,
                                    x: cursor.x,
                                    y: cursor.y,
                                },
                            ];
                        } else {
                            activeSelectionPath.value = [
                                ...activeSelectionPath.value,
                                {
                                    type: VectorPathCommandType.LINE,
                                    x: cursor.x,
                                    y: cursor.y,
                                },
                            ];
                        }
                    }

                    isDrawingSelection.value = true;
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

                    const editorSelectionShapeIntent = activeSelectionPath.value[0]?.editorSelectionShapeIntent;

                    if (editorSelectionShapeIntent === 'lasso') {
                        activeSelectionPath.value.push({
                            type: VectorPathCommandType.LINE,
                            x: (activeSelectionPath.value[0] as AnyVectorPathCommand).x!,
                            y: (activeSelectionPath.value[0] as AnyVectorPathCommand).y!,
                        });
                    }

                    // Update active selection path in history
                    if (editorSelectionShapeIntent === 'freePolygon') {
                        let isFinished = false;
                        if (activeSelectionPath.value.length > 2) {
                            if (this.dragStartHandleIndex === activeSelectionPath.value.length - 1) {
                                const dragHandleIndex = this.getDragHandleIndexAtPagePoint(pointer.up?.pageX ?? pointer.down.pageX, pointer.up?.pageY ?? pointer.down.pageX, activeSelectionPath.value.length - 1);
                                if (dragHandleIndex === 0) {
                                    (activeSelectionPath.value[activeSelectionPath.value.length - 1] as AnyVectorPathCommand).x = (activeSelectionPath.value[0] as AnyVectorPathCommand).x;
                                    (activeSelectionPath.value[activeSelectionPath.value.length - 1] as AnyVectorPathCommand).y = (activeSelectionPath.value[0] as AnyVectorPathCommand).y;
                                    activeSelectionPath.value = [...activeSelectionPath.value];
                                    isFinished = true;
                                }
                            } else if (this.dragStartHandleIndex === 0) {
                                const dragHandleIndex = this.getDragHandleIndexAtPagePoint(pointer.up?.pageX ?? pointer.down.pageX, pointer.up?.pageY ?? pointer.down.pageX, 0);
                                if (dragHandleIndex === activeSelectionPath.value.length - 1) {
                                    (activeSelectionPath.value[0] as AnyVectorPathCommand).x = (activeSelectionPath.value[activeSelectionPath.value.length - 1] as AnyVectorPathCommand).x;
                                    (activeSelectionPath.value[0] as AnyVectorPathCommand).y = (activeSelectionPath.value[activeSelectionPath.value.length - 1] as AnyVectorPathCommand).y;
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
                            this.queueAsyncAction((newPath: Array<VectorPathCommand>, oldPath?: Array<VectorPathCommand>) => {
                                return this.updateActiveSelectionContinuousFinish(newPath, oldPath);
                            }, [activeSelectionPath.value, this.dragStartActiveSelectionPath]);
                            this.freePathStartActiveSelectionPath = undefined;
                        } else {
                            this.queueAsyncAction((newPath: Array<VectorPathCommand>, oldPath?: Array<VectorPathCommand>) => {
                                return this.updateActiveSelectionContinuous(newPath, oldPath);
                            }, [activeSelectionPath.value, this.freePathStartActiveSelectionPath ?? []]);
                        }
                    } else {
                        this.warnIfUnproductiveSelection();
                        if (selectionAddShape.value === 'lasso') {
                            this.simplifyPath();
                        }
                        this.queueAsyncAction((newPath: Array<VectorPathCommand>, oldPath?: Array<VectorPathCommand>) => {
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
                if (activeSelectionPath.value.length > 2 && activeSelectionPath.value[0]?.editorSelectionShapeIntent === 'freePolygon' && dragHandleIndex === 0) {
                    this.warnIfUnproductiveSelection();
                    activeSelectionPath.value.push({
                        type: VectorPathCommandType.LINE,
                        x: (activeSelectionPath.value[0] as AnyVectorPathCommand).x!,
                        y: (activeSelectionPath.value[0] as AnyVectorPathCommand).y!,
                    })
                    this.queueAsyncAction((newPath: Array<VectorPathCommand>, oldPath?: Array<VectorPathCommand>) => {
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

        const dragHandleRadius = isTouch ? this.dragHandleRadiusTouch : this.dragHandleRadius;

        for (const [pathCommandIndex, pathCommand] of activeSelectionPath.value.entries()) {
            if (
                (pathCommand.type === VectorPathCommandType.MOVE && pathCommand.editorSelectionShapeIntent === 'freePolygon') ||
                pathCommand.type === VectorPathCommandType.LINE ||
                pathCommand.type === VectorPathCommandType.CUBIC_BEZIER_CURVE
            ) {
                if (
                    Math.abs(cursor.x - pathCommand.x) < dragHandleRadius * devicePixelRatio / decomposedTransform.scaleX &&
                    Math.abs(cursor.y - pathCommand.y) < dragHandleRadius * devicePixelRatio / decomposedTransform.scaleY
                ) {
                    if (pathCommandIndex === excludeIndex) {
                        continue;
                    } else {
                        pointIndex = pathCommandIndex;
                        break;
                    }
                }
            }
        }
        return pointIndex;
    }

    private addPoint(pointer: PointerTracker) {
        if (
            activeSelectionPath.value.length > 0 &&
            (
                // Active path is a different shape
                (activeSelectionPath.value[0]?.editorSelectionShapeIntent !== 'freePolygon') ||
                // Active path is an already closed path
                this.isActiveSelectionPathClosed()
            )
        ) {
            this.queueAsyncAction((activeSelectionPathOverride: Array<VectorPathCommand>) => {
                return this.applyActiveSelection(activeSelectionPathOverride);
            }, [JSON.parse(JSON.stringify(activeSelectionPath.value))]);
            this.freePathStartActiveSelectionPath = [];
            activeSelectionPath.value = [];
        }

        const transformInverse = canvasStore.get('transform').inverse();
        const cursor = new DOMPoint(pointer.down.pageX * devicePixelRatio, pointer.down.pageY * devicePixelRatio).matrixTransform(transformInverse);

        if (activeSelectionPath.value.length < 1) {
            activeSelectionPath.value = [
                {
                    type: VectorPathCommandType.MOVE,
                    editorSelectionShapeIntent: 'freePolygon',
                    x: cursor.x,
                    y: cursor.y,
                }
            ];
        } else {
            activeSelectionPath.value.push({
                type: VectorPathCommandType.LINE,
                x: cursor.x,
                y: cursor.y,
            });
        }

        this.queueAsyncAction((newPath: Array<VectorPathCommand>, oldPath?: Array<VectorPathCommand>) => {
            return this.updateActiveSelectionContinuous(newPath, oldPath);
        }, [activeSelectionPath.value, this.freePathStartActiveSelectionPath ?? []]);
    }

    private isActiveSelectionPathClosed() {
        if (activeSelectionPath.value[0]?.editorSelectionShapeIntent === 'freePolygon') {
            return (
                activeSelectionPath.value.length > 2
                && (activeSelectionPath.value[activeSelectionPath.value.length - 1] as AnyVectorPathCommand).x
                    === (activeSelectionPath.value[0] as AnyVectorPathCommand).x
                && (activeSelectionPath.value[activeSelectionPath.value.length - 1] as AnyVectorPathCommand).y
                    === (activeSelectionPath.value[0] as AnyVectorPathCommand).y
            );
        }
        return true;
    }

    private canAddPoint() {
        return selectionAddShape.value === 'freePolygon';
    }

    async applyActiveSelection(activeSelectionPathOverride: Array<VectorPathCommand> = activeSelectionPath.value, options?: any) {
        await historyStore.dispatch('runAction', {
            action: new ApplyActiveSelectionAction(activeSelectionPathOverride, options)
        });
    }

    async queueApplyActiveSelection() {
        this.queueAsyncAction((activeSelectionPathOverride: Array<VectorPathCommand>) => {
            return this.applyActiveSelection(activeSelectionPathOverride);
        }, [[...activeSelectionPath.value]]);
    }

    async updateActiveSelection(newPath: Array<VectorPathCommand>, oldPath?: Array<VectorPathCommand>) {
        await historyStore.dispatch('runAction', {
            action: new UpdateActiveSelectionAction(newPath, oldPath)
        });
    }

    async updateActiveSelectionContinuous(newPath: Array<VectorPathCommand>, oldPath?: Array<VectorPathCommand>) {
        await historyStore.dispatch('runAction', {
            action: new BundleAction('createFreeSelectPath', 'action.updateActiveSelection', [
                new UpdateActiveSelectionAction(newPath, oldPath, { updatePreview: false })
            ]),
            replaceHistory: 'createFreeSelectPath',
        });
    }

    async updateActiveSelectionContinuousFinish(newPath: Array<VectorPathCommand>, oldPath?: Array<VectorPathCommand>) {
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

    async deleteSelection() {
        await new Promise(resolve => setTimeout(resolve, 0));
        if (activeSelectionMask.value || appliedSelectionMask.value) {
            const size = (activeSelectionMask.value?.width ?? appliedSelectionMask.value?.width ?? 1) * (activeSelectionMask.value?.height ?? appliedSelectionMask.value?.height ?? 1);
            await historyStore.dispatch('runAction', {
                action: new DeleteLayerSelectionAreaAction(),
                blockInteraction: size > 2048 * 2048,
            });
        }
    }

    async queueDeleteSelection() {
        this.queueAsyncAction(() => {
            return this.deleteSelection();
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

    warnIfUnproductiveSelection() {
        if (appliedSelectionMask.value != null) return;
        if (getSelectedLayers().length > 0) return;
        appEmitter.emit('app.notify', {
            type: 'info',
            title: t('toolbar.selection.notification.unproductiveSelection.title'),
            message: t('toolbar.selection.notification.unproductiveSelection.message'),
            dangerouslyUseHTMLString: true,
            duration: 10000,
        });
    }

    simplifyPath() {
        const tolerance = 1;

        if (activeSelectionPath.value.length > 1) {
            var sqTolerance = tolerance * tolerance;
            
            let prevPoint = activeSelectionPath.value[0];
            const newCommands: VectorPathCommand[] = [prevPoint];
            let command!: VectorPathCommand;
        
            for (let i = 1, len = activeSelectionPath.value.length; i < len; i++) {
                command = activeSelectionPath.value[i];
        
                const squareDistance = (
                    Math.pow((command as AnyVectorPathCommand).x! - (prevPoint as AnyVectorPathCommand).x!, 2)
                    + Math.pow((command as AnyVectorPathCommand).y! - (prevPoint as AnyVectorPathCommand).y!, 2)
                );
                
                if (squareDistance > sqTolerance) {
                    newCommands.push(command);
                    prevPoint = command;
                }
            }
            if (prevPoint !== command) newCommands.push(command);
        }
    }

    protected handleCursorIcon() {
        let newIcon = super.handleCursorIcon();
        if (!newIcon) {
            const editorSelectionShapeIntent = activeSelectionPath.value[0]?.editorSelectionShapeIntent;
            if (this.hoveringActiveSelectionPathIndex > -1 && editorSelectionShapeIntent !== 'lasso') {
                if (
                    this.hoveringActiveSelectionPathIndex === 0 &&
                    activeSelectionPath.value.length > 2 &&
                    editorSelectionShapeIntent === 'freePolygon' &&
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
