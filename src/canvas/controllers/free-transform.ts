import { watch, WatchStopHandle } from 'vue';
import BaseCanvasMovementController from './base-movement';
import { freeTransformEmitter, top, left, width, height, rotation, transformOriginX, transformOriginY, dimensionLockRatio, previewXSnap, previewYSnap, dragHandleHighlight, rotateHandleHighlight } from '../store/free-transform-state';
import canvasStore from '@/store/canvas';
import historyStore from '@/store/history';
import workingFileStore, { getLayerById } from '@/store/working-file';
import { RGBAColor, UpdateAnyLayerOptions, WorkingFileLayer } from '@/types';
import { DecomposedMatrix, decomposeMatrix } from '@/lib/dom-matrix';
import { UpdateLayerAction } from '@/actions/update-layer';
import { BundleAction } from '@/actions/bundle';
import appEmitter from '@/lib/emitter';

const DRAG_TYPE_ALL = 0;
const DRAG_TYPE_TOP = 1;
const DRAG_TYPE_BOTTOM = 2;
const DRAG_TYPE_LEFT = 4;
const DRAG_TYPE_RIGHT = 8;

export default class CanvasFreeTransformController extends BaseCanvasMovementController {

    private remToPx: number = 16;
    private transformTranslateStart: DOMPoint | null = null;
    private transformStartDimensions: {
        top: number, left: number, width: number, height: number, rotation: number, handleToRotationOrigin: number
    } = { top: 0, left: 0, width: 0, height: 0, rotation: 0, handleToRotationOrigin: 0 };
    private transformStartLayerData: { transform: DOMMatrix }[] = [];
    private transformDragType: number = 0;
    private transformIsRotating: boolean = false;

    private setBoundsDebounceHandle: number | undefined;
    private activeLayer: WorkingFileLayer<RGBAColor> | null = null;
    private selectedLayers: WorkingFileLayer<RGBAColor>[] = [];
    private activeLayerIdWatchStop: WatchStopHandle | null = null;
    private selectedLayerIdsWatchStop: WatchStopHandle | null = null;

    onEnter(): void {
        super.onEnter();
        this.remToPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
        dimensionLockRatio.value = null;

        this.activeLayerIdWatchStop = watch(() => workingFileStore.state.activeLayerId, (activeLayerId) => {
            if (activeLayerId != null) {
                const layer = getLayerById(activeLayerId);
                this.activeLayer = layer;
                if (this.activeLayer && workingFileStore.state.selectedLayerIds.length === 0) {
                    this.selectedLayers = [this.activeLayer];
                    this.setBoundsFromSelectedLayers();
                }
            }
        }, { immediate: true });

        this.selectedLayerIdsWatchStop = watch(() => workingFileStore.state.selectedLayerIds, (selectedLayerIds) => {
            if (selectedLayerIds.length > 0) {
                const selectedLayers = [];
                for (let id of selectedLayerIds) {
                    const layer = getLayerById(id);
                    selectedLayers.push(layer);
                }
            } else if (this.activeLayer) {
                this.selectedLayers = [this.activeLayer];
            }
            this.setBoundsFromSelectedLayers();
        }, { immediate: true });

        appEmitter.on('editor.history.step', (this.onHistoryStep).bind(this));
    }

    onLeave(): void {
        if (this.activeLayerIdWatchStop) {
            this.activeLayerIdWatchStop();
            this.activeLayerIdWatchStop = null;
        }
        if (this.selectedLayerIdsWatchStop) {
            this.selectedLayerIdsWatchStop();
            this.selectedLayerIdsWatchStop = null;
        }
        appEmitter.off('editor.history.step', (this.onHistoryStep).bind(this));
    }

    onMultiTouchDown() {
        super.onMultiTouchDown();
        if (this.touches.length === 1) {
            this.onTransformDown();
        }
    }

    onPointerDown(e: PointerEvent): void {
        super.onPointerDown(e);
        if (e.isPrimary && ['mouse', 'pen'].includes(e.pointerType) && e.button === 0) {
            this.onTransformDown();
        }
    }

