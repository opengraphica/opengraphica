import { nextTick, watch, WatchStopHandle } from 'vue';
import BaseCanvasMovementController from './base-movement';
import {
    isBoundsIndeterminate, layerPickMode, useRotationSnapping, freeTransformEmitter, top, left, width, height, rotation,
    transformOriginX, transformOriginY, dimensionLockRatio, previewXSnap, previewYSnap, dragHandleHighlight, rotateHandleHighlight, selectedLayers,
    applyTransform, isResizeEnabled, isUnevenScalingEnabled, transformOptions,
} from '../store/free-transform-state';
import {
    appliedSelectionMask, appliedSelectionMaskCanvasOffset, activeSelectionMask, activeSelectionMaskCanvasOffset
} from '../store/selection-state';
import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import historyStore from '@/store/history';
import preferencesStore from '@/store/preferences';
import workingFileStore, { getCanvasRenderingContext2DSettings, getLayerById } from '@/store/working-file';

import { DecomposedMatrix, decomposeMatrix } from '@/lib/dom-matrix';
import { dismissTutorialNotification, scheduleTutorialNotification, waitForNoOverlays } from '@/lib/tutorial';
import { drawWorkingFileToCanvas2d } from '@/lib/canvas';
import { getImageDataFromImage, getImageDataEmptyBounds } from '@/lib/image';
import { isInput } from '@/lib/events';
import appEmitter, { AppEmitterEvents } from '@/lib/emitter';
import { clockwiseAngle2d, pointDistance2d } from '@/lib/math';
import { AsyncCallbackQueue } from '@/lib/timing';
import { textMetaDefaults } from '@/lib/text-common';

import { CreateNewLayersFromSelectionAction } from '@/actions/create-new-layers-from-selection';
import { ClearSelectionAction } from '@/actions/clear-selection';
import { SelectLayersAction } from '@/actions/select-layers';
import { UpdateLayerAction } from '@/actions/update-layer';
import { BundleAction } from '@/actions/bundle';

import { t, tm, rt } from '@/i18n';

import type { PointerTracker } from './base';
import type {
    ColorModel, DrawWorkingFileOptions, UpdateAnyLayerOptions,
    WorkingFileLayer, WorkingFileGradientLayer, WorkingFileTextLayer,
    UpdateTextLayerOptions,
} from '@/types';

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

interface TransformStartLayerData {
    transform: DOMMatrix;
    baseFontSize: number;
    textDocument?: WorkingFileTextLayer['data'];
}

type PointerProcessStep = 'start' | 'move' | 'end' | null;

export default class CanvasFreeTransformController extends BaseCanvasMovementController {

    private remToPx: number = 16;
    private transformTranslateStart: DOMPoint | null = null;
    private transformStartDimensions: TransformInfo = { top: 0, left: 0, width: 0, height: 0, rotation: 0, handleToRotationOrigin: 0 };
    private transformStartLayerData: TransformStartLayerData[] = [];
    private transformStartPickLayer: number | null = null;
    private transformDragType: number = 0;
    private transformIsDragging: boolean = false;
    private transformIsRotating: boolean = false;
    private isPointerDragging: boolean = false;
    private actionQueue: AsyncCallbackQueue = new AsyncCallbackQueue();

    private previewRotation: number | null = null;

    private setBoundsDebounceHandle: number | undefined;
    private selectedLayerIdsWatchStop: WatchStopHandle | null = null;

