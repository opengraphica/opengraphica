import { nextTick, watch, WatchStopHandle } from 'vue';
import BaseCanvasMovementController from './base-movement';
import { layerPickMode, useRotationSnapping, freeTransformEmitter, top, left, width, height, rotation, transformOriginX, transformOriginY, dimensionLockRatio, previewXSnap, previewYSnap, dragHandleHighlight, rotateHandleHighlight } from '../store/free-transform-state';
import { appliedSelectionMask, appliedSelectionMaskCanvasOffset, activeSelectionMask, activeSelectionMaskCanvasOffset } from '../store/selection-state';
import canvasStore from '@/store/canvas';
import historyStore from '@/store/history';
import preferencesStore from '@/store/preferences';
import workingFileStore, { getLayerById } from '@/store/working-file';
import { ColorModel, DrawWorkingFileOptions, UpdateAnyLayerOptions, WorkingFileLayer } from '@/types';
import { DecomposedMatrix, decomposeMatrix } from '@/lib/dom-matrix';
import { CreateNewLayersFromSelectionAction } from '@/actions/create-new-layers-from-selection';
import { ClearSelectionAction } from '@/actions/clear-selection';
import { SelectLayersAction } from '@/actions/select-layers';
import { UpdateLayerAction } from '@/actions/update-layer';
import { BundleAction } from '@/actions/bundle';
import { drawWorkingFileToCanvas } from '@/lib/canvas';
import { getImageDataFromImage, getImageDataEmptyBounds } from '@/lib/image';
import { isInput } from '@/lib/events';
import appEmitter from '@/lib/emitter';
import { AsyncCallbackQueue } from '@/lib/timing';
import { isShiftKeyPressed } from '@/lib/keyboard';

const DRAG_TYPE_ALL = 0;
const DRAG_TYPE_TOP = 1;
const DRAG_TYPE_BOTTOM = 2;
const DRAG_TYPE_LEFT = 4;
const DRAG_TYPE_RIGHT = 8;

interface DragResizeTransformInfo {
    top: number;
    left: number;
    width: number;
    height: number;
}

interface TransformInfo extends DragResizeTransformInfo {
    rotation: number;
    handleToRotationOrigin: number;
}

type PointerProcessStep = 'start' | 'move' | 'end' | null;

export default class CanvasFreeTransformController extends BaseCanvasMovementController {

    private remToPx: number = 16;
    private transformTranslateStart: DOMPoint | null = null;
    private transformStartDimensions: TransformInfo = { top: 0, left: 0, width: 0, height: 0, rotation: 0, handleToRotationOrigin: 0 };
    private transformStartLayerData: { transform: DOMMatrix }[] = [];
    private transformStartPickLayer: number | null = null;
    private transformDragType: number = 0;
    private transformIsDragging: boolean = false;
    private transformIsRotating: boolean = false;
    private isPointerDragging: boolean = false;
    private actionQueue: AsyncCallbackQueue = new AsyncCallbackQueue();

    private setBoundsDebounceHandle: number | undefined;
    private selectedLayers: WorkingFileLayer<ColorModel>[] = [];
    private selectedLayerIdsWatchStop: WatchStopHandle | null = null;