    onTransformDown() {
        const { transformBoundsPoint, viewTransformPoint, viewDecomposedTransform } = this.getTransformedCursorInfo();
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
            this.transformIsRotating = false;
            rotateHandleHighlight.value = false;
            let transformDragType = this.getTransformDragType(transformBoundsPoint, viewDecomposedTransform);
            if (transformDragType != null) {
                this.transformDragType = transformDragType;
                dragHandleHighlight.value = transformDragType;
            } else {
                this.transformTranslateStart = null;
                dragHandleHighlight.value = null;
            }
        }
    }

    onPointerMove(e: PointerEvent): void {
        super.onPointerMove(e);
        if (e.isPrimary && this.transformTranslateStart) {
            const { viewTransformPoint } = this.getTransformedCursorInfo();

            // Rotation
            if (this.transformIsRotating) {
                const handleRotation = Math.atan2(
                    viewTransformPoint.y - (top.value + (height.value * transformOriginY.value)),
                    viewTransformPoint.x - (left.value + (width.value * transformOriginX.value))
                );
                const rotationDelta = handleRotation - this.transformStartDimensions.handleToRotationOrigin;

                freeTransformEmitter.emit('setDimensions', {
                    rotation: this.transformStartDimensions.rotation + rotationDelta,
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
            // Drag/Resize
            else {
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
    
                // Determine top/left offset based on width/height change
                let transformOriginXPoint = (this.transformStartDimensions.width * transformOriginX.value);
                let transformOriginYPoint = (this.transformStartDimensions.height * transformOriginY.value);
                const decomposedStartDimensions = decomposeMatrix(
                    new DOMMatrix()
                    .translateSelf(-transformOriginXPoint, -transformOriginYPoint)
                    .translateSelf(left, top)
                    .rotateSelf(rotation.value * Math.RADIANS_TO_DEGREES)
                    .translateSelf(transformOriginXPoint, transformOriginYPoint)
                );
                transformOriginXPoint = (width * transformOriginX.value);
                transformOriginYPoint = (height * transformOriginY.value);
                const decomposedEndDimensions = decomposeMatrix(
                    new DOMMatrix()
                    .translateSelf(-transformOriginXPoint, -transformOriginYPoint)
                    .translateSelf(left, top)
                    .rotateSelf(rotation.value * Math.RADIANS_TO_DEGREES)
                    .translateSelf(transformOriginXPoint, transformOriginYPoint)
                );

                // Apply new dimensions
                freeTransformEmitter.emit('setDimensions', {
                    left: left + decomposedEndDimensions.translateX - decomposedStartDimensions.translateX,
                    top: top + decomposedEndDimensions.translateY - decomposedStartDimensions.translateY,
                    width,
                    height
                });
                for (const [i, layer] of this.selectedLayers.entries()) {
                    const decomposedTransform = decomposeMatrix(this.transformStartLayerData[i].transform);
                    const transform =
                        DOMMatrix.fromMatrix(this.transformStartLayerData[i].transform)
                        .scaleSelf(1 / decomposedTransform.scaleX, 1 / decomposedTransform.scaleY)
                        .rotateSelf(-decomposedTransform.rotation * Math.RADIANS_TO_DEGREES)
                        .translateSelf(left - this.transformStartDimensions.left, top - this.transformStartDimensions.top)
                        .rotateSelf(decomposedTransform.rotation * Math.RADIANS_TO_DEGREES)
                        .scaleSelf(decomposedTransform.scaleX * width / this.transformStartDimensions.width, decomposedTransform.scaleY * height / this.transformStartDimensions.height)
                    layer.transform = transform;
                }
            }

            canvasStore.set('dirty', true);
        }
        if (!this.transformTranslateStart && e.isPrimary && ['mouse', 'pen'].includes(e.pointerType)) {
            const { transformBoundsPoint, viewDecomposedTransform } = this.getTransformedCursorInfo();
            if (this.isPointOnRotateHandle(transformBoundsPoint, viewDecomposedTransform)) {
                this.transformIsRotating = true;
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

    onPointerUp(e: PointerEvent): void {
        super.onPointerUp(e);
        if (e.isPrimary) {
            if (this.transformTranslateStart) {
                width.value = Math.max(1, width.value);
                height.value = Math.max(1, height.value);
                previewXSnap.value = [];
                previewYSnap.value = [];
                this.transformTranslateStart = null;
                this.transformIsRotating = false;

                const updateLayerActions: UpdateLayerAction<UpdateAnyLayerOptions<RGBAColor>>[] = [];
                for (const [i, layer] of this.selectedLayers.entries()) {
                    const newTransform = layer.transform;
                    layer.transform = this.transformStartLayerData[i].transform;
                    updateLayerActions.push(
                        new UpdateLayerAction({
                            id: layer.id,
                            transform: newTransform
                        })
                    );
                }
                historyStore.dispatch('runAction', {
                    action: new BundleAction('freeTransform', 'Free Transform', updateLayerActions)
                });
            }
            dragHandleHighlight.value = null;
        }
    }

    private onHistoryStep() {
        this.setBoundsFromSelectedLayers();
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
        const handleSize = 2 * this.remToPx / viewDecomposedTransform.scaleX * devicePixelRatio;
        const halfHandleSize = handleSize / 2;
        const innerHandleSizeVertical = height.value < 30 ? 0 : halfHandleSize;
        const innerHandleSizeHorizontal = width.value < 30 ? 0 : halfHandleSize;
        if (point.y >= top.value - halfHandleSize && point.y <= top.value + innerHandleSizeVertical) {
            transformDragType |= DRAG_TYPE_TOP;
        }
        if (point.y >= top.value + height.value - innerHandleSizeVertical && point.y <= top.value + height.value + halfHandleSize) {
            transformDragType |= DRAG_TYPE_BOTTOM;
        }
        if (point.x >= left.value - halfHandleSize && point.x <= left.value + innerHandleSizeHorizontal) {
            transformDragType |= DRAG_TYPE_LEFT;
        }
        if (point.x >= left.value + width.value - innerHandleSizeHorizontal && point.x <= left.value + width.value + halfHandleSize) {
            transformDragType |= DRAG_TYPE_RIGHT;
        }
        if (
            point.x < left.value - halfHandleSize ||
            point.x > left.value + width.value + halfHandleSize ||
            point.y < top.value - halfHandleSize ||
            point.y > top.value + height.value + halfHandleSize
        ) {
            transformDragType = null;
        }
        return transformDragType;
    }

    private setBoundsFromSelectedLayers() {
        clearTimeout(this.setBoundsDebounceHandle);
        this.setBoundsDebounceHandle = setTimeout(() => {
            if (this.activeLayer) {
                const originPosX = this.activeLayer.width * transformOriginX.value;
                const originPosY = this.activeLayer.height * transformOriginY.value;
                const decomposedTransform = decomposeMatrix(this.activeLayer.transform);
                const decomposedPositionTransform = decomposeMatrix(
                    DOMMatrix.fromMatrix(this.activeLayer.transform)
                    .translateSelf(originPosX, originPosY)
                    .scaleSelf(1 / decomposedTransform.scaleX, 1 / decomposedTransform.scaleY)
                    .rotateSelf(-decomposedTransform.rotation * Math.RADIANS_TO_DEGREES)
                    .scaleSelf(decomposedTransform.scaleX, decomposedTransform.scaleY)
                    .translateSelf(-originPosX, -originPosY)
                );
                freeTransformEmitter.emit('setDimensions', {
                    left: decomposedPositionTransform.translateX,
                    top: decomposedPositionTransform.translateY,
                    width: this.activeLayer.width * decomposedTransform.scaleX,
                    height: this.activeLayer.height * decomposedTransform.scaleY,
                    rotation: decomposedTransform.rotation
                });
            }
        }, 0);
    }

}