    onEnter(): void {
        super.onEnter();
        this.remToPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
        dimensionLockRatio.value = null;

        // Set transform bounds based on selected layer list.
        isBoundsIndeterminate.value = true;
        this.selectedLayerIdsWatchStop = watch(() => workingFileStore.state.selectedLayerIds, (selectedLayerIds) => {
            const newSelectedLayers: WorkingFileLayer<ColorModel>[] = [];
            if (selectedLayerIds.length > 0) {
                for (let id of selectedLayerIds) {
                    const layer = getLayerById(id);
                    if (layer && !['group', 'empty'].includes(layer.type)) {
                        newSelectedLayers.push(layer);
                    }
                }
            }
            selectedLayers.value = newSelectedLayers;
            this.setBoundsFromSelectedLayers();
        }, { immediate: true });

        this.onCancelCurrentAction = this.onCancelCurrentAction.bind(this);
        this.onCommitCurrentAction = this.onCommitCurrentAction.bind(this);
        this.onHistoryStep = this.onHistoryStep.bind(this);
        this.onStoreTransformStart = this.onStoreTransformStart.bind(this);
        this.onPreviewRotationChange = this.onPreviewRotationChange.bind(this);
        this.onPreviewDragResizeChange = this.onPreviewDragResizeChange.bind(this);
        this.onCommitTransforms = this.onCommitTransforms.bind(this);
        appEmitter.on('editor.tool.cancelCurrentAction', this.onCancelCurrentAction);
        appEmitter.on('editor.tool.commitCurrentAction', this.onCommitCurrentAction);
        appEmitter.on('editor.history.step', this.onHistoryStep);
        freeTransformEmitter.on('storeTransformStart', this.onStoreTransformStart);
        freeTransformEmitter.on('previewRotationChange', this.onPreviewRotationChange);
        freeTransformEmitter.on('previewDragResizeChange', this.onPreviewDragResizeChange);
        freeTransformEmitter.on('commitTransforms', this.onCommitTransforms);

        // Tutorial message
        if (!editorStore.state.tutorialFlags.freeTransformToolIntroduction) {
            waitForNoOverlays().then(() => {
                let message = (tm('tutorialTip.freeTransformToolIntroduction.introduction') as string[]).map((message) => {
                    return `<p class="mb-3">${rt(message, {
                        autoMode: `<strong class="has-text-weight-bold">${t('tutorialTip.freeTransformToolIntroduction.autoMode')}</strong>`
                    })}</p>`;
                }).join('');
                scheduleTutorialNotification({
                    flag: 'freeTransformToolIntroduction',
                    title: t('tutorialTip.freeTransformToolIntroduction.title'),
                    message: {
                        touch: message + (tm('tutorialTip.freeTransformToolIntroduction.body.touch') as string[]).map((message) => {
                            return `<p class="mb-3">${rt(message, {
                                selection: `<strong class="has-text-weight-bold"><span class="bi bi-cursor"></span> ${t('tutorialTip.freeTransformToolIntroduction.bodyTitle.selection')}</strong>`,
                                moving: `<strong class="has-text-weight-bold"><span class="bi bi-arrows-move"></span> ${t('tutorialTip.freeTransformToolIntroduction.bodyTitle.moving')}</strong>`,
                                resizing: `<strong class="has-text-weight-bold"><span class="bi bi-bounding-box"></span> ${t('tutorialTip.freeTransformToolIntroduction.bodyTitle.resizing')}</strong>`,
                                leftClick: `<em>${t('tutorialTip.freeTransformToolIntroduction.bodyTitle.leftClick')}</em>`,
                            })}</p>`
                        }).join(''),
                        mouse: message + (tm('tutorialTip.freeTransformToolIntroduction.body.mouse') as string[]).map((message) => {
                            return `<p class="mb-3">${rt(message, {
                                selection: `<strong class="has-text-weight-bold"><span class="bi bi-cursor"></span> ${t('tutorialTip.freeTransformToolIntroduction.bodyTitle.selection')}</strong>`,
                                moving: `<strong class="has-text-weight-bold"><span class="bi bi-arrows-move"></span> ${t('tutorialTip.freeTransformToolIntroduction.bodyTitle.moving')}</strong>`,
                                resizing: `<strong class="has-text-weight-bold"><span class="bi bi-bounding-box"></span> ${t('tutorialTip.freeTransformToolIntroduction.bodyTitle.resizing')}</strong>`,
                                leftClick: `<em>${t('tutorialTip.freeTransformToolIntroduction.bodyTitle.leftClick')}</em>`,
                            })}</p>`
                        }).join(''),
                    }
                });
            });
        }
    }