    onEnter(): void {
        super.onEnter();
        this.remToPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
        dimensionLockRatio.value = null;

        // Set transform bounds based on selected layer list.
        this.selectedLayerIdsWatchStop = watch(() => workingFileStore.state.selectedLayerIds, (selectedLayerIds) => {
            const selectedLayers: WorkingFileLayer<ColorModel>[] = [];
            if (selectedLayerIds.length > 0) {
                for (let id of selectedLayerIds) {
                    const layer = getLayerById(id);
                    if (layer) {
                        selectedLayers.push(layer);
                    }
                }
            }
            this.selectedLayers = selectedLayers;
            this.setBoundsFromSelectedLayers();
        }, { immediate: true });

        this.onCancelCurrentAction = this.onCancelCurrentAction.bind(this);
        this.onHistoryStep = this.onHistoryStep.bind(this);
        this.onStoreTransformStart = this.onStoreTransformStart.bind(this);
        this.onPreviewRotationChange = this.onPreviewRotationChange.bind(this);
        this.onPreviewDragResizeChange = this.onPreviewDragResizeChange.bind(this);
        this.onCommitTransforms = this.onCommitTransforms.bind(this);
        appEmitter.on('editor.tool.cancelCurrentAction', this.onCancelCurrentAction);
        appEmitter.on('editor.history.step', this.onHistoryStep);
        freeTransformEmitter.on('storeTransformStart', this.onStoreTransformStart);
        freeTransformEmitter.on('previewRotationChange', this.onPreviewRotationChange);
        freeTransformEmitter.on('previewDragResizeChange', this.onPreviewDragResizeChange);
        freeTransformEmitter.on('commitTransforms', this.onCommitTransforms);
    }

    onLeave(): void {
        if (this.selectedLayerIdsWatchStop) {
            this.selectedLayerIdsWatchStop();
            this.selectedLayerIdsWatchStop = null;
        }
        appEmitter.off('editor.tool.cancelCurrentAction', this.onCancelCurrentAction);
        appEmitter.off('editor.history.step', this.onHistoryStep);
        freeTransformEmitter.off('storeTransformStart', this.onStoreTransformStart);
        freeTransformEmitter.off('previewRotatioffChange', this.onPreviewRotationChange);
        freeTransformEmitter.off('previewDragResiffeChange', this.onPreviewDragResizeChange);
        freeTransformEmitter.off('commitTransforms', this.onCommitTransforms);
    }

    onMultiTouchDown() {
        super.onMultiTouchDown();
        if (this.touches.length === 1) {
            this.onTransformStart();
        }
    }

    onPointerDown(e: PointerEvent): void {
        super.onPointerDown(e);
        if (isInput(e.target)) return;
        if (e.isPrimary && ['mouse', 'pen'].includes(e.pointerType) && e.button === 0) {
            this.onTransformStart();
        }
    }

    onPointerMove(e: PointerEvent) {
        super.onPointerMove(e);
        const pointer = this.pointers.filter((pointer) => pointer.id === e.pointerId)[0];
        if (e.isPrimary && this.transformTranslateStart) {
            const { viewTransformPoint } = this.getTransformedCursorInfo();
            const { shouldMaintainAspectRatio, shouldScaleDuringResize, shouldSnapRotationDegrees } = this.getTransformOptions();

            if (pointer.isDragging) {
                this.isPointerDragging = true;
            }

            // Rotation
            if (this.transformIsRotating) {
                const handleRotation = Math.atan2(
                    viewTransformPoint.y - (top.value + (height.value * transformOriginY.value)),
                    viewTransformPoint.x - (left.value + (width.value * transformOriginX.value))
                );
                let rotationDelta = handleRotation - this.transformStartDimensions.handleToRotationOrigin;

                if (shouldSnapRotationDegrees) {
                    const targetRotation = this.transformStartDimensions.rotation + rotationDelta;
                    const roundedTargetRotation = Math.round(targetRotation / (Math.PI / 18)) * (Math.PI / 18);
                    rotationDelta -= targetRotation - roundedTargetRotation;
                }

                this.previewRotationChange(this.transformStartDimensions.rotation + rotationDelta);
            }
            // Drag/Resize
            else if (this.transformIsDragging) {

                const isDragAll = this.transformDragType === DRAG_TYPE_ALL;
                let isDragLeft = Math.floor(this.transformDragType / DRAG_TYPE_LEFT) % 2 === 1;
                let isDragRight = Math.floor(this.transformDragType / DRAG_TYPE_RIGHT) % 2 === 1;
                let isDragTop = Math.floor(this.transformDragType / DRAG_TYPE_TOP) % 2 === 1;
                let isDragBottom = Math.floor(this.transformDragType / DRAG_TYPE_BOTTOM) % 2 === 1;
    
                const dx = Math.round(viewTransformPoint.x - this.transformTranslateStart.x);
                const dy = Math.round(viewTransformPoint.y - this.transformTranslateStart.y);
                const xFactor = Math.cos(rotation.value);
                const yFactor = Math.sin(rotation.value);

                const transformStartAppliedWidth = this.transformStartDimensions.width + (xFactor * dx) + (yFactor * dy);
                const transformStartAppliedHeight = this.transformStartDimensions.height + (xFactor * dy) - (yFactor * dx);
                let offsetWidth = transformStartAppliedWidth;
                let offsetHeight = transformStartAppliedHeight;
                if (isDragLeft) {
                    offsetWidth = this.transformStartDimensions.width - ((xFactor * dx) + (yFactor * dy));
                }
                if (isDragTop) {
                    offsetHeight = this.transformStartDimensions.height - ((xFactor * dy) - (yFactor * dx));
                }
                // @ts-ignore
                if (shouldMaintainAspectRatio && (isDragLeft + isDragRight + isDragTop + isDragBottom > 1)) {
                    const ratioOffsetWidth = offsetHeight * (this.transformStartDimensions.width / this.transformStartDimensions.height);
                    const ratioOffsetHeight = offsetWidth * (this.transformStartDimensions.height / this.transformStartDimensions.width);
                    if (offsetHeight > ratioOffsetHeight) {
                        offsetWidth = ratioOffsetWidth;
                    } else {
                        offsetHeight = ratioOffsetHeight;
                    }
                }
    
                // Determine dimensions
                let left = this.transformStartDimensions.left;
                let top = this.transformStartDimensions.top;
                let width = this.transformStartDimensions.width;
                let height = this.transformStartDimensions.height;
                if (isDragAll) {
                    top = this.transformStartDimensions.top + dy;
                    left = this.transformStartDimensions.left + dx;
                }
                if (isDragTop || isDragLeft) {
                    left = this.transformStartDimensions.left;
                    top = this.transformStartDimensions.top;
                }
                if (isDragTop) {
                    const heightDifference = Math.max(-this.transformStartDimensions.height + 1, (offsetHeight - this.transformStartDimensions.height));
                    const offsetX = -yFactor * heightDifference;
                    const offsetY = xFactor * heightDifference;
                    left -= offsetX;
                    top -= offsetY;
                }
                if (isDragLeft) {
                    const widthDifference = Math.max(-this.transformStartDimensions.width + 1, (offsetWidth - this.transformStartDimensions.width));
                    const offsetX = xFactor * widthDifference;
                    const offsetY = yFactor * widthDifference;
                    left -= offsetX;
                    top -= offsetY;
                }
                if (isDragLeft || isDragRight) {
                    width = offsetWidth;
                }
                if (isDragTop || isDragBottom) {
                    height = offsetHeight;
                }
    
                // Don't allow negative width/height
                if (width <= 1) {
                    width = 1;
                }
                if (height <= 1) {
                    height = 1;
                }

                this.previewDragResizeChange({
                    top,
                    left,
                    width,
                    height,
                }, shouldScaleDuringResize);
                
            }

            canvasStore.set('dirty', true);
        }
        // Set handle highlights based on mouse hover
        if (!this.transformTranslateStart && e.isPrimary && ['mouse', 'pen'].includes(e.pointerType)) {
            const { transformBoundsPoint, viewDecomposedTransform } = this.getTransformedCursorInfo();
            if (this.isPointOnRotateHandle(transformBoundsPoint, viewDecomposedTransform)) {
                rotateHandleHighlight.value = true;
                dragHandleHighlight.value = null;
            } else {
                rotateHandleHighlight.value = false;
                let transformDragType = this.getTransformDragType(transformBoundsPoint, viewDecomposedTransform);
                if (transformDragType != null) {
                    dragHandleHighlight.value = transformDragType;
                } else {
                    dragHandleHighlight.value = null;
                }
            }
        }
    }

    async onPointerUp(e: PointerEvent): Promise<void> {
        super.onPointerUp(e);
        if (e.isPrimary) {
            this.onTransformEnd();    
        }
    }