    onLeave(): void {
        if (this.selectedLayerIdsWatchStop) {
            this.selectedLayerIdsWatchStop();
            this.selectedLayerIdsWatchStop = null;
        }
        appEmitter.off('editor.tool.cancelCurrentAction', this.onCancelCurrentAction);
        appEmitter.off('editor.tool.commitCurrentAction', this.onCommitCurrentAction);
        appEmitter.off('editor.history.step', this.onHistoryStep);
        freeTransformEmitter.off('storeTransformStart', this.onStoreTransformStart);
        freeTransformEmitter.off('previewRotationChange', this.onPreviewRotationChange);
        freeTransformEmitter.off('previewDragResizeChange', this.onPreviewDragResizeChange);
        freeTransformEmitter.off('commitTransforms', this.onCommitTransforms);

        // Tutorial Message
        if (!editorStore.state.tutorialFlags.freeTransformToolIntroduction) {
            dismissTutorialNotification('freeTransformToolIntroduction');
        }
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
        if (pointer && e.isPrimary && this.transformTranslateStart) {
            this.onTransformMove(pointer);
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

        this.handleCursorIcon();
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
                if (selectedLayers.value.length > 0) {
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
            this.determineDragRotateType(viewTransformPoint, transformBoundsPoint, viewDecomposedTransform);
    
            // Auto select layer outside drag handles
            if (layerPickMode.value === 'auto') {
                this.transformStartPickLayer = this.pickLayer(viewTransformPoint);
            }
            if (!this.transformTranslateStart && layerPickMode.value === 'auto') {
                const layerId = this.transformStartPickLayer;
                this.transformStartPickLayer = null;
                if (layerId != null && layerId != workingFileStore.get('selectedLayerIds')[0]) {
                    let selectedLayerIds = new Set<number>();

                    // Multiple selection
                    // if (isCtrlOrMetaKeyPressed.value) {
                    //     for (const existingLayerId of workingFileStore.state.selectedLayerIds) {
                    //         selectedLayerIds.add(existingLayerId);
                    //     }
                    // }

                    selectedLayerIds.add(layerId);
                    await historyStore.dispatch('runAction', {
                        action: new SelectLayersAction(Array.from(selectedLayerIds)),
                        mergeWithHistory: 'selectLayers',
                    });
                    await nextTick();
                    this.setBoundsFromSelectedLayersImmediate();
                    this.determineDragRotateType(viewTransformPoint, transformBoundsPoint, viewDecomposedTransform);
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

    onTransformMove(pointer: PointerTracker) {
        if (!this.transformTranslateStart) return;

        const { viewTransformPoint } = this.getTransformedCursorInfo();
        const { shouldMaintainAspectRatio, shouldScaleDuringResize, shouldSnapRotationDegrees } = transformOptions.value;

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
            // @ts-ignore 2365
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
                                action: new SelectLayersAction([layerId]),
                                mergeWithHistory: 'selectLayers',
                            });
                        }
                    }
                } catch (error) { /* Ignore */ }
                this.transformStartPickLayer = null;
            }
            this.previewRotation = null;
            dragHandleHighlight.value = null;
            this.handleCursorIcon();
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

    private onCommitCurrentAction() {
        if (!this.transformIsRotating && !this.transformIsDragging) {
            applyTransform();
        }
    }