    async onTransformStart() {
        this.actionQueue.push(async () => {
            this.isPointerDragging = false;
            let { transformBoundsPoint, viewTransformPoint, viewDecomposedTransform } = this.getTransformedCursorInfo();
    
            if ((activeSelectionMask.value || appliedSelectionMask.value)) {
                if (this.selectedLayers.length > 0) {
                    layerPickMode.value === 'current';
                    await historyStore.dispatch('runAction', {
                        action: new CreateNewLayersFromSelectionAction({ clearSelection: true, selectNewLayers: 'replace' })
                    });
                } else {
                    await historyStore.dispatch('runAction', {
                        action: new ClearSelectionAction()
                    });
                }
            }

            // Figure out which resize/rotate handles were clicked on, or if clicked in empty space just to drag
            this.determineDragRotateType(transformBoundsPoint, viewTransformPoint, viewDecomposedTransform);
    
            // Auto select layer outside drag handles
            if (layerPickMode.value === 'auto') {
                this.transformStartPickLayer = this.pickLayer(viewTransformPoint);
            }
            if (!this.transformTranslateStart && layerPickMode.value === 'auto') {
                const layerId = this.transformStartPickLayer;
                this.transformStartPickLayer = null;
                if (layerId != null && layerId != workingFileStore.get('selectedLayerIds')[0]) {
                    await historyStore.dispatch('runAction', {
                        action: new SelectLayersAction([layerId])
                    });
                    await nextTick();
                    this.setBoundsFromSelectedLayersImmediate();
                    let { transformBoundsPoint, viewTransformPoint, viewDecomposedTransform } = this.getTransformedCursorInfo();
                    this.determineDragRotateType(transformBoundsPoint, viewTransformPoint, viewDecomposedTransform);
                }
            }
    
            // If we're about to do some rotate/resize/drag, switch the viewport for better performance with large images.
            if (this.transformTranslateStart) {
                preferencesStore.set('useCanvasViewport', true);
                canvasStore.set('useCssViewport', false);
                canvasStore.set('viewDirty', true);
            }
        });
    }

    async onTransformEnd() {
        this.actionQueue.push(async () => {
            if (this.transformTranslateStart) {
                try {
                    await this.commitTransforms();
                } catch (error) { /* Ignore */ }
                if (!preferencesStore.get('preferCanvasViewport')) {
                    preferencesStore.set('useCanvasViewport', false);
                    canvasStore.set('useCssViewport', true);
                }
                try {
                    if (this.transformStartPickLayer != null && !this.isPointerDragging) {
                        const layerId = this.transformStartPickLayer;
                        if (layerId != workingFileStore.get('selectedLayerIds')[0]) {
                            await historyStore.dispatch('runAction', {
                                action: new SelectLayersAction([layerId])
                            });
                            await nextTick();
                            this.setBoundsFromSelectedLayers();
                        }
                    }
                } catch (error) { /* Ignore */ }
                this.transformStartPickLayer = null;
            }
            dragHandleHighlight.value = null;
        });
    }

    private onCancelCurrentAction() {
        if (this.transformStartDimensions) {
            if (this.transformIsRotating) {
                this.previewRotationChange(this.transformStartDimensions.rotation);
            }
            if (this.transformIsDragging) {
                this.previewDragResizeChange(this.transformStartDimensions);
            }
            this.transformTranslateStart = null;
            this.transformIsRotating = false;
            this.transformIsDragging = false;
            canvasStore.set('dirty', true);
        }
    }

    private onHistoryStep() {
        this.setBoundsFromSelectedLayers();
    }

    private onStoreTransformStart(event?: { viewTransformPoint?: DOMPoint }) {
        this.storeTransformStart(event?.viewTransformPoint);
    }

    private onPreviewRotationChange(event?: { rotation: number }) {
        if (event) {
            this.previewRotationChange(event.rotation);
            canvasStore.set('dirty', true);
        }
    }

    private onPreviewDragResizeChange(event?: { transform: DragResizeTransformInfo, shouldScaleDuringResize?: boolean }) {
        if (event) {
            this.previewDragResizeChange(event.transform, event.shouldScaleDuringResize);
            canvasStore.set('dirty', true);
        }
    }

    private onCommitTransforms(event?: {}) {
        this.commitTransforms();
    }

    private storeTransformStart(viewTransformPoint?: DOMPoint) {
        if (!viewTransformPoint) {
            viewTransformPoint = this.getTransformedCursorInfo().viewTransformPoint;
        }
        this.transformTranslateStart = viewTransformPoint;
        this.transformStartDimensions = {
            top: top.value,
            left: left.value,
            width: width.value,
            height: height.value,
            rotation: rotation.value,
            handleToRotationOrigin: 0
        };
        this.transformStartLayerData = [];

        for (let layer of this.selectedLayers) {
            this.transformStartLayerData.push({
                transform: layer.transform
            });
        }
    }

    private determineDragRotateType(viewTransformPoint: DOMPoint, transformBoundsPoint: DOMPoint, viewDecomposedTransform: DecomposedMatrix) {
        this.storeTransformStart(viewTransformPoint);
        this.transformIsRotating = false;
        this.transformIsDragging = false;
        // Determine which dimensions to drag on
        if (this.isPointOnRotateHandle(transformBoundsPoint, viewDecomposedTransform)) {
            this.transformIsRotating = true;
            rotateHandleHighlight.value = true;
            this.transformStartDimensions.handleToRotationOrigin = Math.atan2(
                viewTransformPoint.y - (top.value + (height.value * transformOriginY.value)),
                viewTransformPoint.x - (left.value + (width.value * transformOriginX.value))
            );
            this.transformDragType = DRAG_TYPE_ALL;
            dragHandleHighlight.value = null;
        } else {
            rotateHandleHighlight.value = false;
            let transformDragType = this.getTransformDragType(transformBoundsPoint, viewDecomposedTransform);
            if (transformDragType != null) {
                this.transformDragType = transformDragType;
            } else {
                if (layerPickMode.value === 'current') {
                    this.transformDragType = DRAG_TYPE_ALL;
                } else {
                    this.transformTranslateStart = null;
                }
            }
            if (!transformDragType != null) {
                this.transformIsDragging = true;
            }
            dragHandleHighlight.value = transformDragType;
        }
    }

    private previewRotationChange(newRotation: number) {
        const rotationDelta = newRotation - this.transformStartDimensions.rotation;
        freeTransformEmitter.emit('setDimensions', {
            rotation: newRotation,
            transformOriginX: transformOriginX.value,
            transformOriginY: transformOriginY.value
        });
        for (const [i, layer] of this.selectedLayers.entries()) {
            const layerTransformOriginX = left.value + (transformOriginX.value * width.value);
            const layerTransformOriginY = top.value + (transformOriginY.value * height.value);
            const layerTransformOrigin = new DOMPoint(layerTransformOriginX, layerTransformOriginY).matrixTransform(this.transformStartLayerData[i].transform.inverse());
            const decomposedTransform = decomposeMatrix(this.transformStartLayerData[i].transform);
            const transform =
                DOMMatrix.fromMatrix(this.transformStartLayerData[i].transform)
                .translateSelf(layerTransformOrigin.x, layerTransformOrigin.y)
                .scaleSelf(1 / decomposedTransform.scaleX, 1 / decomposedTransform.scaleY)
                .rotateSelf(rotationDelta * Math.RADIANS_TO_DEGREES)
                .scaleSelf(decomposedTransform.scaleX, decomposedTransform.scaleY)
                .translateSelf(-layerTransformOrigin.x, -layerTransformOrigin.y);
            layer.transform = transform;
        }
    }