    private onHistoryStep(event?: AppEmitterEvents['editor.history.step']) {
        if (
            event?.trigger != 'do' ||
            [
                'applyLayerTransform', 'trimLayerEmptySpace', 'setLayerBoundsToWorkingFileBounds', 'convertLayersToCollage'
            ].includes(event?.action.id)
        ) {
            isBoundsIndeterminate.value = true;
            this.setBoundsFromSelectedLayers();
        }
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

        for (let layer of selectedLayers.value) {
            let baseFontSize = 0;
            let textDocument: WorkingFileTextLayer['data'] | undefined;
            if (layer.type === 'text') {
                baseFontSize = (layer as WorkingFileTextLayer).data.lines?.[0].spans?.[0].meta.size ?? textMetaDefaults.size;
                textDocument = (layer as WorkingFileTextLayer).data;
                // TODO - maybe can detect if the user is attempting to scale the layer and not create a clone
                // here because it is not necessary. But that doesn't seem simple to detect right here.
                (layer as WorkingFileTextLayer).data = JSON.parse(JSON.stringify((layer as WorkingFileTextLayer).data));
            }
            this.transformStartLayerData.push({
                transform: layer.transform,
                baseFontSize,
                textDocument,
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
        this.previewRotation = newRotation;
        const rotationDelta = newRotation - this.transformStartDimensions.rotation;
        freeTransformEmitter.emit('setDimensions', {
            rotation: newRotation,
            transformOriginX: transformOriginX.value,
            transformOriginY: transformOriginY.value
        });
        for (const [i, layer] of selectedLayers.value.entries()) {
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
            shouldScaleDuringResize = transformOptions.value.shouldScaleDuringResize;
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

        // Apply the transform offset to the layer dragging bounds overlay
        freeTransformEmitter.emit('setDimensions', {
            left: newTransform.left + decomposedEndDimensions.translateX - decomposedStartDimensions.translateX,
            top: newTransform.top + decomposedEndDimensions.translateY - decomposedStartDimensions.translateY,
            width: newTransform.width,
            height: newTransform.height
        });
        // Apply the transform offset to each layer
        for (const [i, layer] of selectedLayers.value.entries()) {
            const decomposedTransform = decomposeMatrix(this.transformStartLayerData[i].transform);
            let transform = DOMMatrix.fromMatrix(this.transformStartLayerData[i].transform)
            let rotationOffset = 0;
            let transformStartOriginX = 0;
            let transformStartOriginY = 0;
            let transformEndOriginX = 0;
            let transformEndOriginY = 0;
            if (layer.type === 'gradient') {
                const startHandle = (layer as WorkingFileGradientLayer).data.start;
                const endHandle = (layer as WorkingFileGradientLayer).data.end;
                const handleSize = pointDistance2d(startHandle.x, startHandle.y, endHandle.x, endHandle.y);
                rotationOffset = clockwiseAngle2d(startHandle.x, startHandle.y, endHandle.x, endHandle.y);
                let startOrigin: DOMPoint;
                let endOrigin: DOMPoint;
                const startScale = decomposedTransform.scaleX;
                const endScaleX = (decomposedTransform.scaleX * newTransform.width / this.transformStartDimensions.width);
                const endScaleY = (decomposedTransform.scaleY * newTransform.height / this.transformStartDimensions.height);
                switch ((layer as WorkingFileGradientLayer).data.fillType) {
                    case 'radial':
                        startOrigin = new DOMPoint().matrixTransform(
                            new DOMMatrix()
                                .rotate((decomposedTransform.rotation) * Math.RADIANS_TO_DEGREES)
                                .translate(-startHandle.x * startScale, -startHandle.y * startScale)
                                .rotate((rotationOffset) * Math.RADIANS_TO_DEGREES)
                                .translate(handleSize * startScale, handleSize * startScale)
                                .rotate((decomposedTransform.rotation + rotationOffset) * Math.RADIANS_TO_DEGREES)
                        );
                        endOrigin = new DOMPoint().matrixTransform(
                            new DOMMatrix()
                                .rotate((decomposedTransform.rotation) * Math.RADIANS_TO_DEGREES)
                                .translate(-startHandle.x * endScaleX, -startHandle.y * endScaleY)
                                .rotate((rotationOffset) * Math.RADIANS_TO_DEGREES)
                                .translate(handleSize * endScaleX, handleSize * endScaleY)
                                .rotate((decomposedTransform.rotation + rotationOffset) * Math.RADIANS_TO_DEGREES)
                        );
                        transformStartOriginX = startOrigin.x;
                        transformStartOriginY = startOrigin.y;
                        transformEndOriginX = endOrigin.x;
                        transformEndOriginY = endOrigin.y;
                        break;
                    case 'linear':
                        startOrigin = new DOMPoint().matrixTransform(
                            new DOMMatrix()
                                .rotate((decomposedTransform.rotation) * Math.RADIANS_TO_DEGREES)
                                .translate(-startHandle.x * startScale, -startHandle.y * startScale)
                                .rotate((rotationOffset) * Math.RADIANS_TO_DEGREES)
                                .translate(0 * startScale, handleSize * startScale)
                                .rotate((decomposedTransform.rotation + rotationOffset) * Math.RADIANS_TO_DEGREES)
                        );
                        endOrigin = new DOMPoint().matrixTransform(
                            new DOMMatrix()
                                .rotate((decomposedTransform.rotation) * Math.RADIANS_TO_DEGREES)
                                .translate(-startHandle.x * endScaleX, -startHandle.y * endScaleY)
                                .rotate((rotationOffset) * Math.RADIANS_TO_DEGREES)
                                .translate(0 * endScaleX, handleSize * endScaleY)
                                .rotate((decomposedTransform.rotation + rotationOffset) * Math.RADIANS_TO_DEGREES)
                        );
                        transformStartOriginX = startOrigin.x;
                        transformStartOriginY = startOrigin.y;
                        transformEndOriginX = endOrigin.x;
                        transformEndOriginY = endOrigin.y;
                        break;
                }
            } else if (layer.type === 'text') {
                const textDocument = (layer as WorkingFileTextLayer).data;
                const currentScaleRatio = (
                    (textDocument.lines?.[0].spans?.[0].meta.size ?? textMetaDefaults.size) /
                    this.transformStartLayerData[i].baseFontSize
                );
                const newScaleRatio = decomposedTransform.scaleX * newTransform.width / this.transformStartDimensions.width;
                for (const line of textDocument.lines) {
                    for (const span of line.spans) {
                        const newFontSize = ((span.meta.size ?? textMetaDefaults.size) / currentScaleRatio) * newScaleRatio;
                        span.meta.size = newFontSize;
                    }
                }
            }
            if (shouldScaleDuringResize) {
                transform.scaleSelf(1 / decomposedTransform.scaleX, 1 / decomposedTransform.scaleY);
            }
            transform
                .rotateSelf(-(decomposedTransform.rotation) * Math.RADIANS_TO_DEGREES)
                .translateSelf(
                    (newTransform.left + transformEndOriginX) - (this.transformStartDimensions.left + transformStartOriginX),
                    (newTransform.top + transformEndOriginY) - (this.transformStartDimensions.top + transformStartOriginY)
                )
                .rotateSelf((decomposedTransform.rotation) * Math.RADIANS_TO_DEGREES)
            if (shouldScaleDuringResize) {
                transform.scaleSelf(
                    decomposedTransform.scaleX * newTransform.width / this.transformStartDimensions.width,
                    decomposedTransform.scaleY * newTransform.height / this.transformStartDimensions.height
                )
            }
            layer.transform = transform;
        }
    }

    private async commitTransforms() {
        try {
            let { shouldScaleDuringResize } = transformOptions.value;
            width.value = Math.max(1, width.value);
            height.value = Math.max(1, height.value);
            previewXSnap.value = [];
            previewYSnap.value = [];

            const isTranslate = left.value != this.transformStartDimensions.left || top.value != this.transformStartDimensions.top;
            const isScale = width.value != this.transformStartDimensions.width || height.value != this.transformStartDimensions.height;
            const isRotate = rotation.value != this.transformStartDimensions.rotation;

            if (isTranslate || isScale || isRotate) {
                const updateLayerActions: UpdateLayerAction<UpdateAnyLayerOptions<ColorModel>>[] = [];
                for (const [i, layer] of selectedLayers.value.entries()) {
                    const updateLayerOptions: UpdateAnyLayerOptions = {
                        id: layer.id,
                        transform: layer.transform,
                    };
                    const revertLayerOptions: Partial<UpdateAnyLayerOptions> = {
                        transform: this.transformStartLayerData[i].transform,
                    };
                    if (!shouldScaleDuringResize && !isResizeEnabled.value) {
                        updateLayerOptions.width = width.value;
                        updateLayerOptions.height = height.value;
                    }
                    if (this.transformStartLayerData[i].textDocument) {
                        (updateLayerOptions as UpdateTextLayerOptions).data = (layer as WorkingFileTextLayer).data;
                        (revertLayerOptions as Partial<UpdateTextLayerOptions>).data = this.transformStartLayerData[i].textDocument;
                    }
                    updateLayerActions.push(
                        new UpdateLayerAction(updateLayerOptions, revertLayerOptions)
                    );
                }
                await historyStore.dispatch('runAction', {
                    action: new BundleAction('freeTransform', [
                        ...(isRotate ? ['action.freeTransformRotate'] : []),
                        ...(isScale ? ['action.freeTransformScale'] : []),
                        ...(isTranslate ? ['action.freeTransformTranslate'] : [])
                    ][0], updateLayerActions)
                });
            }
        } catch (error) {
            console.error('[src/canvas/controllers/free-transform.ts] Error while committing transform action. ', error);
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
        const ctx = workingCanvas.getContext('2d', getCanvasRenderingContext2DSettings());
        if (!ctx) return null;
        const initialTransform = new DOMMatrix().translateSelf(-viewTransformPoint.x, -viewTransformPoint.y);
        const selectionTest: DrawWorkingFileOptions['selectionTest'] = {
            point: new DOMPoint(),
            resultId: undefined,
            resultPixelTest: undefined
        };
        drawWorkingFileToCanvas2d(workingCanvas, ctx, { initialTransform, selectionTest });
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
        if (isResizeEnabled.value) {
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
                !isUnevenScalingEnabled.value && 
                (
                    transformDragType == DRAG_TYPE_TOP ||
                    transformDragType == DRAG_TYPE_BOTTOM ||
                    transformDragType == DRAG_TYPE_LEFT ||
                    transformDragType == DRAG_TYPE_RIGHT
                )
            ) {
                transformDragType = 0;
            }
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
        isBoundsIndeterminate.value = false;

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
        else if (selectedLayers.value.length === 1) {
            const activeLayer = selectedLayers.value[0];
            if (activeLayer.type === 'gradient') {
                const startHandle = (activeLayer as WorkingFileGradientLayer).data.start;
                const endHandle = (activeLayer as WorkingFileGradientLayer).data.end;
                const handleSize = pointDistance2d(startHandle.x, startHandle.y, endHandle.x, endHandle.y);
                const handleAngle = clockwiseAngle2d(startHandle.x, startHandle.y, endHandle.x, endHandle.y);
                let boxSize = handleSize;
                let boxCenter!: DOMPoint;
                let topLeftOffset = 0;
                switch ((activeLayer as WorkingFileGradientLayer).data.fillType) {
                    case 'linear':
                        boxCenter = new DOMPoint(
                            (startHandle.x + endHandle.x) / 2,
                            (startHandle.y + endHandle.y) / 2
                        )
                        topLeftOffset = -handleSize / 2;
                        break;
                    case 'radial':
                        boxCenter = new DOMPoint(startHandle.x, startHandle.y);
                        boxSize = handleSize * 2;
                        topLeftOffset = -handleSize;
                        break;
                }
                const decomposedTransform = decomposeMatrix(activeLayer.transform);
                const topLeft = boxCenter.matrixTransform(
                    activeLayer.transform
                ).matrixTransform(
                    new DOMMatrix().translate(topLeftOffset * decomposedTransform.scaleX, topLeftOffset * decomposedTransform.scaleX)
                )
                freeTransformEmitter.emit('setDimensions', {
                    left: topLeft.x,
                    top: topLeft.y,
                    width: boxSize * decomposedTransform.scaleX,
                    height: boxSize * decomposedTransform.scaleX,
                    rotation: decomposedTransform.rotation + handleAngle,
                });
            } else {
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
    }

    protected handleCursorIcon() {
        let newIcon = super.handleCursorIcon();
        if (!newIcon && workingFileStore.state.selectedLayerIds.length > 0) {
            const decomposedViewTransform = canvasStore.get('decomposedTransform');
            const dragHandle = dragHandleHighlight.value;
            determineResizeHandleIcon:
            if (dragHandle != null) {
                let handleRotation = 0;
                if (dragHandle === DRAG_TYPE_RIGHT) handleRotation = 0;
                else if (dragHandle === (DRAG_TYPE_BOTTOM | DRAG_TYPE_RIGHT)) handleRotation = Math.PI / 4;
                else if (dragHandle === DRAG_TYPE_BOTTOM) handleRotation = Math.PI / 2;
                else if (dragHandle === (DRAG_TYPE_BOTTOM | DRAG_TYPE_LEFT)) handleRotation = 3 * Math.PI / 4;
                else if (dragHandle === DRAG_TYPE_LEFT) handleRotation = Math.PI;
                else if (dragHandle === (DRAG_TYPE_TOP | DRAG_TYPE_LEFT)) handleRotation = 5 * Math.PI / 4;
                else if (dragHandle === DRAG_TYPE_TOP) handleRotation = 3 * Math.PI / 2;
                else if (dragHandle === (DRAG_TYPE_TOP | DRAG_TYPE_RIGHT)) handleRotation = 7 * Math.PI / 4;
                else {
                    newIcon = 'move';
                    break determineResizeHandleIcon;
                }
                handleRotation += this.previewRotation ?? rotation.value;
                handleRotation += decomposedViewTransform.rotation;
                if (handleRotation > 0) handleRotation = (2 * Math.PI) - (handleRotation % (2 * Math.PI));
                else handleRotation = Math.abs(handleRotation % (2 * Math.PI));
                if (handleRotation < Math.PI / 6 || handleRotation > 11 * Math.PI / 6) newIcon = 'ew-resize';
                else if (handleRotation < Math.PI / 3) newIcon = 'nesw-resize';
                else if (handleRotation < 2 * Math.PI / 3) newIcon = 'ns-resize';
                else if (handleRotation < 5 * Math.PI / 6) newIcon = 'nwse-resize';
                else if (handleRotation < 7 * Math.PI / 6) newIcon = 'ew-resize';
                else if (handleRotation < 4 * Math.PI / 3) newIcon = 'nesw-resize';
                else if (handleRotation < 5 * Math.PI / 3) newIcon = 'ns-resize';
                else newIcon = 'nwse-resize';
            }
            const rotateHandle = rotateHandleHighlight.value;
            if (rotateHandle === true) {
                let handleRotation = 0;
                handleRotation += this.previewRotation ?? rotation.value;
                handleRotation += decomposedViewTransform.rotation;
                if (handleRotation > 0) handleRotation = (2 * Math.PI) - (handleRotation % (2 * Math.PI));
                else handleRotation = Math.abs(handleRotation % (2 * Math.PI));
                if (handleRotation < Math.PI / 6 || handleRotation > 11 * Math.PI / 6) newIcon = 'ew-resize';
                else if (handleRotation < Math.PI / 3) newIcon = 'nesw-resize';
                else if (handleRotation < 2 * Math.PI / 3) newIcon = 'ns-resize';
                else if (handleRotation < 5 * Math.PI / 6) newIcon = 'nwse-resize';
                else if (handleRotation < 7 * Math.PI / 6) newIcon = 'ew-resize';
                else if (handleRotation < 4 * Math.PI / 3) newIcon = 'nesw-resize';
                else if (handleRotation < 5 * Math.PI / 3) newIcon = 'ns-resize';
                else newIcon = 'nwse-resize';
            }
        }
        canvasStore.set('cursor', newIcon);
        return newIcon;
    }

}