    private previewDragResizeChange(newTransform: DragResizeTransformInfo, shouldScaleDuringResize?: boolean) {
        if (shouldScaleDuringResize == null) {
            shouldScaleDuringResize = this.getTransformOptions().shouldScaleDuringResize;
        }
        // Determine top/left offset based on width/height change
        let transformOriginXPoint = (this.transformStartDimensions.width * transformOriginX.value);
        let transformOriginYPoint = (this.transformStartDimensions.height * transformOriginY.value);
        const decomposedStartDimensions = decomposeMatrix(
            new DOMMatrix()
            .translateSelf(-transformOriginXPoint, -transformOriginYPoint)
            .translateSelf(newTransform.left, newTransform.top)
            .rotateSelf(rotation.value * Math.RADIANS_TO_DEGREES)
            .translateSelf(transformOriginXPoint, transformOriginYPoint)
        );
        transformOriginXPoint = (newTransform.width * transformOriginX.value);
        transformOriginYPoint = (newTransform.height * transformOriginY.value);
        const decomposedEndDimensions = decomposeMatrix(
            new DOMMatrix()
            .translateSelf(-transformOriginXPoint, -transformOriginYPoint)
            .translateSelf(newTransform.left, newTransform.top)
            .rotateSelf(rotation.value * Math.RADIANS_TO_DEGREES)
            .translateSelf(transformOriginXPoint, transformOriginYPoint)
        );

        // Apply new dimensions
        freeTransformEmitter.emit('setDimensions', {
            left: newTransform.left + decomposedEndDimensions.translateX - decomposedStartDimensions.translateX,
            top: newTransform.top + decomposedEndDimensions.translateY - decomposedStartDimensions.translateY,
            width: newTransform.width,
            height: newTransform.height
        });
        for (const [i, layer] of this.selectedLayers.entries()) {
            const decomposedTransform = decomposeMatrix(this.transformStartLayerData[i].transform);
            let transform = DOMMatrix.fromMatrix(this.transformStartLayerData[i].transform)
            if (shouldScaleDuringResize) {
                transform.scaleSelf(1 / decomposedTransform.scaleX, 1 / decomposedTransform.scaleY);
            }
            transform
                .rotateSelf(-decomposedTransform.rotation * Math.RADIANS_TO_DEGREES)
                .translateSelf(newTransform.left - this.transformStartDimensions.left, newTransform.top - this.transformStartDimensions.top)
                .rotateSelf(decomposedTransform.rotation * Math.RADIANS_TO_DEGREES)
            if (shouldScaleDuringResize) {
                transform.scaleSelf(decomposedTransform.scaleX * newTransform.width / this.transformStartDimensions.width, decomposedTransform.scaleY * newTransform.height / this.transformStartDimensions.height)
            }
            layer.transform = transform;
        }
    }

    private async commitTransforms() {
        try {
            let { shouldScaleDuringResize } = this.getTransformOptions();
            width.value = Math.max(1, width.value);
            height.value = Math.max(1, height.value);
            previewXSnap.value = [];
            previewYSnap.value = [];

            if (
                left.value != this.transformStartDimensions.left ||
                top.value != this.transformStartDimensions.top ||
                width.value != this.transformStartDimensions.width ||
                height.value != this.transformStartDimensions.height ||
                rotation.value != this.transformStartDimensions.rotation
            ) {
                const updateLayerActions: UpdateLayerAction<UpdateAnyLayerOptions<ColorModel>>[] = [];
                for (const [i, layer] of this.selectedLayers.entries()) {
                    updateLayerActions.push(
                        new UpdateLayerAction({
                            id: layer.id,
                            transform: layer.transform,
                            ...(shouldScaleDuringResize ? {} : {
                                width: width.value,
                                height: height.value
                            })
                        }, {
                            transform: this.transformStartLayerData[i].transform
                        })
                    );
                }
                await historyStore.dispatch('runAction', {
                    action: new BundleAction('freeTransform', 'Free Transform', updateLayerActions)
                });
            }
        } catch (error) {
            console.error(error);
        }
        this.transformTranslateStart = null;
        this.transformStartLayerData = [];
        this.transformStartDimensions = { top: 0, left: 0, width: 0, height: 0, rotation: 0, handleToRotationOrigin: 0 };
        this.transformIsRotating = false;
        this.transformIsDragging = false;
    }

    private getTransformedCursorInfo(): { viewTransformPoint: DOMPoint, transformBoundsPoint: DOMPoint, viewDecomposedTransform: DecomposedMatrix } {
        const devicePixelRatio = window.devicePixelRatio || 1;
        const viewTransform = canvasStore.get('transform');
        const viewDecomposedTransform = canvasStore.get('decomposedTransform');
        const viewTransformPoint = new DOMPoint(this.lastCursorX * devicePixelRatio, this.lastCursorY * devicePixelRatio)
            .matrixTransform(viewTransform.inverse());
        
        const originTranslateX = left.value + (transformOriginX.value * width.value);
        const originTranslateY = top.value + (transformOriginY.value * height.value);
        const boundsTransform =
            new DOMMatrix()
            .translateSelf(originTranslateX, originTranslateY)
            .rotateSelf(rotation.value * Math.RADIANS_TO_DEGREES)
            .translateSelf(-originTranslateX, -originTranslateY);
        const transformBoundsPoint =
            new DOMPoint(this.lastCursorX * devicePixelRatio, this.lastCursorY * devicePixelRatio)
            .matrixTransform(viewTransform.inverse())
            .matrixTransform(boundsTransform.inverse());
        return {
            viewTransformPoint,
            transformBoundsPoint,
            viewDecomposedTransform
        };
    }

    private pickLayer(viewTransformPoint: DOMPoint): number | null {
        const workingCanvas = document.createElement('canvas');
        workingCanvas.width = 1;
        workingCanvas.height = 1;
        const ctx = workingCanvas.getContext('2d');
        if (!ctx) return null;
        const initialTransform = new DOMMatrix().translateSelf(-viewTransformPoint.x, -viewTransformPoint.y);
        const selectionTest: DrawWorkingFileOptions['selectionTest'] = {
            point: new DOMPoint(),
            resultId: undefined,
            resultPixelTest: undefined
        };
        drawWorkingFileToCanvas(workingCanvas, ctx, { initialTransform, selectionTest });
        return selectionTest.resultId != null ? selectionTest.resultId : null;
    }

    private isPointOnRotateHandle(point: DOMPoint, viewDecomposedTransform: DecomposedMatrix): boolean {
        const devicePixelRatio = window.devicePixelRatio || 1;
        this.remToPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const handleOffset = 2 * this.remToPx / viewDecomposedTransform.scaleX * devicePixelRatio;
        const handleSize = 2 * this.remToPx / viewDecomposedTransform.scaleX * devicePixelRatio;
        const halfHandleSize = handleSize / 2;
        if (
            point.x > left.value + (width.value / 2) - halfHandleSize &&
            point.x < left.value + (width.value / 2) + halfHandleSize &&
            point.y > top.value - handleOffset - halfHandleSize &&
            point.y < top.value - handleOffset + halfHandleSize
        ) {
            return true;
        }
        return false;
    }

    private getTransformDragType(point: DOMPoint, viewDecomposedTransform: DecomposedMatrix): number | null {
        const devicePixelRatio = window.devicePixelRatio || 1;
        let transformDragType: number | null = 0;
        this.remToPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const handleSize = (0.75 * this.remToPx / viewDecomposedTransform.scaleX * devicePixelRatio) + 2;
        const touchForgivenessMargin = this.touches.length > 0 ? handleSize / 2 : 0;
        const innerHandleSizeVertical = touchForgivenessMargin;
        const innerHandleSizeHorizontal = touchForgivenessMargin;
        if (point.y >= top.value - handleSize - touchForgivenessMargin && point.y <= top.value + innerHandleSizeVertical) {
            transformDragType |= DRAG_TYPE_TOP;
        }
        if (point.y >= top.value + height.value - innerHandleSizeVertical && point.y <= top.value + height.value + handleSize + touchForgivenessMargin) {
            transformDragType |= DRAG_TYPE_BOTTOM;
        }
        if (point.x >= left.value - handleSize - touchForgivenessMargin && point.x <= left.value + innerHandleSizeHorizontal) {
            transformDragType |= DRAG_TYPE_LEFT;
        }
        if (point.x >= left.value + width.value - innerHandleSizeHorizontal && point.x <= left.value + width.value + handleSize + touchForgivenessMargin) {
            transformDragType |= DRAG_TYPE_RIGHT;
        }
        if (
            point.x < left.value - handleSize - touchForgivenessMargin ||
            point.x > left.value + width.value + handleSize + touchForgivenessMargin ||
            point.y < top.value - handleSize - touchForgivenessMargin ||
            point.y > top.value + height.value + handleSize + touchForgivenessMargin
        ) {
            transformDragType = null;
        }
        return transformDragType;
    }

    private setBoundsFromSelectedLayers() {
        clearTimeout(this.setBoundsDebounceHandle);
        const setBoundsDebounceHandle = window.setTimeout(async () => {
            await nextTick();
            if (setBoundsDebounceHandle === this.setBoundsDebounceHandle) {
                this.setBoundsFromSelectedLayersImmediate();
            }
        }, 100);
        this.setBoundsDebounceHandle = setBoundsDebounceHandle;
    }

    private setBoundsFromSelectedLayersImmediate() {
        // If there's a current selection mask, match the bounds to the selection mask.
        const selectionMask: HTMLImageElement | null = activeSelectionMask.value || appliedSelectionMask.value;
        if (selectionMask) {
            const selectionOffset: DOMPoint = (selectionMask === activeSelectionMask.value ? activeSelectionMaskCanvasOffset.value : appliedSelectionMaskCanvasOffset.value);
            const selectionBounds = getImageDataEmptyBounds(getImageDataFromImage(selectionMask));
            freeTransformEmitter.emit('setDimensions', {
                left: selectionOffset.x + selectionBounds.left,
                top: selectionOffset.y + selectionBounds.top,
                width: selectionBounds.right - selectionBounds.left,
                height: selectionBounds.bottom - selectionBounds.top,
                rotation: 0
            });
        }
        // For single layer selection, read transform data from that layer.
        else if (this.selectedLayers.length === 1) {
            const activeLayer = this.selectedLayers[0];
            const originPosX = activeLayer.width * transformOriginX.value;
            const originPosY = activeLayer.height * transformOriginY.value;
            const decomposedTransform = decomposeMatrix(activeLayer.transform);
            const decomposedPositionTransform = decomposeMatrix(
                DOMMatrix.fromMatrix(activeLayer.transform)
                .translateSelf(originPosX, originPosY)
                .scaleSelf(1 / decomposedTransform.scaleX, 1 / decomposedTransform.scaleY)
                .rotateSelf(-decomposedTransform.rotation * Math.RADIANS_TO_DEGREES)
                .scaleSelf(decomposedTransform.scaleX, decomposedTransform.scaleY)
                .translateSelf(-originPosX, -originPosY)
            );
            freeTransformEmitter.emit('setDimensions', {
                left: decomposedPositionTransform.translateX,
                top: decomposedPositionTransform.translateY,
                width: activeLayer.width * decomposedTransform.scaleX,
                height: activeLayer.height * decomposedTransform.scaleY,
                rotation: decomposedTransform.rotation
            });
        }
    }

    protected getTransformOptions() {
        let shouldMaintainAspectRatio: boolean = true;
        let shouldScaleDuringResize: boolean = true;
        let shouldSnapRotationDegrees: boolean = useRotationSnapping.value;
        if (isShiftKeyPressed.value === true) {
            shouldMaintainAspectRatio = false;
            shouldSnapRotationDegrees = !useRotationSnapping.value;
        }
        if (this.selectedLayers.length === 1) {
            const firstLayer = this.selectedLayers[0];
            if (firstLayer.type === 'text') {
                shouldMaintainAspectRatio = false;
                shouldScaleDuringResize = false;
            }
        }
        return { shouldMaintainAspectRatio, shouldScaleDuringResize, shouldSnapRotationDegrees };
    }

}
