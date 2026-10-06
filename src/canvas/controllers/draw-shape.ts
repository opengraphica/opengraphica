import { nextTick, watch, WatchStopHandle } from 'vue';

import { type PointerTracker } from './base';
import BaseCanvasMovementController from './base-movement';
import {
    cursorHoverPosition, previewInvisibleStrokeStart,
    drawShapeToolbarEmitter, pixelSnap, isExtendingPaths,
    fillColor, strokeColor, strokeWidth, selectedShapeType,
    editControlPoints, editControlPointsDirty, hoveringEditControlPointIndices,
    selectedEditControlPointIndices, selectedEditControlAttachPointIndices,
    selectedShapes,
    snapLineX, snapLineY, useSnapping, useCanvasEdgeSnapping, useControlPointSnapping,
    transformBoundsTop, transformBoundsLeft, transformBoundsWidth, transformBoundsHeight,
    transformBoundsRotation, transformOriginX, transformOriginY,
    transformDragHandleHighlight, transformRotateHandleHighlight, transformOptions,
    isTransformBoundsTransparent, rotationSnappingDegrees,
    editControlPointNodes, renderControlPointAttributeEdits, editControlPointNodeParsedAttributes,
    editingLayers, hasVisibleToolbarOverlay, showShapeDrawer,
    type ControlPointAttributeEdit,
} from '@/canvas/store/draw-shape-state';

import { hexToColor } from '@/lib/color';
import { decomposeMatrix, type DecomposedMatrix } from '@/lib/dom-matrix';
import appEmitter, { type AppEmitterEvents } from '@/lib/emitter';
import { isEqualApprox, pointDistance2d } from '@/lib/math';
import { calculateShapeAabb, getViewBox, generateSvgElementIds, parseNodeTransform, serializeVectorPathCommands, parseCommonNodeAttributes } from '@/lib/svg';
import { AsyncCallbackQueue } from '@/lib/timing';
import { dismissTutorialNotification, scheduleTutorialNotification, waitForNoOverlays } from '@/lib/tutorial';
import { t, tm, rt } from '@/i18n';

import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import historyStore, {
    createHistoryReserveToken, historyBlockInteractionUntilComplete, historyReserveQueueFree,
} from '@/store/history';
import preferencesStore from '@/store/preferences';
import { createStoredSvg, getStoredSvgDocument } from '@/store/svg';
import workingFileStore, { getSelectedLayers, ensureUniqueLayerSiblingName, visibleLayerIds, getLayerById } from '@/store/working-file';

import type { BaseAction } from '@/actions/base';
import { BundleAction } from '@/actions/bundle';
import { InsertLayerAction } from '@/actions/insert-layer';
import { TrimLayerEmptySpaceAction } from '@/actions/trim-layer-empty-space';
import { UpdateLayerAction } from '@/actions/update-layer';
import { UpdateVectorLayerAttributesAction } from '@/actions/update-vector-layer-attributes';

import { useRenderer } from '@/renderers';

import {
    type RendererFrontend, type RGBAColor,
    type WorkingFileVectorLayer,
    type InsertVectorLayerOptions, type UpdateVectorLayerOptions,
    type VectorPathCommand,
    VectorPathCommandType,
} from '@/types';

const EPSILON = 1e-6;
const DRAG_TYPE_ALL = 0;
const DRAG_TYPE_TOP = 1;
const DRAG_TYPE_BOTTOM = 2;
const DRAG_TYPE_LEFT = 4;
const DRAG_TYPE_RIGHT = 8;
const devicePixelRatio = window.devicePixelRatio || 1;

interface DrawingShape {
    layer: WorkingFileVectorLayer;
    nodeXf: DOMMatrix;
    element: Element;
}

interface ExtendPathInfo {
    layerId: number;
    tagName: string;
    nodeId: string;
    nodeXf: DOMMatrix;
    pathStart: string;
}

interface CopiedShape {
    tagName: string;
    attributes: Record<string, string>;
    transform: DOMMatrix;
}

interface SnapPointGroup {
    value: number;
    points: Int32Array;
}

interface DragResizeTransformShapeInfo {
    top: number;
    left: number;
    width: number;
    height: number;
}

interface TransformShapeInfo extends DragResizeTransformShapeInfo {
    rotation: number;
    handleToRotationOrigin: number;
}

interface TransformShapeLayerData {
    shapeBounds: DOMRect;
    shapeTransform: DOMMatrix;
    parentTransform: DOMMatrix;
    newShapeTransform: DOMMatrix;
}

export default class CanvasDrawShapetController extends BaseCanvasMovementController {

    private selectedLayerIdsUnwatch: WatchStopHandle | null = null;

    private renderer: RendererFrontend | null = null;

    private selectedLayers: WorkingFileVectorLayer[] = [];
    
    private dragHandleRadius: number = 6;
    private dragHandleRadiusTouch: number = 10;
    private dragControlPointPointerId: number | null = null;
    private dragStartPoint: DOMPoint = new DOMPoint();
    private draggingEditControlPointIndices: number[] = [];
    private pendingControlPointEdits: ControlPointAttributeEdit[] = [];

    private drawingPointerId: number | null = null;
    private drawingShapes: DrawingShape[] = [];
    private drawingJustCreatedShapeLayer: boolean = false;
    private actionQueue: AsyncCallbackQueue = new AsyncCallbackQueue();

    private extendPathPointerId: number | null = null;
    private extendPathInfo: ExtendPathInfo[] = [];

    private uselessClickCount: number = 0;
    private hasUncroppedChanges: boolean = false;

    private copiedShapes: CopiedShape[] = [];
    private currentCopiedShapesPasteCount: number = 0;

    private snapPointsNeedToBeCalculated: boolean = true;
    private snapXPoints: SnapPointGroup[] = [];
    private snapYPoints: SnapPointGroup[] = [];
    private snapSensitivity: number = 0;

    private previewTransformRotation: number | null = null;
    private remToPx: number = 16;
    private isTransformShapesDragging: boolean = false;
    private transformShapeTranslateStart: DOMPoint | null = null;
    private transformShapeStartDimensions: TransformShapeInfo = { top: 0, left: 0, width: 0, height: 0, rotation: 0, handleToRotationOrigin: 0 };
    private transformShapeLayerData: TransformShapeLayerData[] = [];
    private transformShapeIsRotating: boolean = false;
    private transformShapeIsDragging: boolean = false;
    private transformShapeDragType: number = 0;
    private setTransformBoundsDebounceHandle: number | undefined = undefined;

    /*---------------------*\
    |                       |
    |   Tool Entry / Exit   |
    |                       |
    \*---------------------*/

    onEnter(): void {
        super.onEnter();

        this.hasUncroppedChanges = false;

        useRenderer().then((renderer) => {
            this.renderer = renderer;
        });

        this.createEditingLayersFromSelectedLayers = this.createEditingLayersFromSelectedLayers.bind(this);
        this.selectedLayerIdsUnwatch = watch(
            () => workingFileStore.state.selectedLayerIds,
            this.createEditingLayersFromSelectedLayers
        );
        editingLayers.value = [];
        // Force re-generation of control points on tool entry. Not doing this causes major bugs.
        this.createEditingLayersFromSelectedLayers(workingFileStore.state.selectedLayerIds);

        this.onFillColorChanged = this.onFillColorChanged.bind(this);
        drawShapeToolbarEmitter.on('fillColorChanged', this.onFillColorChanged);
        this.onStrokeColorChanged = this.onStrokeColorChanged.bind(this);
        drawShapeToolbarEmitter.on('strokeColorChanged', this.onStrokeColorChanged);
        this.onStrokeWidthPreview = this.onStrokeWidthPreview.bind(this);
        drawShapeToolbarEmitter.on('strokeWidthPreview', this.onStrokeWidthPreview);
        this.onStrokeWidthChanged = this.onStrokeWidthChanged.bind(this);
        drawShapeToolbarEmitter.on('strokeWidthChanged', this.onStrokeWidthChanged);

        this.onHistoryStep = this.onHistoryStep.bind(this);
        appEmitter.on('editor.history.step', this.onHistoryStep);
        this.onCancelCurrentAction = this.onCancelCurrentAction.bind(this);
        appEmitter.on('editor.tool.cancelCurrentAction', this.onCancelCurrentAction);
        this.onCommitCurrentAction = this.onCommitCurrentAction.bind(this);
        appEmitter.on('editor.tool.commitCurrentAction', this.onCommitCurrentAction);
        this.onDelete = this.onDelete.bind(this);
        appEmitter.on('editor.tool.delete', this.onDelete);
        this.onCopy = this.onCopy.bind(this);
        appEmitter.on('editor.tool.copySelectedLayers', this.onCopy);
        this.onCut = this.onCut.bind(this);
        appEmitter.on('editor.tool.cutSelectedLayers', this.onCut);
        this.onPaste = this.onPaste.bind(this);
        appEmitter.on('editor.tool.paste', this.onPaste);

        cursorHoverPosition.value = new DOMPoint(
            -100000000000,
            -100000000000,
        );

        // Tutorial message
        if (!editorStore.state.tutorialFlags.drawShapeToolIntroduction) {
            waitForNoOverlays().then(() => {
                let message = (tm('tutorialTip.drawShapeToolIntroduction.introduction') as string[]).map((message) => {
                    return `<p class="mb-3!">${rt(message)}</p>`;
                }).join('');
                scheduleTutorialNotification({
                    flag: 'drawShapeToolIntroduction',
                    title: t('tutorialTip.drawShapeToolIntroduction.title'),
                    message: {
                        touch: message + (tm('tutorialTip.drawShapeToolIntroduction.body.touch') as string[]).map((message) => {
                            return `<p class="mb-3!">${rt(message, {
                                add: `<strong class="font-bold"><span class="bi bi-plus-circle"></span> ${t('tutorialTip.drawShapeToolIntroduction.bodyTitle.add')}</strong>`,
                                edit: `<strong class="font-bold"><span class="bi bi-pencil-square"></span> ${t('tutorialTip.drawShapeToolIntroduction.bodyTitle.edit')}</strong>`,
                            })}</p>`
                        }).join(''),
                        mouse: message + (tm('tutorialTip.drawShapeToolIntroduction.body.mouse') as string[]).map((message) => {
                            return `<p class="mb-3!">${rt(message, {
                                add: `<strong class="font-bold"><span class="bi bi-plus-circle"></span> ${t('tutorialTip.drawShapeToolIntroduction.bodyTitle.add')}</strong>`,
                                edit: `<strong class="font-bold"><span class="bi bi-pencil-square"></span> ${t('tutorialTip.drawShapeToolIntroduction.bodyTitle.edit')}</strong>`,
                            })}</p>`
                        }).join(''),
                    }
                });
            });
        }
    }

    onLeave(): void {
        super.onLeave();

        this.autoCrop();

        for (const layer of getSelectedLayers<WorkingFileVectorLayer>(workingFileStore.state.selectedLayerIds)) {
            if (layer.type === 'vector') {
                delete layer.data.sourceDocument;
            }
        }

        showShapeDrawer.value = false;
        this.selectedLayerIdsUnwatch?.();
        this.selectedLayerIdsUnwatch = null;

        drawShapeToolbarEmitter.off('fillColorChanged', this.onFillColorChanged);
        drawShapeToolbarEmitter.off('strokeColorChanged', this.onStrokeColorChanged);
        drawShapeToolbarEmitter.off('strokeWidthPreview', this.onStrokeWidthPreview);
        drawShapeToolbarEmitter.off('strokeWidthChanged', this.onStrokeWidthChanged);

        appEmitter.off('editor.history.step', this.onHistoryStep);
        appEmitter.off('editor.tool.cancelCurrentAction', this.onCancelCurrentAction);
        appEmitter.off('editor.tool.commitCurrentAction', this.onCommitCurrentAction);
        appEmitter.off('editor.tool.delete', this.onDelete);
        appEmitter.off('editor.tool.copySelectedLayers', this.onCopy);
        appEmitter.off('editor.tool.cutSelectedLayers', this.onCut);
        appEmitter.off('editor.tool.paste', this.onPaste);

        // Tutorial Message
        if (!editorStore.state.tutorialFlags.drawShapeToolIntroduction) {
            dismissTutorialNotification('drawShapeToolIntroduction');
        }

        // Block UI changes until history actions have completed
        historyBlockInteractionUntilComplete();
    }

    /*-----------------------*\
    |                         |
    |   Handle Input Events   |
    |                         |
    \*-----------------------*/

    onPointerDown(e: PointerEvent) {
        super.onPointerDown(e);

        if (!canvasStore.get('ready')) return;

        previewInvisibleStrokeStart.value = null;

        if (hasVisibleToolbarOverlay.value) {
            showShapeDrawer.value = false;
            return;
        }

        if ((e.pointerType === 'pen' || (e.pointerType === 'mouse' && !editorStore.state.isPenUser))) {
            cursorHoverPosition.value = new DOMPoint(
                this.lastCursorX * devicePixelRatio,
                this.lastCursorY * devicePixelRatio
            ).matrixTransform(canvasStore.state.transform.inverse());
        }

        const pointer = this.pointers.filter((pointer) => pointer.id === e.pointerId)[0];
        if (pointer && pointer.down.isPrimary && pointer.type !== 'touch' && pointer.down.button === 0) {
            this.onPointerOrTouchDown(pointer);
        }
    }

    onMultiTouchDown() {
        super.onMultiTouchDown();

        if (!canvasStore.get('ready')) return;

        if (this.touches.length === 1) {
            if (this.touches[0].down.isPrimary && this.touches[0].down.button === 0) {
                this.onPointerOrTouchDown(this.touches[0]);
            }
        }
    }

    onPointerOrTouchDown(pointer: PointerTracker) {
        const editControlPointIndices = this.getEditControlPointIndicesAtPagePoint(pointer.down.pageX, pointer.down.pageY);
        if (editControlPointIndices.length === 0) {
            if (this.isReadyForPathExtension()) {
                isExtendingPaths.value = true;
                this.extendPathStart(pointer);
            } else {
                isExtendingPaths.value = false;
                selectedEditControlPointIndices.value = [];
                selectedEditControlAttachPointIndices.value = [];
                const { viewTransformPoint, transformBoundsPoint, viewDecomposedTransform } = this.getTransformedCursorInfo();
                this.dragStartPoint = viewTransformPoint;

                if (this.isPointOnRotateHandle(transformBoundsPoint, viewDecomposedTransform)) {
                    transformRotateHandleHighlight.value = true;
                    transformDragHandleHighlight.value = null;
                } else {
                    transformRotateHandleHighlight.value = false;
                    if (selectedShapes.value.length > 0) {
                        let transformDragType = this.getTransformDragType(transformBoundsPoint, viewDecomposedTransform);
                        if (transformDragType != null) {
                            transformDragHandleHighlight.value = transformDragType;
                        } else {
                            transformDragHandleHighlight.value = null;
                        }
                    }
                }
                if (transformRotateHandleHighlight.value == false && transformDragHandleHighlight.value == null) {
                    selectedShapes.value = [];
                } else {
                    this.transformShapesStart();
                }
            }
        } else {
            selectedEditControlPointIndices.value = editControlPointIndices;
            isExtendingPaths.value = this.isReadyForPathExtension();
            this.dragEditControlPointStart(pointer);
        }
    }

    onPointerMove(e: PointerEvent): void {
        super.onPointerMove(e);

        if (e.pointerType === 'touch' && this.multiTouchDownCount !== 1) {
            cursorHoverPosition.value = new DOMPoint(
                -100000000000,
                -100000000000,
            );
        } else if (e.pointerType === 'pen' || !editorStore.state.isPenUser) {
            cursorHoverPosition.value = new DOMPoint(
                this.lastCursorX * devicePixelRatio,
                this.lastCursorY * devicePixelRatio
            ).matrixTransform(canvasStore.state.transform.inverse());
        }

        if (
            e.isPrimary && (e.type !== 'touch' || this.multiTouchDownCount === 1)
        ) {
            const pointer = this.pointers.filter((pointer) => pointer.id === e.pointerId)[0];

            if (pointer && (pointer.type !== 'touch' || this.multiTouchDownCount === 1) && pointer.down.button === 0 && pointer.isDragging) {
                if (this.dragControlPointPointerId != null && this.draggingEditControlPointIndices.length > 0) {
                    this.dragEditControlPointMove(pointer);
                } else if (this.extendPathPointerId != null) {
                    this.extendPathMove(pointer);
                } else if (selectedShapes.value.length > 0 && (this.transformShapeIsDragging || this.transformShapeIsRotating)) {
                    this.transformShapesMove(pointer);
                } else {
                    this.drawShapeMove(pointer);
                }
            } else {
                if (editControlPoints.value.length > 0) {
                    hoveringEditControlPointIndices.value = this.getEditControlPointIndicesAtPagePoint(e.pageX, e.pageY, undefined, true);
                } else {
                    hoveringEditControlPointIndices.value = [];
                }

                if (selectedShapes.value.length > 0) {
                    const { transformBoundsPoint, viewDecomposedTransform } = this.getTransformedCursorInfo();
                    if (this.isPointOnRotateHandle(transformBoundsPoint, viewDecomposedTransform)) {
                        transformRotateHandleHighlight.value = true;
                        transformDragHandleHighlight.value = null;
                    } else {
                        transformRotateHandleHighlight.value = false;
                        let transformDragType = this.getTransformDragType(transformBoundsPoint, viewDecomposedTransform);
                        if (transformDragType != null) {
                            transformDragHandleHighlight.value = transformDragType;
                        } else {
                            transformDragHandleHighlight.value = null;
                        }
                    }
                }
            }

            this.handleCursorIcon();
        }
    }

    onMultiTouchUp(): void {
        super.onMultiTouchUp();
        if (this.multiTouchDownCount != 1) return;
        const pointer = this.multiTouchDownTouches[0];
        this.onPointerOrTouchEnd(pointer);

        cursorHoverPosition.value = new DOMPoint(
            -100000000000,
            -100000000000,
        );
    }

    onPointerOrTouchEnd(e: PointerTracker) {
        if (this.isTransformShapesDragging) {
            this.transformShapesEnd();
        } else if (this.extendPathPointerId != null && this.extendPathPointerId == e.down.pointerId && isExtendingPaths.value) {
            this.extendPathEnd();
        } else if (this.drawingPointerId != null && this.drawingPointerId == e.down.pointerId) {
            this.drawShapeEnd();
        } else if (this.dragControlPointPointerId != null && this.draggingEditControlPointIndices.length > 0) {
            if (e.isDragging) {
                this.dragEditControlPointEnd();
            }
            this.dragControlPointPointerId = null;
            this.draggingEditControlPointIndices = [];
        } else if (this.pointers.length === 1 && e.down.isPrimary && e.down.button === 0) {
            const beforeSelection = selectedShapes.value.slice();

            if (!e.isDragging) {
                this.selectShapes(e);
            }

            let hasShapeSelectionChanged = false;
            if (beforeSelection.length !== selectedShapes.value.length) {
                hasShapeSelectionChanged = true;
            } else {
                for (let i = 0; i < selectedShapes.value.length; i++) {
                    if (
                        beforeSelection[i][0] !== selectedShapes.value[i][0]
                        || beforeSelection[i][1] !== selectedShapes.value[i][1]
                    ) {
                        hasShapeSelectionChanged = true;
                        break;
                    }
                }
            }

            if (!hasShapeSelectionChanged) {
                this.uselessClickCount++;
            }
        }

        if (this.pointers.length === 1 && this.uselessClickCount >= 3) {
            this.uselessClickCount = 0;
            appEmitter.emit('app.notify', {
                type: 'info',
                title: t('toolbar.drawShape.notification.uselessClick.title'),
                message: t('toolbar.drawShape.notification.uselessClick.message.' + (editorStore.get('isTouchUser') ? 'touch' : 'mouse')),
                duration: 5000,
            });
        }
    }

    async onPointerUpBeforePurge(e: PointerEvent): Promise<void> {
        super.onPointerUpBeforePurge(e);
        const pointer = this.pointers.filter((pointer) => pointer.id === e.pointerId)[0];
        if (pointer == null || pointer.type === 'touch') return;
        this.onPointerOrTouchEnd(pointer);
    }

    /*--------------------*\
    |                      |
    |   Creating a Shape   |
    |                      |
    \*--------------------*/

    protected async drawShapeStart(e: PointerTracker) {
        if (this.drawingPointerId == null) return;
        const isInvisibleFill = fillColor.value.alpha <= 0;
        const isInvisibleStroke = strokeColor.value.alpha <= 0 || strokeWidth.value <= 0;
        if (isInvisibleFill && isInvisibleStroke) {
            appEmitter.emit('app.notify', {
                type: 'info',
                title: t('toolbar.drawShape.notification.invisibleShape.title'),
                message: t('toolbar.drawShape.notification.invisibleShape.message'),
                duration: 8000,
            });
            return;
        }
        if (selectedShapeType.value === 'line' && isInvisibleStroke) {
            appEmitter.emit('app.notify', {
                type: 'info',
                title: t('toolbar.drawShape.notification.invisibleLine.title'),
                message: t('toolbar.drawShape.notification.invisibleLine.message'),
                duration: 8000,
            });
            return;
        }

        this.uselessClickCount = 0;

        const startDrawReserveToken = createHistoryReserveToken();
        await historyStore.dispatch('reserve', { token: startDrawReserveToken });

        const { width, height } = workingFileStore.state;
        let selectedLayers = getSelectedLayers().filter(layer => layer.type === 'vector' || layer.type === 'empty');
        let layerActions: BaseAction[] = [];

        const newSvgString = `<svg width="${Math.round(width)}" height="${Math.round(height)}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"></svg>`;

        // Insert vector layer if none selected
        if (selectedLayers.length === 0) {
            const svgDocument = new DOMParser().parseFromString(newSvgString, 'image/svg+xml');
            layerActions.push(new InsertLayerAction<InsertVectorLayerOptions>({
                type: 'vector',
                name: ensureUniqueLayerSiblingName(
                    workingFileStore.state.layers[0]?.id, t('toolbar.drawShape.newVectorLayerName')
                ),
                width,
                height,
                transform: new DOMMatrix(),
                data: {
                    sourceUuid: await createStoredSvg((() => {
                        const image = new Image();
                        image.src = URL.createObjectURL(new Blob([newSvgString], { type: 'image/svg+xml' }));
                        return image;
                    })()),
                    sourceDocument: svgDocument,
                }
            }));
        }

        // Convert any empty layers to vector layers
        for (let i = selectedLayers.length - 1; i >= 0; i--) {
            const selectedLayer = selectedLayers[i];
            if (selectedLayer.type === 'empty') {
                const svgDocument = new DOMParser().parseFromString(newSvgString, 'image/svg+xml');
                layerActions.push(
                    new UpdateLayerAction<UpdateVectorLayerOptions>({
                        id: selectedLayer.id,
                        type: 'vector',
                        width,
                        height,
                        transform: new DOMMatrix(),
                        data: {
                            sourceUuid: await createStoredSvg(
                                await new Promise<HTMLImageElement>((resolve) => {
                                    const image = new Image();
                                    image.onload = () => {
                                        resolve(image);
                                    };
                                    image.onerror = () => {
                                        resolve(image);
                                    }
                                    image.src = URL.createObjectURL(new Blob([newSvgString], { type: 'image/svg+xml' }));
                                }),
                            ),
                            sourceDocument: svgDocument,
                        },
                    })
                );
            } else if (selectedLayer.type !== 'vector') {
                selectedLayers.splice(i, 1);
            }
        }

        this.actionQueue.push(async () => {
            // Finalize layer creation / conversion actions.
            this.drawingJustCreatedShapeLayer = false;
            if (layerActions.length > 0) {
                try {
                    await historyStore.dispatch('runAction', {
                        action: new BundleAction('createShapeLayer', 'action.createShapeLayer', layerActions),
                        reserveToken: startDrawReserveToken,
                    });
                    this.hasUncroppedChanges = true;
                    this.drawingJustCreatedShapeLayer = true;
                } catch {
                    await historyStore.dispatch('unreserve', { token: startDrawReserveToken });
                }
            } else {
                await historyStore.dispatch('unreserve', { token: startDrawReserveToken });
            }

            await nextTick();

            const { viewTransformPoint } = this.getTransformedCursorInfo();

            // Start a vector shape on each of the selected layers
            selectedLayers = getSelectedLayers().filter(layer => layer.type === 'vector');
            const drawingOnLayers = selectedLayers as WorkingFileVectorLayer[];
            this.drawingShapes = [];

            for (const layer of drawingOnLayers) {
                if (!layer.data.sourceDocument?.documentElement) {
                    layer.data.sourceDocument = await getStoredSvgDocument(layer.data.sourceUuid);
                }
                const layerDocument = layer.data.sourceDocument;

                let element: Element | null = null;
                const tagName = {
                    rectangle: 'rect',
                    circle: 'circle',
                    ellipse: 'ellipse',
                    line: 'line',
                    polyline: 'polyline',
                    polygon: 'polygon',
                    path: 'path',
                }[selectedShapeType.value] ?? '';
                if (tagName) {
                    element = layerDocument.createElement(tagName);
                }
                if (!element) continue;

                const viewBox = getViewBox(layer.data.sourceDocument);
                const transform  = parseNodeTransform(layerDocument.documentElement);
                const nodeXf = layer.transform.scale(
                    layer.width / viewBox.width, layer.height / viewBox.height, 1.0,
                ).translateSelf(
                    -viewBox.x, -viewBox.y, 0.0,
                ).multiplySelf(
                    transform,
                ).invertSelf();

                switch (tagName) {
                    case 'rect': {
                        const position1 = new DOMPoint(
                            this.dragStartPoint.x,
                            this.dragStartPoint.y,
                        ).matrixTransform(nodeXf);
                        const position2 = new DOMPoint(
                            viewTransformPoint.x,
                            viewTransformPoint.y,
                        ).matrixTransform(nodeXf);
                        let x = Math.min(position1.x, position2.x);
                        let y = Math.min(position1.y, position2.y);
                        if (pixelSnap.value) {
                            x = Math.round(x);
                            y = Math.round(y);
                        }
                        let width = Math.max(position1.x, position2.x) - x;
                        let height = Math.max(position1.y, position2.y) - y;
                        if (pixelSnap.value) {
                            width = Math.round(width);
                            height = Math.round(height);
                        }
                        element.setAttribute('x', `${x}`);
                        element.setAttribute('y', `${y}`);
                        element.setAttribute('width', `${width}`);
                        element.setAttribute('height', `${height}`);
                        break;
                    }
                    case 'circle': {
                        const position1 = new DOMPoint(
                            this.dragStartPoint.x,
                            this.dragStartPoint.y,
                        ).matrixTransform(nodeXf);
                        const position2 = new DOMPoint(
                            viewTransformPoint.x,
                            viewTransformPoint.y,
                        ).matrixTransform(nodeXf);
                        if (pixelSnap.value) {
                            position1.x = Math.round(position1.x);
                            position1.y = Math.round(position1.y);
                            position2.x = Math.round(position2.x);
                            position2.y = Math.round(position2.y);
                        }
                        let radius = pointDistance2d(position1.x, position1.y, position2.x, position2.y);
                        let x = position1.x;
                        let y = position1.y;
                        if (pixelSnap.value) {
                            radius = Math.max(1, Math.round(radius));
                        } else {
                            radius = Math.max(EPSILON, radius);
                        }
                        element.setAttribute('cx', `${x}`);
                        element.setAttribute('cy', `${y}`);
                        element.setAttribute('r', `${radius}`);
                        break;
                    }
                    case 'ellipse': {
                        const position1 = new DOMPoint(
                            this.dragStartPoint.x,
                            this.dragStartPoint.y,
                        ).matrixTransform(nodeXf);
                        const position2 = new DOMPoint(
                            viewTransformPoint.x,
                            viewTransformPoint.y,
                        ).matrixTransform(nodeXf);
                        if (pixelSnap.value) {
                            position1.x = Math.round(position1.x);
                            position1.y = Math.round(position1.y);
                            position2.x = Math.round(position2.x);
                            position2.y = Math.round(position2.y);
                        }
                        let x = (position1.x + position2.x) / 2;
                        let y = (position1.y + position2.y) / 2;
                        let rx = Math.abs(position1.x - position2.x) / 2;
                        let ry = Math.abs(position1.y - position2.y) / 2;
                        if (pixelSnap.value) {
                            rx = Math.max(1, rx);
                            ry = Math.max(1, ry);
                        } else {
                            rx = Math.max(EPSILON, rx);
                            ry = Math.max(EPSILON, ry);
                        }
                        element.setAttribute('cx', `${x}`);
                        element.setAttribute('cy', `${y}`);
                        element.setAttribute('rx', `${rx}`);
                        element.setAttribute('ry', `${ry}`);
                        break;
                    }
                    case 'line': {
                        const position1 = new DOMPoint(
                            this.dragStartPoint.x,
                            this.dragStartPoint.y,
                        ).matrixTransform(nodeXf);
                        const position2 = new DOMPoint(
                            viewTransformPoint.x,
                            viewTransformPoint.y,
                        ).matrixTransform(nodeXf);
                        if (pixelSnap.value) {
                            position1.x = Math.round(position1.x);
                            position1.y = Math.round(position1.y);
                            position2.x = Math.round(position2.x);
                            position2.y = Math.round(position2.y);
                        }
                        element.setAttribute('x1', `${position1.x}`);
                        element.setAttribute('y1', `${position1.y}`);
                        element.setAttribute('x2', `${position2.x}`);
                        element.setAttribute('y2', `${position2.y}`);
                        break;
                    }
                    case 'polyline': {
                        const position1 = new DOMPoint(
                            this.dragStartPoint.x,
                            this.dragStartPoint.y,
                        ).matrixTransform(nodeXf);
                        const position2 = new DOMPoint(
                            viewTransformPoint.x,
                            viewTransformPoint.y,
                        ).matrixTransform(nodeXf);
                        if (pixelSnap.value) {
                            position1.x = Math.round(position1.x);
                            position1.y = Math.round(position1.y);
                            position2.x = Math.round(position2.x);
                            position2.y = Math.round(position2.y);
                        }
                        element.setAttribute('points', `${position1.x},${position1.y} ${position2.x},${position2.y}`);
                        if (isInvisibleStroke) {
                            previewInvisibleStrokeStart.value = new DOMPoint(
                                this.dragStartPoint.x,
                                this.dragStartPoint.y,
                            );
                        }
                        break;
                    }
                    case 'polygon': {
                        const position1 = new DOMPoint(
                            this.dragStartPoint.x,
                            this.dragStartPoint.y,
                        ).matrixTransform(nodeXf);
                        const position2 = new DOMPoint(
                            viewTransformPoint.x,
                            viewTransformPoint.y,
                        ).matrixTransform(nodeXf);
                        if (pixelSnap.value) {
                            position1.x = Math.round(position1.x);
                            position1.y = Math.round(position1.y);
                            position2.x = Math.round(position2.x);
                            position2.y = Math.round(position2.y);
                        }
                        element.setAttribute('points', `${position1.x},${position1.y} ${position2.x},${position2.y}`);
                        if (isInvisibleStroke) {
                            previewInvisibleStrokeStart.value = new DOMPoint(
                                this.dragStartPoint.x,
                                this.dragStartPoint.y,
                            );
                        }
                        break;
                    }
                }
                element.setAttribute('fill', fillColor.value.alpha > 0 ? fillColor.value.style.slice(0, 7) : 'none');
                element.setAttribute('fill-opacity', `${fillColor.value.alpha}`);
                if (strokeColor.value.alpha > 0) {
                    element.setAttribute('stroke', strokeColor.value.style.slice(0, 7));
                    element.setAttribute('stroke-opacity', `${strokeColor.value.alpha}`);
                    element.setAttribute('stroke-width', `${strokeWidth.value}`);
                }

                layerDocument.documentElement.append(element);
                generateSvgElementIds(layerDocument);
                element.remove();

                this.drawingShapes.push({
                    layer,
                    nodeXf,
                    element,
                });

                const attributes: Record<string, string> = {};
                for (const attribute of Array.from(element.attributes)) {
                    attributes[attribute.name] = attribute.value;
                }
                this.renderer?.addVectorLayerElement(
                    layer.id,
                    tagName,
                    attributes,
                );
            }

        });

    }

    protected async drawShapeMove(e: PointerTracker) {

        if (this.drawingPointerId == null) {
            this.drawingPointerId = e.down.pointerId;
            await this.drawShapeStart(e);
        }

        if (!this.actionQueue.isIdle()) {
            return;
        }

        const { viewTransformPoint } = this.getTransformedCursorInfo();

        for (const drawingShape of this.drawingShapes) {
            const { layer, nodeXf, element } = drawingShape;
            const nodeId = element.getAttribute('data-ogr-id');
            if (nodeId == null) continue;

            const attributes: Record<string, string> = {};

            switch (element.tagName) {
                case 'rect': {
                    const position1 = new DOMPoint(
                        this.dragStartPoint.x,
                        this.dragStartPoint.y,
                    ).matrixTransform(nodeXf);
                    const position2 = new DOMPoint(
                        viewTransformPoint.x,
                        viewTransformPoint.y,
                    ).matrixTransform(nodeXf);
                    let x = Math.min(position1.x, position2.x);
                    let y = Math.min(position1.y, position2.y);
                    if (pixelSnap.value) {
                        x = Math.round(x);
                        y = Math.round(y);
                    }
                    let width = Math.max(position1.x, position2.x) - x;
                    let height = Math.max(position1.y, position2.y) - y;
                    if (pixelSnap.value) {
                        width = Math.round(width);
                        height = Math.round(height);
                    }
                    attributes.x = `${x}`;
                    attributes.y = `${y}`;
                    attributes.width = `${width}`;
                    attributes.height = `${height}`;
                    element.setAttribute('x', attributes.x);
                    element.setAttribute('y', attributes.y);
                    element.setAttribute('width', attributes.width);
                    element.setAttribute('height', attributes.height);
                    break;
                }
                case 'circle': {
                    const position1 = new DOMPoint(
                        this.dragStartPoint.x,
                        this.dragStartPoint.y,
                    ).matrixTransform(nodeXf);
                    const position2 = new DOMPoint(
                        viewTransformPoint.x,
                        viewTransformPoint.y,
                    ).matrixTransform(nodeXf);
                    if (pixelSnap.value) {
                        position1.x = Math.round(position1.x);
                        position1.y = Math.round(position1.y);
                        position2.x = Math.round(position2.x);
                        position2.y = Math.round(position2.y);
                    }
                    let radius = pointDistance2d(position1.x, position1.y, position2.x, position2.y);
                    let x = position1.x;
                    let y = position1.y;
                    if (pixelSnap.value) {
                        radius = Math.max(1, Math.round(radius));
                    } else {
                        radius = Math.max(EPSILON, radius);
                    }
                    attributes.cx = `${x}`;
                    attributes.cy = `${y}`;
                    attributes.r = `${radius}`;
                    element.setAttribute('cx', attributes.cx);
                    element.setAttribute('cy', attributes.cy);
                    element.setAttribute('r', attributes.r);
                    break;
                }
                case 'ellipse': {
                    const position1 = new DOMPoint(
                        this.dragStartPoint.x,
                        this.dragStartPoint.y,
                    ).matrixTransform(nodeXf);
                    const position2 = new DOMPoint(
                        viewTransformPoint.x,
                        viewTransformPoint.y,
                    ).matrixTransform(nodeXf);
                    if (pixelSnap.value) {
                        position1.x = Math.round(position1.x);
                        position1.y = Math.round(position1.y);
                        position2.x = Math.round(position2.x);
                        position2.y = Math.round(position2.y);
                    }
                    let x = (position1.x + position2.x) / 2;
                    let y = (position1.y + position2.y) / 2;
                    let rx = Math.abs(position1.x - position2.x) / 2;
                    let ry = Math.abs(position1.y - position2.y) / 2;
                    if (pixelSnap.value) {
                        rx = Math.max(1, rx);
                        ry = Math.max(1, ry);
                    } else {
                        rx = Math.max(EPSILON, rx);
                        ry = Math.max(EPSILON, ry);
                    }
                    attributes.cx = `${x}`;
                    attributes.cy = `${y}`;
                    attributes.rx = `${rx}`;
                    attributes.ry = `${ry}`;
                    element.setAttribute('cx', attributes.cx);
                    element.setAttribute('cy', attributes.cy);
                    element.setAttribute('rx', attributes.rx);
                    element.setAttribute('ry', attributes.ry);
                    break;
                }
                case 'line': {
                    const position1 = new DOMPoint(
                        this.dragStartPoint.x,
                        this.dragStartPoint.y,
                    ).matrixTransform(nodeXf);
                    const position2 = new DOMPoint(
                        viewTransformPoint.x,
                        viewTransformPoint.y,
                    ).matrixTransform(nodeXf);
                    if (pixelSnap.value) {
                        position1.x = Math.round(position1.x);
                        position1.y = Math.round(position1.y);
                        position2.x = Math.round(position2.x);
                        position2.y = Math.round(position2.y);
                    }
                    attributes.x1 = `${position1.x}`;
                    attributes.y1 = `${position1.y}`;
                    attributes.x2 = `${position2.x}`;
                    attributes.y2 = `${position2.y}`;
                    element.setAttribute('x1', attributes.x1);
                    element.setAttribute('y1', attributes.y1);
                    element.setAttribute('x2', attributes.x2);
                    element.setAttribute('y2', attributes.y2);
                    break;
                }
                case 'polyline': {
                    const position1 = new DOMPoint(
                        this.dragStartPoint.x,
                        this.dragStartPoint.y,
                    ).matrixTransform(nodeXf);
                    const position2 = new DOMPoint(
                        viewTransformPoint.x,
                        viewTransformPoint.y,
                    ).matrixTransform(nodeXf);
                    if (pixelSnap.value) {
                        position1.x = Math.round(position1.x);
                        position1.y = Math.round(position1.y);
                        position2.x = Math.round(position2.x);
                        position2.y = Math.round(position2.y);
                    }
                    attributes.points = `${position1.x},${position1.y} ${position2.x},${position2.y}`;
                    element.setAttribute('points', attributes.points);
                    break;
                }
                case 'polygon': {
                    const position1 = new DOMPoint(
                        this.dragStartPoint.x,
                        this.dragStartPoint.y,
                    ).matrixTransform(nodeXf);
                    const position2 = new DOMPoint(
                        viewTransformPoint.x,
                        viewTransformPoint.y,
                    ).matrixTransform(nodeXf);
                    if (pixelSnap.value) {
                        position1.x = Math.round(position1.x);
                        position1.y = Math.round(position1.y);
                        position2.x = Math.round(position2.x);
                        position2.y = Math.round(position2.y);
                    }
                    attributes.points = `${position1.x},${position1.y} ${position2.x},${position2.y}`;
                    element.setAttribute('points', attributes.points);
                    break;
                }
            }
            
            this.renderer?.updateVectorLayerAttributes(
                layer.id,
                nodeId,
                attributes,
            );
        }

    }

    private async drawShapeEnd() {
        previewInvisibleStrokeStart.value = null;

        if (this.drawingShapes.length > 0) {
            await this.actionQueue.wait();

            const updateLayerReserveToken = createHistoryReserveToken();
            await historyReserveQueueFree();
            await historyStore.dispatch('reserve', { token: updateLayerReserveToken });

            const serializer = new XMLSerializer();

            try {
                const layerActions: BaseAction[] = [];

                for (const drawingShape of this.drawingShapes) {
                    const { layer, element } = drawingShape;

                    const layerDocument = await getStoredSvgDocument(layer.data.sourceUuid);
                    const newLayerDocument = layerDocument.cloneNode(true) as Document;
                    newLayerDocument.documentElement.append(element);
                    element.removeAttribute('xmlns');
                    generateSvgElementIds(newLayerDocument);
                    const svgString = serializer.serializeToString(newLayerDocument).replace(/xmlns=""/g, '');

                    const elementId = element.getAttribute('data-ogr-id');
                    if (elementId) {
                    if (!layer.data.pendingSourceDocumentUpdateNodeIds) {
                            layer.data.pendingSourceDocumentUpdateNodeIds = [];
                        }
                        layer.data.pendingSourceDocumentUpdateNodeIds.push(elementId);
                    }

                    const image = await new Promise<HTMLImageElement>((resolve) => {
                        const image = new Image();
                        image.onload = () => {
                            resolve(image);
                        };
                        image.onerror = () => {
                            resolve(image);
                        }
                        image.src = URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml' }));
                    });

                    layerActions.push(new UpdateLayerAction<UpdateVectorLayerOptions>(
                        {
                            id: layer.id,
                            data: {
                                sourceUuid: await createStoredSvg(image),
                            },
                        },
                    ));
                }

                // Intentionally placed here - reference createEditingLayersFromSelectedLayers() call in history step.
                this.drawingPointerId = null;

                await historyStore.dispatch('runAction', {
                    action: new BundleAction('createShape', 'action.createShape', layerActions),
                    reserveToken: updateLayerReserveToken,
                    mergeWithHistory: this.drawingJustCreatedShapeLayer ? ['createShapeLayer'] : undefined,
                });
                this.hasUncroppedChanges = true;

                const tagName = this.drawingShapes[0]?.element.tagName;
                this.selectExtendPathNodes(tagName, this.drawingShapes.slice());

            } catch (error) {
                console.error('[src/canvas/controllers/draw-shape.ts] Error when creating shape layer updates ', error);
                await historyStore.dispatch('unreserve', { token: updateLayerReserveToken });
            }
        }
        
        this.drawingPointerId = null;
        this.drawingShapes = [];
    }

    /*--------------------*\
    |                      |
    |   Extending a Path   |
    |                      |
    \*--------------------*/

    protected extendPathStart(e: PointerTracker) {
        if (this.extendPathPointerId != null) return;

        this.uselessClickCount = 0;

        this.extendPathPointerId = e.down.pointerId;
        this.extendPathInfo = [];

        const { viewTransformPoint } = this.getTransformedCursorInfo();

        for (const selectedPointIndex of selectedEditControlPointIndices.value) {
            const point = editControlPoints.value[selectedPointIndex];
            const layer = editingLayers.value[point.layerIndex];
            const node = editControlPointNodes.value[point.nodeIndex];
            const nodeId = node.getAttribute('data-ogr-id');
            if (!nodeId) continue;
            let pathStart = node.getAttribute('d') ?? node.getAttribute('points');
            if (pathStart == null) continue;
            const layerDocument = layer.data.sourceDocument;
            if (!layerDocument) continue;

            const viewBox = getViewBox(layer.data.sourceDocument);
            const transform  = parseNodeTransform(node);
            const nodeXf = layer.transform.scale(
                layer.width / viewBox.width, layer.height / viewBox.height, 1.0,
            ).translateSelf(
                -viewBox.x, -viewBox.y, 0.0,
            ).multiplySelf(
                transform,
            ).invertSelf();

            this.extendPathInfo.push({
                layerId: layer.id,
                tagName: node.tagName,
                nodeId,
                nodeXf,
                pathStart,
            });

            const attributes: Record<string, string> = {};

            switch (node.tagName) {
                case 'polyline': case 'polygon':
                    const newPoint = new DOMPoint(
                        viewTransformPoint.x,
                        viewTransformPoint.y,
                    ).matrixTransform(nodeXf);
                    if (pixelSnap.value) {
                        newPoint.x = Math.round(newPoint.x);
                        newPoint.y = Math.round(newPoint.y);
                    }
                    attributes['points'] = `${pathStart} ${newPoint.x},${newPoint.y}`;
                    break;
                case 'path':
                    break;
            }

            this.renderer?.updateVectorLayerAttributes(
                layer.id,
                nodeId,
                attributes,
            );
        }
    }

    protected async extendPathMove(e: PointerTracker) {
        if (e.down.pointerId !== this.extendPathPointerId) return;

        const { viewTransformPoint } = this.getTransformedCursorInfo();

        for (const { layerId, tagName, nodeId, nodeXf, pathStart } of this.extendPathInfo) {
            const attributes: Record<string, string> = {};

            switch (tagName) {
                case 'polyline': case 'polygon':
                    const newPoint = new DOMPoint(
                        viewTransformPoint.x,
                        viewTransformPoint.y,
                    ).matrixTransform(nodeXf);
                    if (pixelSnap.value) {
                        newPoint.x = Math.round(newPoint.x);
                        newPoint.y = Math.round(newPoint.y);
                    }
                    attributes['points'] = `${pathStart} ${newPoint.x},${newPoint.y}`;
                    break;
                case 'path':
                    break;
            }

            this.renderer?.updateVectorLayerAttributes(
                layerId,
                nodeId,
                attributes,
            );
        }
    }

    private async extendPathEnd() {
        const { viewTransformPoint } = this.getTransformedCursorInfo();

        const actions: UpdateVectorLayerAttributesAction[] = [];

        let tagName = this.extendPathInfo[0]?.tagName;
        for (const { layerId, tagName, nodeId, nodeXf, pathStart } of this.extendPathInfo) {
            const attributes: Record<string, string> = {};

            switch (tagName) {
                case 'polyline': case 'polygon':
                    const newPoint = new DOMPoint(
                        viewTransformPoint.x,
                        viewTransformPoint.y,
                    ).matrixTransform(nodeXf);
                    if (pixelSnap.value) {
                        newPoint.x = Math.round(newPoint.x);
                        newPoint.y = Math.round(newPoint.y);
                    }
                    attributes['points'] = `${pathStart} ${newPoint.x},${newPoint.y}`;
                    break;
                case 'path':
                    break;
            }

            actions.push(new UpdateVectorLayerAttributesAction(
                layerId,
                nodeId,
                attributes,
                true,
            ));
        }

        this.extendPathPointerId = null;
        
        await historyStore.dispatch('runAction', {
            action: new BundleAction(
                'moveVectorLayerControlPoints',
                'action.moveVectorLayerControlPoints',
                actions,
            )
        });
        this.hasUncroppedChanges = true;

        this.selectExtendPathNodes(tagName, undefined, this.extendPathInfo.slice());

        this.extendPathInfo = [];
    }

    /*-------------------------*\
    |                           |
    |   Moving Control Points   |
    |                           |
    \*-------------------------*/

    protected dragEditControlPointStart(e: PointerTracker) {
        this.dragControlPointPointerId = e.down.pointerId;
         
        ({ viewTransformPoint: this.dragStartPoint } = this.getTransformedCursorInfo());

        this.uselessClickCount = 0;

        let selectedAttachedEditControlPointIndices: number[] = [];
        const selectedEditControlAttachPointIndicesSet = new Set<number>();

        const referencedControlPointIndices = new Set<number>();
        for (const selectedIndex of selectedEditControlPointIndices.value) {
            const point = editControlPoints.value[selectedIndex];
            if (point.attachToIndex != null) {
                referencedControlPointIndices.add(point.attachToIndex);
            }
        }

        const firstCheckIndex = Math.min(
            editControlPoints.value[selectedEditControlPointIndices.value[0]].attachToIndex ?? Infinity,
            selectedEditControlPointIndices.value[0]
        );
        // This loops under the assumption attached indices always follow what they're attached to
        for (let i = firstCheckIndex + 1; i < editControlPoints.value.length; i++) {
            const point = editControlPoints.value[i];
            for (let selectedIndex of selectedEditControlPointIndices.value) {
                if (
                    point.attachToIndex === selectedIndex
                    && i !== selectedIndex
                ) {
                    selectedAttachedEditControlPointIndices.push(i);
                    selectedEditControlAttachPointIndicesSet.add(i);
                    break;
                }
            }
            if (point.attachToIndex != null && referencedControlPointIndices.has(point.attachToIndex)) {
                selectedEditControlAttachPointIndicesSet.add(i);
            }
        }

        selectedEditControlAttachPointIndices.value = Array.from(selectedEditControlAttachPointIndicesSet);

        this.draggingEditControlPointIndices = selectedEditControlPointIndices.value.slice();
        for (let pointIndex of selectedAttachedEditControlPointIndices) {
            this.draggingEditControlPointIndices.push(pointIndex);
        }

        for (const pointIndex of this.draggingEditControlPointIndices) {
            const point = editControlPoints.value[pointIndex];
            point.sx = point.x;
            point.sy = point.y;
        }

        this.snapSensitivity = preferencesStore.get('snapSensitivity') / canvasStore.state.decomposedTransform.scaleX * devicePixelRatio;
        this.calculateEditControlPointSnapPoints();

        const nodeIndices = selectedEditControlPointIndices.value.map((selectedIndex) => {
            const point = editControlPoints.value[selectedIndex];
            return point.nodeIndex;
        })

        let averageFillColor: RGBAColor | null = null;
        let averageStrokeColor: RGBAColor | null = null;
        let averageStrokeWidth: number | null = null;
        for (const nodeIndex of nodeIndices) {
            let { fill, stroke, strokeWidth } = editControlPointNodeParsedAttributes.value[nodeIndex];
            fill = fill ?? '#00000000';
            stroke = stroke ?? '#00000000';
            if (averageFillColor?.style !== fill) {
                if (averageFillColor) {
                    averageFillColor = hexToColor('#000000', 'rgba');
                } else {
                    averageFillColor = hexToColor(fill, 'rgba');
                }
            }
            if (averageStrokeColor?.style !== stroke) {
                if (averageStrokeColor) {
                    averageStrokeColor = hexToColor('#000000', 'rgba');
                } else {
                    averageStrokeColor = hexToColor(stroke, 'rgba');
                }
            }
            if (averageStrokeWidth !== strokeWidth) {
                if (averageStrokeWidth != null) {
                    averageStrokeWidth = 1;
                } else {
                    averageStrokeWidth = strokeWidth;
                }
            }
        }
        if (averageFillColor != null) {
            fillColor.value = averageFillColor;
        }
        if (averageStrokeColor != null) {
            strokeColor.value = averageStrokeColor;
        }
        if (averageStrokeWidth != null) {
            strokeWidth.value = averageStrokeWidth;
        }
    }

    protected dragEditControlPointMove(e: PointerTracker) {
        if (!this.renderer) return;

        const { viewTransformPoint } = this.getTransformedCursorInfo();

        for (const pointIndex of this.draggingEditControlPointIndices) {
            const point = editControlPoints.value[pointIndex];

            if (
                (
                    (point.xProp && point.yProp)
                    || !selectedEditControlPointIndices.value.includes(pointIndex)
                )
                && !(point.minPointIndex != null || point.maxPointIndex != null)
            ) {
                point.x = point.sx! + (viewTransformPoint.x - this.dragStartPoint.x);
                point.y = point.sy! + (viewTransformPoint.y - this.dragStartPoint.y);
            } else {
                const layer = editingLayers.value[point.layerIndex];
                const viewBox = getViewBox(layer.data.sourceDocument);
                const viewBoxXf = layer.transform.scale(
                    layer.width / viewBox.width, layer.height / viewBox.height, 1.0,
                ).translateSelf(
                    -viewBox.x, -viewBox.y, 0.0,
                );

                const { transform } = editControlPointNodeParsedAttributes.value[point.nodeIndex];
                const nodeXf = viewBoxXf.multiply(transform);
                const inverseNodeXf = nodeXf.inverse();

                const referencePointXf = new DOMPoint(
                    point.sx!,
                    point.sy!
                ).matrixTransform(inverseNodeXf);
                const newPointXf = new DOMPoint(
                    point.sx! + (viewTransformPoint.x - this.dragStartPoint.x),
                    point.sy! + (viewTransformPoint.y - this.dragStartPoint.y),
                ).matrixTransform(inverseNodeXf);

                if (!point.xProp) {
                    newPointXf.x = referencePointXf.x;
                }
                if (!point.yProp) {
                    newPointXf.y = referencePointXf.y;
                }

                if (point.minPointIndex != null) {
                    const minPoint = editControlPoints.value[point.minPointIndex];
                    if (minPoint) {
                        const minPointXf = new DOMPoint(
                            minPoint.x,
                            minPoint.y,
                        ).matrixTransform(inverseNodeXf);
                        newPointXf.x = Math.max(newPointXf.x, minPointXf.x + 1);
                        newPointXf.y = Math.max(newPointXf.y, minPointXf.y + 1);
                    }
                }

                if (point.maxPointIndex != null) {
                    const maxPoint = editControlPoints.value[point.maxPointIndex];
                    if (maxPoint) {
                        const maxPointXf = new DOMPoint(
                            maxPoint.x,
                            maxPoint.y,
                        ).matrixTransform(inverseNodeXf);
                        newPointXf.x = Math.min(newPointXf.x, maxPointXf.x - 1);
                        newPointXf.y = Math.min(newPointXf.y, maxPointXf.y - 1);
                    }
                }

                const newPoint = newPointXf.matrixTransform(nodeXf);
                point.x = newPoint.x;
                point.y = newPoint.y;
            }

        }

        // Apply snapping
        snapLineX.value = [];
        snapLineY.value = [];
        let snapXOffset = 0;
        let snapYOffset = 0;
        if (useSnapping.value && (useCanvasEdgeSnapping.value || useControlPointSnapping.value)) {
            let checkPoints: DOMPoint[] = this.draggingEditControlPointIndices.map((pointIndex) => {
                const point = editControlPoints.value[pointIndex];
                return new DOMPoint(point.x, point.y);
            });

            // Determine X-axis snapping points
            let checkPointIndex: number = 0;
            checkPoints.sort((a, b) => {
                return a.x < b.x ? -1 : 1;
            });
            let snapPointIndex = 0;
            let snapPoint: SnapPointGroup;
            let snapLineXLayerPointIndex: number = 0;
            for (snapPointIndex = 0; snapPointIndex < this.snapXPoints.length; snapPointIndex++) {
                snapPoint = this.snapXPoints[snapPointIndex];
                const checkPoint = checkPoints[checkPointIndex];
                if (snapLineX.value.length > 0 && snapPoint.value !== snapLineX.value[0]) {
                    break;
                }
                if (Math.abs(snapPoint.value - checkPoint.x) <= this.snapSensitivity) {
                    if (snapLineX.value.length === 0) {
                        snapXOffset = snapPoint.value - checkPoint.x;
                        for (let pointY of snapPoint.points) {
                            snapLineX.value.push(snapPoint.value, pointY);
                        }
                        snapLineXLayerPointIndex = snapLineX.value.length;
                    }
                    snapLineX.value.push(snapPoint.value, checkPoint.y);
                    checkPointIndex++;
                    snapPointIndex--;
                } else if (checkPoint.x < snapPoint.value + this.snapSensitivity) {
                    checkPointIndex++;
                    snapPointIndex--;
                }
                if (checkPointIndex > checkPoints.length - 1) {
                    break;
                }
            }

            // Determine Y-axis snapping points
            checkPointIndex = 0;
            checkPoints.sort((a, b) => {
                return a.y < b.y ? -1 : 1;
            });
            for (snapPointIndex = 0; snapPointIndex < this.snapYPoints.length; snapPointIndex++) {
                snapPoint = this.snapYPoints[snapPointIndex];
                const checkPoint = checkPoints[checkPointIndex];
                if (snapLineY.value.length > 0 && snapPoint.value !== snapLineY.value[1]) {
                    break;
                }
                if (Math.abs(snapPoint.value - checkPoint.y) <= this.snapSensitivity) {
                    if (snapLineY.value.length === 0) {
                        snapYOffset = snapPoint.value - checkPoint.y;
                        for (let pointX of snapPoint.points) {
                            snapLineY.value.push(pointX, snapPoint.value);
                        }
                    }
                    snapLineY.value.push(checkPoint.x + snapXOffset, snapPoint.value);
                    checkPointIndex++;
                    snapPointIndex--;
                } else if (checkPoint.y < snapPoint.value + this.snapSensitivity) {
                    checkPointIndex++;
                    snapPointIndex--;
                }
                if (checkPointIndex > checkPoints.length - 1) {
                    break;
                }
            }
            for (; snapLineXLayerPointIndex < snapLineX.value.length; snapLineXLayerPointIndex += 2) {
                snapLineX.value[snapLineXLayerPointIndex + 1] += snapYOffset;
            }

            if (snapXOffset !== 0 || snapYOffset !== 0) {
                this.draggingEditControlPointIndices.forEach((pointIndex) => {
                    const point = editControlPoints.value[pointIndex];
                    const pointXf = new DOMPoint(point.x, point.y).matrixTransform(
                        new DOMMatrix().translate(snapXOffset, snapYOffset)
                    );
                    point.x = pointXf.x;
                    point.y = pointXf.y;
                });
            }
        }

        editControlPointsDirty.value = true;

        this.pendingControlPointEdits = renderControlPointAttributeEdits(
            this.draggingEditControlPointIndices,
            this.renderer,
        );
    }

    protected dragEditControlPointEnd() {
        if (this.pendingControlPointEdits.length === 0) return;
        const actions: UpdateVectorLayerAttributesAction[] = [];

        if (snapLineX.value.length > 0) snapLineX.value = [];
        if (snapLineY.value.length > 0) snapLineY.value = [];

        for (const edit of this.pendingControlPointEdits) {
            actions.push(new UpdateVectorLayerAttributesAction(
                edit.layerId,
                edit.nodeId,
                { ...edit.attributes },
                true,
            ));
        }

        historyStore.dispatch('runAction', {
            action: new BundleAction(
                'moveVectorLayerControlPoints',
                'action.moveVectorLayerControlPoints',
                actions,
            )
        });
        this.hasUncroppedChanges = true;
    }

    private getEditControlPointIndicesAtPagePoint(x: number, y: number, excludeIndex?: number, isHover?: boolean): number[] {
        if (selectedShapes.value.length > 0) return [];

        const isTouch = this.pointers.filter((pointer) => pointer.down.isPrimary)[0]?.type === 'touch';

        const transform = canvasStore.get('transform');
        const decomposedTransform = canvasStore.get('decomposedTransform');
        const transformInverse = transform.inverse();
        const cursor = new DOMPoint(x * devicePixelRatio, y * devicePixelRatio).matrixTransform(transformInverse);

        const dragHandleRadius = isTouch ? this.dragHandleRadiusTouch : this.dragHandleRadius;

        let currentDistance = Infinity;
        let currentIsAttached = true;
        let currentIndices: number[] = [];

        let selectedNodeIndex: number | null = null;
        for (const [pathPointIndex, pathPoint] of editControlPoints.value.entries()) {
            if (
                Math.abs(cursor.x - pathPoint.x) < dragHandleRadius * devicePixelRatio / decomposedTransform.scaleX &&
                Math.abs(cursor.y - pathPoint.y) < dragHandleRadius * devicePixelRatio / decomposedTransform.scaleY
            ) {
                const isAttached = pathPoint.attachToIndex != null;
                if (
                    pathPointIndex === excludeIndex
                    || (!currentIsAttached && isAttached)
                    || (
                        isAttached
                        && !selectedEditControlAttachPointIndices.value.includes(pathPointIndex)
                    )
                ) {
                    continue;
                } else {
                    const distance = pointDistance2d(cursor.x, cursor.y, pathPoint.x, pathPoint.y);
                    if (distance <= currentDistance + 0.00001) {
                        if (!isEqualApprox(distance, currentDistance, 0.00001)) {
                            currentIndices.length = 0;
                            currentDistance = distance;
                        }
                        if (pathPoint.nodeIndex != selectedNodeIndex) {
                            selectedNodeIndex = pathPoint.nodeIndex;
                            currentIndices.length = 0;
                        }
                        currentIndices.push(pathPointIndex);
                        currentIsAttached = isAttached;
                    }
                    if (isHover) {
                        break;
                    }
                }
            }
        }
        return currentIndices;
    }

    private getSelectedEditControlPointLayerNodeMap() {
        const layerNodeMap = new Map<number, Set<string>>();
        for (const index of selectedEditControlPointIndices.value) {
            const point = editControlPoints.value[index];
            const layerId = editingLayers.value[point.layerIndex]?.id;
            if (layerId == null) continue;
            if (!layerNodeMap.has(layerId)) {
                layerNodeMap.set(layerId, new Set());
            }
            const nodeId = editControlPointNodes.value[point.nodeIndex].getAttribute('data-ogr-id');
            if (nodeId == null) continue;
            layerNodeMap.get(layerId)?.add(nodeId);
        }
        return layerNodeMap;
    }

    private calculateEditControlPointSnapPoints() {
        if (!useSnapping.value || (
            !useControlPointSnapping.value && !useCanvasEdgeSnapping.value
        )) return;

        const xMap: Record<number, number[]> = {};
        const yMap: Record<number, number[]> = {};

        for (const [pointIndex, point] of editControlPoints.value.entries()) {
            if (point.attachToIndex != null) continue;
            const layer = editingLayers.value[point.layerIndex];
            if (
                !visibleLayerIds.value.has(layer.id)
                || this.draggingEditControlPointIndices.includes(pointIndex)
            ) continue;

            const x = point.x;
            const y = point.y;

            (xMap[x] ??= []).push(y);
            (yMap[y] ??= []).push(x);
        }
        
        if (useSnapping.value && useCanvasEdgeSnapping.value) {
            const width = workingFileStore.get('width');
            const height = workingFileStore.get('height');
            (xMap[0] ??= []).push(0);
            (yMap[0] ??= []).push(0);
            (xMap[width] ??= []).push(0);
            (yMap[0] ??= []).push(width);
            (xMap[0] ??= []).push(height);
            (yMap[height] ??= []).push(0);
            (xMap[width] ??= []).push(height);
            (yMap[height] ??= []).push(width);
        }

        this.snapXPoints = [];
        for (const xStr in xMap) {
            this.snapXPoints.push({
                value: +xStr,
                points: Int32Array.from(xMap[xStr])
            });
        }

        this.snapYPoints = [];
        for (const yStr in yMap) {
            this.snapYPoints.push({
                value: +yStr,
                points: Int32Array.from(yMap[yStr])
            });
        }

        this.snapXPoints.sort((a, b) => a.value - b.value);
        this.snapYPoints.sort((a, b) => a.value - b.value);

        this.snapPointsNeedToBeCalculated = false;
    }

    /*------------------------*\
    |                          |
    |   Moving Entire Shapes   |
    |                          |
    \*------------------------*/

    private async selectShapes(e: PointerTracker) {
        const { viewTransformPoint } = this.getTransformedCursorInfo();

        selectedShapes.value = [];

        if (!this.renderer) return;

        for (const layer of editingLayers.value) {
            const elements = await this.renderer.pickVectorLayerElement(layer.id, viewTransformPoint.x, viewTransformPoint.y);
            if (elements.length > 0) {
                this.uselessClickCount = 0;
                selectedShapes.value.push([layer.id, elements[0].id]);
            }
        }

        this.setTransformBoundsFromSelectedShapesImmediate();

        if (selectedShapes.value.length > 0) {
            const { transformBoundsPoint, viewDecomposedTransform } = this.getTransformedCursorInfo();
            let transformDragType = this.getTransformDragType(transformBoundsPoint, viewDecomposedTransform);
            transformRotateHandleHighlight.value = false;
            if (transformDragType != null) {
                transformDragHandleHighlight.value = transformDragType;
            } else {
                transformDragHandleHighlight.value = null;
            }

            let averageFillColor = null as RGBAColor | null;
            let averageStrokeColor = null as RGBAColor | null;
            let averageStrokeWidth: number | null = null;
            for (const [layerId, nodeId] of selectedShapes.value) {
                const layer = getLayerById<WorkingFileVectorLayer>(layerId);
                const layerDocument = layer?.data.sourceDocument;
                const shapeNode = layerDocument?.querySelector(`[data-ogr-id="${nodeId}"]`);
                if (!shapeNode) continue;

                let { fill, stroke, strokeWidth } = parseCommonNodeAttributes(shapeNode);
                fill = fill ?? '#00000000';
                stroke = stroke ?? '#00000000';
                if (averageFillColor?.style !== fill) {
                    if (averageFillColor) {
                        averageFillColor = hexToColor('#000000', 'rgba');
                    } else {
                        averageFillColor = hexToColor(fill, 'rgba');
                    }
                }
                if (averageStrokeColor?.style !== stroke) {
                    if (averageStrokeColor) {
                        averageStrokeColor = hexToColor('#000000', 'rgba');
                    } else {
                        averageStrokeColor = hexToColor(stroke, 'rgba');
                    }
                }
                if (averageStrokeWidth !== strokeWidth) {
                    if (averageStrokeWidth != null) {
                        averageStrokeWidth = 1;
                    } else {
                        averageStrokeWidth = strokeWidth;
                    }
                }
            }
            if (averageFillColor != null) {
                fillColor.value = averageFillColor;
            }
            if (averageStrokeColor != null) {
                strokeColor.value = averageStrokeColor;
            }
            if (averageStrokeWidth != null) {
                strokeWidth.value = averageStrokeWidth;
            }
        }
        this.handleCursorIcon();
    }

    private async transformShapesStart() {
        this.uselessClickCount = 0;
        this.isTransformShapesDragging = false;
        let { transformBoundsPoint, viewTransformPoint, viewDecomposedTransform } = this.getTransformedCursorInfo();

        // Figure out which resize/rotate handles were clicked on, or if clicked in empty space just to drag
        this.determineDragRotateType(viewTransformPoint, transformBoundsPoint, viewDecomposedTransform);

        const decomposedCanvasTransform = canvasStore.get('decomposedTransform');
        this.snapSensitivity = preferencesStore.get('snapSensitivity') / decomposedCanvasTransform.scaleX * devicePixelRatio;
        this.calculateTransformShapeSnapPoints();
    }

    private async transformShapesMove(e: PointerTracker) {
        if (!this.transformShapeTranslateStart) return;

        const { viewTransformPoint } = this.getTransformedCursorInfo();
        const { shouldMaintainAspectRatio, shouldScaleDuringResize, shouldSnapRotationDegrees } = transformOptions.value;

        this.isTransformShapesDragging = true;

        // Rotation
        if (this.transformShapeIsRotating) {
            const handleRotation = Math.atan2(
                viewTransformPoint.y - (transformBoundsTop.value + (transformBoundsHeight.value * transformOriginY.value)),
                viewTransformPoint.x - (transformBoundsLeft.value + (transformBoundsWidth.value * transformOriginX.value)),
            );
            let rotationDelta = handleRotation - this.transformShapeStartDimensions.handleToRotationOrigin;

            if (shouldSnapRotationDegrees) {
                const targetRotation = this.transformShapeStartDimensions.rotation + rotationDelta;
                let roundedTargetRotation = Math.round(targetRotation / (rotationSnappingDegrees.value * Math.DEGREES_TO_RADIANS)) * (rotationSnappingDegrees.value * Math.DEGREES_TO_RADIANS);
                rotationDelta -= targetRotation - roundedTargetRotation;
            }

            this.previewTransformShapeRotationChange(this.transformShapeStartDimensions.rotation + rotationDelta);
        }
        // Drag/Resize
        else if (this.transformShapeIsDragging) {

            const isDragAll = this.transformShapeDragType === DRAG_TYPE_ALL;
            let isDragLeft = Math.floor(this.transformShapeDragType / DRAG_TYPE_LEFT) % 2 === 1;
            let isDragRight = Math.floor(this.transformShapeDragType / DRAG_TYPE_RIGHT) % 2 === 1;
            let isDragTop = Math.floor(this.transformShapeDragType / DRAG_TYPE_TOP) % 2 === 1;
            let isDragBottom = Math.floor(this.transformShapeDragType / DRAG_TYPE_BOTTOM) % 2 === 1;

            const dx = Math.round(viewTransformPoint.x - this.transformShapeTranslateStart.x);
            const dy = Math.round(viewTransformPoint.y - this.transformShapeTranslateStart.y);
            const xFactor = Math.cos(transformBoundsRotation.value);
            const yFactor = Math.sin(transformBoundsRotation.value);

            const transformStartAppliedWidth = this.transformShapeStartDimensions.width + (xFactor * dx) + (yFactor * dy);
            const transformStartAppliedHeight = this.transformShapeStartDimensions.height + (xFactor * dy) - (yFactor * dx);
            let offsetWidth = transformStartAppliedWidth;
            let offsetHeight = transformStartAppliedHeight;
            if (isDragLeft) {
                offsetWidth = this.transformShapeStartDimensions.width - ((xFactor * dx) + (yFactor * dy));
            }
            if (isDragTop) {
                offsetHeight = this.transformShapeStartDimensions.height - ((xFactor * dy) - (yFactor * dx));
            }
            // @ts-ignore 2365
            if (shouldMaintainAspectRatio && (isDragLeft + isDragRight + isDragTop + isDragBottom > 1)) {
                const ratioOffsetWidth = offsetHeight * (this.transformShapeStartDimensions.width / this.transformShapeStartDimensions.height);
                const ratioOffsetHeight = offsetWidth * (this.transformShapeStartDimensions.height / this.transformShapeStartDimensions.width);
                if (offsetHeight > ratioOffsetHeight) {
                    offsetWidth = ratioOffsetWidth;
                } else {
                    offsetHeight = ratioOffsetHeight;
                }
            }

            // Determine dimensions
            let left = this.transformShapeStartDimensions.left;
            let top = this.transformShapeStartDimensions.top;
            let width = this.transformShapeStartDimensions.width;
            let height = this.transformShapeStartDimensions.height;
            if (isDragAll) {
                left = this.transformShapeStartDimensions.left + dx;
                top = this.transformShapeStartDimensions.top + dy;
            }
            if (isDragTop || isDragLeft) {
                left = this.transformShapeStartDimensions.left;
                top = this.transformShapeStartDimensions.top;
            }
            if (isDragTop) {
                const heightDifference = Math.max(-this.transformShapeStartDimensions.height + 1, (offsetHeight - this.transformShapeStartDimensions.height));
                const offsetX = -yFactor * heightDifference;
                const offsetY = xFactor * heightDifference;
                left -= offsetX;
                top -= offsetY;
            }
            if (isDragLeft) {
                const widthDifference = Math.max(-this.transformShapeStartDimensions.width + 1, (offsetWidth - this.transformShapeStartDimensions.width));
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

            this.previewTransformShapeDragResizeChange(
                { top, left, width, height },
                shouldScaleDuringResize,
                true,
            );
            
        }

        canvasStore.set('dirty', true);
    }

    private async transformShapesEnd() {
        this.commitTransforms();
        this.isTransformShapesDragging = false;
        this.transformShapeTranslateStart = null;
    }

    private previewTransformShapeRotationChange(newRotation: number) {
        this.previewTransformRotation = newRotation;
        const rotationDelta = newRotation - this.transformShapeStartDimensions.rotation;
        drawShapeToolbarEmitter.emit('setTransformDimensions', {
            rotation: newRotation,
            transformOriginX: transformOriginX.value,
            transformOriginY: transformOriginY.value
        });
        for (const [i, [layerId, shapeId]] of selectedShapes.value.entries()) {
            const layerTransformOriginX = transformBoundsLeft.value + (transformOriginX.value * transformBoundsWidth.value);
            const layerTransformOriginY = transformBoundsTop.value + (transformOriginY.value * transformBoundsHeight.value);

            const { parentTransform, shapeTransform } = this.transformShapeLayerData[i];
            const screenTransform = parentTransform.multiply(shapeTransform);
            const layerTransformOrigin = new DOMPoint(layerTransformOriginX, layerTransformOriginY).matrixTransform(screenTransform.inverse());
            const decomposedTransform = decomposeMatrix(screenTransform);
            const newScreenTransform =
                DOMMatrix.fromMatrix(screenTransform)
                .translateSelf(layerTransformOrigin.x, layerTransformOrigin.y)
                .scaleSelf(1 / decomposedTransform.scaleX, 1 / decomposedTransform.scaleY)
                .rotateSelf(rotationDelta * Math.RADIANS_TO_DEGREES)
                .scaleSelf(decomposedTransform.scaleX, decomposedTransform.scaleY)
                .translateSelf(-layerTransformOrigin.x, -layerTransformOrigin.y);
            
            this.transformShapeLayerData[i].newShapeTransform = parentTransform.inverse().multiply(newScreenTransform);
            const { a, b, c, d, e, f } = this.transformShapeLayerData[i].newShapeTransform;
            this.renderer?.updateVectorLayerAttributes(layerId, shapeId, {
                transform: `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`,
            });
        }
    }

    private previewTransformShapeDragResizeChange(newTransform: DragResizeTransformShapeInfo, shouldScaleDuringResize?: boolean, enableSnapping?: boolean) {
        if (shouldScaleDuringResize == null) {
            shouldScaleDuringResize = transformOptions.value.shouldScaleDuringResize;
        }
        // Determine top/left offset based on width/height change
        let transformOriginXPoint = (this.transformShapeStartDimensions.width * transformOriginX.value);
        let transformOriginYPoint = (this.transformShapeStartDimensions.height * transformOriginY.value);
        const decomposedStartDimensions = decomposeMatrix(
            new DOMMatrix()
            .translateSelf(-transformOriginXPoint, -transformOriginYPoint)
            .translateSelf(newTransform.left, newTransform.top)
            .rotateSelf(transformBoundsRotation.value * Math.RADIANS_TO_DEGREES)
            .translateSelf(transformOriginXPoint, transformOriginYPoint)
        );
        transformOriginXPoint = (newTransform.width * transformOriginX.value);
        transformOriginYPoint = (newTransform.height * transformOriginY.value);
        const decomposedEndDimensions = decomposeMatrix(
            new DOMMatrix()
            .translateSelf(-transformOriginXPoint, -transformOriginYPoint)
            .translateSelf(newTransform.left, newTransform.top)
            .rotateSelf(transformBoundsRotation.value * Math.RADIANS_TO_DEGREES)
            .translateSelf(transformOriginXPoint, transformOriginYPoint)
        );

        let boundsLeft = newTransform.left + decomposedEndDimensions.translateX - decomposedStartDimensions.translateX;
        let boundsTop = newTransform.top + decomposedEndDimensions.translateY - decomposedStartDimensions.translateY;
        let boundsWidth = newTransform.width;
        let boundsHeight = newTransform.height;
        
        // Apply snapping
        snapLineX.value = [];
        snapLineY.value = [];
        let snapXOffset = 0;
        let snapYOffset = 0;
        if (enableSnapping && this.transformShapeDragType === DRAG_TYPE_ALL && useSnapping.value && (useCanvasEdgeSnapping.value /*|| useLayerCenterSnapping.value || useLayerEdgeSnapping.value */)) {
            const boundingBoxTransform = new DOMMatrix()
                .translateSelf(boundsLeft + boundsWidth / 2, boundsTop + boundsHeight / 2)
                .rotateSelf(transformBoundsRotation.value * Math.RADIANS_TO_DEGREES)
                .translateSelf(-boundsWidth / 2, -boundsHeight / 2);
            let checkPoints: DOMPoint[] = [];
            let p0 = new DOMPoint(0, 0).matrixTransform(boundingBoxTransform);
            let p1 = new DOMPoint(newTransform.width, 0).matrixTransform(boundingBoxTransform);
            let p2 = new DOMPoint(0, newTransform.height).matrixTransform(boundingBoxTransform);
            let p3 = new DOMPoint(newTransform.width, newTransform.height).matrixTransform(boundingBoxTransform);
            if (useCanvasEdgeSnapping.value /*|| useLayerEdgeSnapping.value*/) {
                checkPoints.push(p0, p1, p2, p3);
            }
            // if (useLayerCenterSnapping.value) {
            //     checkPoints.push(new DOMPoint(
            //         (p0.x + p1.x + p2.x + p3.x) / 4,
            //         (p0.y + p1.y + p2.y + p3.y) / 4,
            //     ));
            // }

            // Determine X-axis snapping points
            let checkPointIndex: number = 0;
            checkPoints.sort((a, b) => {
                return a.x < b.x ? -1 : 1;
            });
            let snapPointIndex = 0;
            let snapPoint: SnapPointGroup;
            let snapLineXLayerPointIndex: number = 0;
            for (snapPointIndex = 0; snapPointIndex < this.snapXPoints.length; snapPointIndex++) {
                snapPoint = this.snapXPoints[snapPointIndex];
                const checkPoint = checkPoints[checkPointIndex];
                if (snapLineX.value.length > 0 && snapPoint.value !== snapLineX.value[0]) {
                    break;
                }
                if (Math.abs(snapPoint.value - checkPoint.x) <= this.snapSensitivity) {
                    if (snapLineX.value.length === 0) {
                        snapXOffset = snapPoint.value - checkPoint.x;
                        for (let pointY of snapPoint.points) {
                            snapLineX.value.push(snapPoint.value, pointY);
                        }
                        snapLineXLayerPointIndex = snapLineX.value.length;
                    }
                    snapLineX.value.push(snapPoint.value, checkPoint.y);
                    checkPointIndex++;
                    snapPointIndex--;
                } else if (checkPoint.x < snapPoint.value + this.snapSensitivity) {
                    checkPointIndex++;
                    snapPointIndex--;
                }
                if (checkPointIndex > checkPoints.length - 1) {
                    break;
                }
            }

            // Determine Y-axis snapping points
            checkPointIndex = 0;
            checkPoints.sort((a, b) => {
                return a.y < b.y ? -1 : 1;
            });
            for (snapPointIndex = 0; snapPointIndex < this.snapYPoints.length; snapPointIndex++) {
                snapPoint = this.snapYPoints[snapPointIndex];
                const checkPoint = checkPoints[checkPointIndex];
                if (snapLineY.value.length > 0 && snapPoint.value !== snapLineY.value[1]) {
                    break;
                }
                if (Math.abs(snapPoint.value - checkPoint.y) <= this.snapSensitivity) {
                    if (snapLineY.value.length === 0) {
                        snapYOffset = snapPoint.value - checkPoint.y;
                        for (let pointX of snapPoint.points) {
                            snapLineY.value.push(pointX, snapPoint.value);
                        }
                    }
                    snapLineY.value.push(checkPoint.x + snapXOffset, snapPoint.value);
                    checkPointIndex++;
                    snapPointIndex--;
                } else if (checkPoint.y < snapPoint.value + this.snapSensitivity) {
                    checkPointIndex++;
                    snapPointIndex--;
                }
                if (checkPointIndex > checkPoints.length - 1) {
                    break;
                }
            }
            for (; snapLineXLayerPointIndex < snapLineX.value.length; snapLineXLayerPointIndex += 2) {
                snapLineX.value[snapLineXLayerPointIndex + 1] += snapYOffset;
            }

            if (snapXOffset !== 0 || snapYOffset !== 0) {
                const newTopLeft = new DOMPoint(boundsLeft, boundsTop).matrixTransform(
                    new DOMMatrix().translate(snapXOffset, snapYOffset)
                );
                boundsLeft = newTopLeft.x;
                boundsTop = newTopLeft.y;
            }
        }

        // Apply the transform offset to the layer dragging bounds overlay
        drawShapeToolbarEmitter.emit('setTransformDimensions', {
            left: boundsLeft,
            top: boundsTop,
            width: newTransform.width,
            height: newTransform.height
        });

        // Apply the transform offset to each layer
        for (const [i, [layerId, shapeId]] of selectedShapes.value.entries()) {

            const { parentTransform, shapeTransform, shapeBounds } = this.transformShapeLayerData[i];
            const screenTransform = parentTransform.multiply(shapeTransform);
            const decomposedTransform = decomposeMatrix(screenTransform);
            let newScreenTransform = DOMMatrix.fromMatrix(screenTransform);
            let transformStartOriginX = 0;
            let transformStartOriginY = 0;
            let transformEndOriginX = 0;
            let transformEndOriginY = 0;
            if (shouldScaleDuringResize) {
                newScreenTransform.translateSelf(shapeBounds.left, shapeBounds.top);
                newScreenTransform.scaleSelf(1 / decomposedTransform.scaleX, 1 / decomposedTransform.scaleY);
            }
            newScreenTransform
                .rotateSelf(-(decomposedTransform.rotation) * Math.RADIANS_TO_DEGREES)
                .translateSelf(
                    (newTransform.left + snapXOffset + transformEndOriginX) - (this.transformShapeStartDimensions.left + transformStartOriginX),
                    (newTransform.top + snapYOffset + transformEndOriginY) - (this.transformShapeStartDimensions.top + transformStartOriginY),
                )
                .rotateSelf((decomposedTransform.rotation) * Math.RADIANS_TO_DEGREES)
            if (shouldScaleDuringResize) {
                newScreenTransform.scaleSelf(
                    decomposedTransform.scaleX * newTransform.width / this.transformShapeStartDimensions.width,
                    decomposedTransform.scaleY * newTransform.height / this.transformShapeStartDimensions.height
                );
                newScreenTransform.translateSelf(-shapeBounds.left, -shapeBounds.top);
            }
            this.transformShapeLayerData[i].newShapeTransform = parentTransform.inverse().multiply(newScreenTransform);
            const { a, b, c, d, e, f } = this.transformShapeLayerData[i].newShapeTransform;
            this.renderer?.updateVectorLayerAttributes(layerId, shapeId, {
                transform: `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`,
            });
        }
    }

    private async commitTransforms() {
        try {
            if (snapLineX.value.length > 0) snapLineX.value = [];
            if (snapLineY.value.length > 0) snapLineY.value = [];

            const isTranslate = transformBoundsLeft.value != this.transformShapeStartDimensions.left || transformBoundsTop.value != this.transformShapeStartDimensions.top;
            const isScale = transformBoundsWidth.value != this.transformShapeStartDimensions.width || transformBoundsHeight.value != this.transformShapeStartDimensions.height;
            const isRotate = transformBoundsRotation.value != this.transformShapeStartDimensions.rotation;

            if (isTranslate || isScale || isRotate) {
                const updateActions: UpdateVectorLayerAttributesAction[] = [];
                for (const [i, [layerId, shapeId]] of selectedShapes.value.entries()) {
                    if (!this.transformShapeLayerData[i]) continue;

                    const { a, b, c, d, e, f } = this.transformShapeLayerData[i].newShapeTransform;
                    updateActions.push(
                        new UpdateVectorLayerAttributesAction(layerId, shapeId, {
                            transform: `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`,
                        })
                    );
                }

                if (updateActions.length > 0) {
                    await historyStore.dispatch('runAction', {
                        action: new BundleAction('freeTransform', [
                            ...(isRotate ? ['action.freeTransformRotate'] : []),
                            ...(isScale ? ['action.freeTransformScale'] : []),
                            ...(isTranslate ? ['action.freeTransformTranslate'] : [])
                        ][0], updateActions)
                    });
                    this.hasUncroppedChanges = true;
                }
            }

        } catch (error) {
            console.error('[src/canvas/controllers/draw-shape.ts] Error while committing transform action. ', error);
        }
        this.transformShapeTranslateStart = null;
        this.transformShapeLayerData = [];
        this.transformShapeStartDimensions = { top: 0, left: 0, width: 0, height: 0, rotation: 0, handleToRotationOrigin: 0 };
        this.transformShapeIsRotating = false;
        this.transformShapeIsDragging = false;
    }

    private setTransformBoundsFromSelectedShapes() {
        clearTimeout(this.setTransformBoundsDebounceHandle);
        const setBoundsDebounceHandle = window.setTimeout(async () => {
            await nextTick();
            if (setBoundsDebounceHandle === this.setTransformBoundsDebounceHandle) {
                this.setTransformBoundsFromSelectedShapesImmediate();
            }
        }, 100);
        this.setTransformBoundsDebounceHandle = setBoundsDebounceHandle;
    }

    private async setTransformBoundsFromSelectedShapesImmediate() {
        if (selectedShapes.value.length === 1) {
            const [layerId, nodeId] = selectedShapes.value[0];
            const layer = getLayerById<WorkingFileVectorLayer>(layerId);
            const layerDocument = layer?.data.sourceDocument;
            const activeShapeNode = layerDocument?.querySelector(`[data-ogr-id="${nodeId}"]`);
            if (!layer || !layerDocument || !activeShapeNode) return;

            const { transform: shapeTransform, stroke, strokeWidth } = parseCommonNodeAttributes(activeShapeNode);
            const bounds = calculateShapeAabb(activeShapeNode, new DOMMatrix(), stroke ? strokeWidth : 0);
            if (!bounds) return;

            const viewBox = getViewBox(layer.data.sourceDocument);
            const nodeXf = layer.transform.scale(
                layer.width / viewBox.width, layer.height / viewBox.height, 1.0,
            ).translateSelf(
                -viewBox.x, -viewBox.y, 0.0,
            ).multiplySelf(
                shapeTransform,
            );

            const originPosX = bounds.left + (bounds.width * transformOriginX.value);
            const originPosY = bounds.top + (bounds.height * transformOriginY.value);
            const decomposedTransform = decomposeMatrix(nodeXf);
            const decomposedPositionTransform = decomposeMatrix(
                DOMMatrix.fromMatrix(nodeXf)
                .translateSelf(originPosX, originPosY)
                .scaleSelf(1 / decomposedTransform.scaleX, 1 / decomposedTransform.scaleY)
                .rotateSelf(-decomposedTransform.rotation * Math.RADIANS_TO_DEGREES)
                .scaleSelf(decomposedTransform.scaleX, decomposedTransform.scaleY)
                .translateSelf(-originPosX + bounds.left, -originPosY + bounds.top)
            );
            drawShapeToolbarEmitter.emit('setTransformDimensions', {
                left: decomposedPositionTransform.translateX,
                top: decomposedPositionTransform.translateY,
                width: bounds.width * decomposedTransform.scaleX,
                height: bounds.height * decomposedTransform.scaleY,
                rotation: decomposedTransform.rotation
            });
        }
    }

    private storeTransformShapeStart(viewTransformPoint?: DOMPoint) {
        if (!viewTransformPoint) {
            viewTransformPoint = this.getTransformedCursorInfo().viewTransformPoint;
        }
        this.transformShapeTranslateStart = viewTransformPoint;
        this.transformShapeStartDimensions = {
            top: transformBoundsTop.value,
            left: transformBoundsLeft.value,
            width: transformBoundsWidth.value,
            height: transformBoundsHeight.value,
            rotation: transformBoundsRotation.value,
            handleToRotationOrigin: 0
        };
        this.transformShapeLayerData = [];

        for (let [layerId, nodeId] of selectedShapes.value) {
            const layer = getLayerById<WorkingFileVectorLayer>(layerId);
            const layerDocument = layer?.data.sourceDocument;
            const shapeNode = layerDocument?.querySelector(`[data-ogr-id="${nodeId}"]`);

            let shapeBounds: DOMRect | null | undefined;
            let shapeTransform: DOMMatrix | undefined;
            let parentTransform: DOMMatrix | undefined;
            if (layer && shapeNode) {
                const { stroke, strokeWidth } = parseCommonNodeAttributes(shapeNode);
                shapeBounds = calculateShapeAabb(shapeNode, new DOMMatrix(), stroke ? strokeWidth : 0);
                shapeTransform = parseNodeTransform(shapeNode, { defaultDPI: 90, defaultUnit: 'px', attributeInheritance: 'disable' });
                const nodeInheritedTransform = parseNodeTransform(shapeNode, { defaultDPI: 90, defaultUnit: 'px', attributeInheritance: 'inheritedOnly' });
                const viewBox = getViewBox(layer.data.sourceDocument);
                parentTransform = layer.transform.scale(
                    layer.width / viewBox.width, layer.height / viewBox.height, 1.0,
                ).translateSelf(
                    -viewBox.x, -viewBox.y, 0.0,
                ).multiplySelf(
                    nodeInheritedTransform,
                );
            }

            this.transformShapeLayerData.push({
                shapeBounds: shapeBounds ?? new DOMRect(),
                shapeTransform: shapeTransform ?? new DOMMatrix(),
                parentTransform: parentTransform ?? new DOMMatrix(),
                newShapeTransform: shapeTransform ?? new DOMMatrix(),
            });
        }

    }

    private determineDragRotateType(viewTransformPoint: DOMPoint, transformBoundsPoint: DOMPoint, viewDecomposedTransform: DecomposedMatrix) {
        this.storeTransformShapeStart(viewTransformPoint);
        this.transformShapeIsRotating = false;
        this.transformShapeIsDragging = false;

        // Determine which dimensions to drag on
        if (this.isPointOnRotateHandle(transformBoundsPoint, viewDecomposedTransform)) {
            this.transformShapeIsRotating = true;
            transformRotateHandleHighlight.value = true;
            this.transformShapeStartDimensions.handleToRotationOrigin = Math.atan2(
                viewTransformPoint.y - (transformBoundsTop.value + (transformBoundsHeight.value * transformOriginY.value)),
                viewTransformPoint.x - (transformBoundsLeft.value + (transformBoundsWidth.value * transformOriginX.value))
            );
            this.transformShapeDragType = DRAG_TYPE_ALL;
            transformDragHandleHighlight.value = null;
        } else {
            transformRotateHandleHighlight.value = false;
            let transformDragType = this.getTransformDragType(transformBoundsPoint, viewDecomposedTransform);
            if (transformDragType != null) {
                this.transformShapeDragType = transformDragType;
            } else {
                this.transformShapeTranslateStart = null;
            }
            if (!transformDragType != null) {
                this.transformShapeIsDragging = true;
            }
            transformDragHandleHighlight.value = transformDragType;
        }
    }

    private isPointOnRotateHandle(point: DOMPoint, viewDecomposedTransform: DecomposedMatrix): boolean {
        const devicePixelRatio = window.devicePixelRatio || 1;
        this.remToPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const handleOffset = 2 * this.remToPx / viewDecomposedTransform.scaleX * devicePixelRatio;
        const handleSize = 2 * this.remToPx / viewDecomposedTransform.scaleX * devicePixelRatio;
        const halfHandleSize = handleSize / 2;
        if (
            point.x > transformBoundsLeft.value + (transformBoundsWidth.value / 2) - halfHandleSize &&
            point.x < transformBoundsLeft.value + (transformBoundsWidth.value / 2) + halfHandleSize &&
            point.y > transformBoundsTop.value - handleOffset - halfHandleSize &&
            point.y < transformBoundsTop.value - handleOffset + halfHandleSize
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
        if (point.y >= transformBoundsTop.value - handleSize - touchForgivenessMargin && point.y <= transformBoundsTop.value + innerHandleSizeVertical) {
            transformDragType |= DRAG_TYPE_TOP;
        }
        if (point.y >= transformBoundsTop.value + transformBoundsHeight.value - innerHandleSizeVertical && point.y <= transformBoundsTop.value + transformBoundsHeight.value + handleSize + touchForgivenessMargin) {
            transformDragType |= DRAG_TYPE_BOTTOM;
        }
        if (point.x >= transformBoundsLeft.value - handleSize - touchForgivenessMargin && point.x <= transformBoundsLeft.value + innerHandleSizeHorizontal) {
            transformDragType |= DRAG_TYPE_LEFT;
        }
        if (point.x >= transformBoundsLeft.value + transformBoundsWidth.value - innerHandleSizeHorizontal && point.x <= transformBoundsLeft.value + transformBoundsWidth.value + handleSize + touchForgivenessMargin) {
            transformDragType |= DRAG_TYPE_RIGHT;
        }
        if (
            point.x < transformBoundsLeft.value - handleSize - touchForgivenessMargin ||
            point.x > transformBoundsLeft.value + transformBoundsWidth.value + handleSize + touchForgivenessMargin ||
            point.y < transformBoundsTop.value - handleSize - touchForgivenessMargin ||
            point.y > transformBoundsTop.value + transformBoundsHeight.value + handleSize + touchForgivenessMargin
        ) {
            transformDragType = null;
        }
        return transformDragType;
    }

    private calculateTransformShapeSnapPoints() {
        // TODO

        this.snapXPoints = [];
        this.snapYPoints = [];

        this.snapPointsNeedToBeCalculated = false;
    }

    /*------------------*\
    |                    |
    |   Event Handling   |
    |                    |
    \*------------------*/

    private async onFillColorChanged(color?: RGBAColor) {
        if (!color) return;
        if (selectedEditControlPointIndices.value.length > 0 || selectedShapes.value.length > 0) {
            const layerNodeMap = this.getSelectedEditControlPointLayerNodeMap();

            const actions: UpdateVectorLayerAttributesAction[] = [];

            if (selectedShapes.value.length > 0) {
                for (const [layerId, nodeId] of selectedShapes.value) {
                    actions.push(new UpdateVectorLayerAttributesAction(
                        layerId,
                        nodeId,
                        {
                            fill: color.alpha > 0 ? color.style.slice(0, 7) : 'none',
                            'fill-opacity': `${color.alpha}`,
                        },
                    ));
                }
            } else {
                for (const [layerId, nodeIdSet] of layerNodeMap.entries()) {
                    for (const nodeId of Array.from(nodeIdSet)) {
                        actions.push(new UpdateVectorLayerAttributesAction(
                            layerId,
                            nodeId,
                            {
                                fill: color.alpha > 0 ? color.style.slice(0, 7) : 'none',
                                'fill-opacity': `${color.alpha}`,
                            },
                        ));
                    }
                }
            }

            await historyStore.dispatch('runAction', {
                action: new BundleAction(
                    'updateShapeFillColor',
                    'action.updateShapeFillColor',
                    actions,
                )
            });
        }
    }

    private async onStrokeColorChanged(color?: RGBAColor) {
        if (!color) return;
        if (selectedEditControlPointIndices.value.length > 0 || selectedShapes.value.length > 0) {
            const layerNodeMap = this.getSelectedEditControlPointLayerNodeMap();

            const actions: UpdateVectorLayerAttributesAction[] = [];

            if (selectedShapes.value.length > 0) {
                for (const [layerId, nodeId] of selectedShapes.value) {
                    actions.push(new UpdateVectorLayerAttributesAction(
                        layerId,
                        nodeId,
                        {
                            stroke: color.alpha > 0 ? color.style.slice(0, 7) : null,
                            'stroke-opacity': `${color.alpha}`,
                        },
                    ));
                }
            } else {
                for (const [layerId, nodeIdSet] of layerNodeMap.entries()) {
                    for (const nodeId of Array.from(nodeIdSet)) {
                        actions.push(new UpdateVectorLayerAttributesAction(
                            layerId,
                            nodeId,
                            {
                                stroke: color.alpha > 0 ? color.style.slice(0, 7) : null,
                                'stroke-opacity': `${color.alpha}`,
                            },
                        ));
                    }
                }
            }

            await historyStore.dispatch('runAction', {
                action: new BundleAction(
                    'updateShapeFillColor',
                    'action.updateShapeFillColor',
                    actions,
                )
            });
            this.setTransformBoundsFromSelectedShapesImmediate();
        }
    }

    private onStrokeWidthPreview(newStrokeWidth?: number) {
        if (newStrokeWidth == null) return;
        if (selectedEditControlPointIndices.value.length > 0 || selectedShapes.value.length > 0) {
            isTransformBoundsTransparent.value = true;
            const layerNodeMap = this.getSelectedEditControlPointLayerNodeMap();

            if (selectedShapes.value.length > 0) {
                for (const [layerId, nodeId] of selectedShapes.value) {
                    this.renderer?.updateVectorLayerAttributes(
                        layerId,
                        nodeId,
                        { 'stroke-width': `${newStrokeWidth}` },
                    );
                }
            } else {
                for (const [layerId, nodeIdSet] of layerNodeMap.entries()) {
                    for (const nodeId of Array.from(nodeIdSet)) {
                        this.renderer?.updateVectorLayerAttributes(
                            layerId,
                            nodeId,
                            { 'stroke-width': `${newStrokeWidth}` },
                        );
                    }
                }
            }
        }
    }

    private async onStrokeWidthChanged(newStrokeWidth?: number) {
        if (newStrokeWidth == null) return;
        if (selectedEditControlPointIndices.value.length > 0 || selectedShapes.value.length > 0) {
            isTransformBoundsTransparent.value = false;
            const layerNodeMap = this.getSelectedEditControlPointLayerNodeMap();

            const actions: UpdateVectorLayerAttributesAction[] = [];

            if (selectedShapes.value.length > 0) {
                for (const [layerId, nodeId] of selectedShapes.value) {
                    actions.push(new UpdateVectorLayerAttributesAction(
                        layerId,
                        nodeId,
                        { 'stroke-width': `${newStrokeWidth}` },
                    ));
                }
            } else {
                for (const [layerId, nodeIdSet] of layerNodeMap.entries()) {
                    for (const nodeId of Array.from(nodeIdSet)) {
                        actions.push(new UpdateVectorLayerAttributesAction(
                            layerId,
                            nodeId,
                            { 'stroke-width': `${newStrokeWidth}` },
                        ));
                    }
                }
            }

            await historyStore.dispatch('runAction', {
                action: new BundleAction(
                    'updateShapeStrokeWidth',
                    'action.updateShapeStrokeWidth',
                    actions,
                )
            });
            this.setTransformBoundsFromSelectedShapesImmediate();
            this.hasUncroppedChanges = true;
        }
    }

    private onHistoryStep(event?: AppEmitterEvents['editor.history.step']) {
        if (!event) return;
        if (
            event.action.id === 'createShape'
            || (event.action.id === 'createShapeLayer' && event.trigger !== 'do')
            || event.action.id === 'deleteVectorLayerShape'
            || event.action.id === 'updateDrawLayer'
            || event.action.id === 'updateEraseLayer'
            || event.action.id === 'trimLayerEmptySpace'
            || event.action.id === 'pasteShapes'
            || event.action.id === 'freeTransform'
        ) {
            this.createEditingLayersFromSelectedLayers(workingFileStore.state.selectedLayerIds, workingFileStore.state.selectedLayerIds);
        }
        if (
            event.action.id === 'deleteVectorLayerShape'
            || event.action.id === 'pasteShapes'
        ) {
            selectedShapes.value = [];
        }
        if (event.trigger !== 'do') {
            if (event.action.id === 'freeTransform') {
                nextTick(() => {
                    this.setTransformBoundsFromSelectedShapesImmediate();
                })
            } else {
                selectedShapes.value = [];
            }
            isExtendingPaths.value = false;
        }
    }

    private onCancelCurrentAction() {
        if (this.drawingPointerId != null) {
            // TODO
            previewInvisibleStrokeStart.value = null;
        } else if (this.draggingEditControlPointIndices.length > 0) {
            // TODO
        } else if (this.extendPathPointerId != null) {
            for (const { layerId, tagName, nodeId, pathStart } of this.extendPathInfo) {
                const attributes: Record<string, string> = {};
                switch (tagName) {
                    case 'polyline': case 'polygon':
                        attributes['points'] = pathStart;
                        break;
                    case 'path':
                        attributes['path'] = pathStart;
                        break;
                }
                this.renderer?.updateVectorLayerAttributes(
                    layerId,
                    nodeId,
                    attributes,
                );
            }
            this.extendPathInfo = [];
            this.extendPathPointerId = null;
            selectedEditControlPointIndices.value = [];
            selectedEditControlAttachPointIndices.value = [];
            isExtendingPaths.value = false;
        } else if (selectedShapes.value.length > 0) {
            selectedShapes.value = [];
        } else if (selectedEditControlPointIndices.value.length > 0) {
            selectedEditControlPointIndices.value = [];
            selectedEditControlAttachPointIndices.value = [];
            isExtendingPaths.value = false;
        }
    }

    private onCommitCurrentAction() {
        if (this.drawingPointerId != null) {
            // NOOP
        } else if (this.extendPathPointerId != null) {
            // NOOP
        } else if (selectedEditControlPointIndices.value.length > 0) {
            selectedEditControlPointIndices.value = [];
            selectedEditControlAttachPointIndices.value = [];
            isExtendingPaths.value = false;
        }
    }

    private async onDelete(shapesOnly?: boolean) {
        const deleteShapeMap = new Map<number, Set<string>>();
        const deletePathMap = new Map<number, Map<string, Set<number>>>();
        const originalPathAttributes = new Map<number, Map<string, Record<string, any>>>();
        const serializer = new XMLSerializer();

        if (selectedEditControlPointIndices.value.length > 0 || selectedShapes.value.length > 0) {

            const selectedIndices = selectedEditControlPointIndices.value;
            selectedEditControlPointIndices.value = [];
            selectedEditControlAttachPointIndices.value = [];
            isExtendingPaths.value = false;

            const deleteReserveToken = createHistoryReserveToken();
            await historyReserveQueueFree();
            await historyStore.dispatch('reserve', { token: deleteReserveToken });

            try {
                for (const pointIndex of selectedIndices) {
                    const point = editControlPoints.value[pointIndex];
                    if (point.attachToIndex != null) continue;

                    const node = editControlPointNodes.value[point.nodeIndex];
                    const nodeId = node.getAttribute('data-ogr-id');
                    if (!nodeId) continue;

                    if (shapesOnly || ['rect', 'circle', 'ellipse', 'line'].includes(node.tagName)) {
                        const deleteShapes = deleteShapeMap.get(point.layerIndex) ?? new Set<string>();
                        deleteShapes.add(nodeId);
                        deleteShapeMap.set(point.layerIndex, deleteShapes);

                        const deletePathShapes = deletePathMap.get(point.layerIndex);
                        deletePathShapes?.delete(nodeId);
                    } else {
                        const deleteShapes = deleteShapeMap.get(point.layerIndex);
                        if (deleteShapes?.has(nodeId)) continue;

                        const deletePathShapes = deletePathMap.get(point.layerIndex) ?? new Map<string, Set<number>>();
                        const deletePathIndices = deletePathShapes.get(nodeId) ?? new Set<number>();
                        deletePathIndices.add(point.pathIndex);
                        deletePathShapes.set(nodeId, deletePathIndices);
                        deletePathMap.set(point.layerIndex, deletePathShapes);

                        const originalPathAttributeNodes = originalPathAttributes.get(point.layerIndex) ?? new Map<string, Record<string, string>>();
                        if (!originalPathAttributeNodes.has(nodeId)) {
                            if (node.tagName === 'polyline' || node.tagName === 'polygon') {
                                originalPathAttributeNodes.set(nodeId, {
                                    points: editControlPointNodeParsedAttributes.value[point.nodeIndex].points,
                                });
                            } else if (node.tagName === 'path') {
                                originalPathAttributeNodes.set(nodeId, {
                                    d: editControlPointNodeParsedAttributes.value[point.nodeIndex].d,
                                });
                            }
                            originalPathAttributes.set(point.layerIndex, originalPathAttributeNodes);
                        }
                    }

                }

                for (const [layerId, shapeId] of selectedShapes.value) {
                    const layerIndex = editingLayers.value.findIndex((layer) => layer.id === layerId);
                    const deleteShapes = deleteShapeMap.get(layerIndex) ?? new Set<string>();
                    deleteShapes.add(shapeId);
                    deleteShapeMap.set(layerIndex, deleteShapes);

                    const deletePathShapes = deletePathMap.get(layerIndex);
                    deletePathShapes?.delete(shapeId);
                }

                const actions: BaseAction[] = [];

                // Delete the points/commands in a path
                for (const [layerIndex, pathIndexMap] of deletePathMap.entries()) {
                    const layer = editingLayers.value[layerIndex];
                    if (!layer) continue;

                    const layerDocument = await getStoredSvgDocument(layer.data.sourceUuid);
                    const newLayerDocument = layerDocument.cloneNode(true) as Document;

                    const originalAttributesByLayer = originalPathAttributes.get(layerIndex);

                    for (const [nodeId, indices] of pathIndexMap.entries()) {
                        const originalAttributes = originalAttributesByLayer?.get(nodeId);
                        if (!originalAttributes) continue;
                        const pathIndices = Array.from(indices).sort().reverse();

                        if (originalAttributes.points) {
                            const points: DOMPoint[] = originalAttributes.points.slice();
                            for (const pathIndex of pathIndices) {
                                points.splice(pathIndex, 1);
                            }
                            if (points.length < 2) {
                                const deleteShapes = deleteShapeMap.get(layerIndex) ?? new Set<string>();
                                deleteShapes.add(nodeId);
                                deleteShapeMap.set(layerIndex, deleteShapes);
                                continue;
                            }
                            const node = newLayerDocument.querySelector(`[data-ogr-id="${nodeId}"]`);
                            if (!node) continue;
                            node.setAttribute('points', points.map((point) => `${point.x},${point.y}`).join(' '));
                        } else if (originalAttributes.d) {
                            const commands: VectorPathCommand[] = originalAttributes.d.slice();
                            for (const pathIndex of pathIndices) {
                                const [removedCommand] = commands.splice(pathIndex, 1);
                                if (removedCommand?.type === VectorPathCommandType.MOVE) {
                                    const nextCommand = commands[pathIndex];
                                    if (nextCommand) {
                                        let point = new DOMPoint();
                                        switch (nextCommand.type) {
                                            case VectorPathCommandType.CUBIC_BEZIER_CURVE:
                                            case VectorPathCommandType.ELLIPTICAL_ARC:
                                            case VectorPathCommandType.LINE:
                                            case VectorPathCommandType.MOVE:
                                            case VectorPathCommandType.QUADRATIC_BEZIER_CURVE:
                                            case VectorPathCommandType.SMOOTH_CUBIC_BEZIER_CURVE:
                                            case VectorPathCommandType.SMOOTH_QUADRATIC_BEZIER_CURVE:
                                                point = new DOMPoint(nextCommand.x, nextCommand.y);
                                                break;
                                            case VectorPathCommandType.HORIZONTAL_LINE:
                                                point = new DOMPoint(nextCommand.x, removedCommand.y);
                                                break;
                                            case VectorPathCommandType.VERTICAL_LINE:
                                                point = new DOMPoint(removedCommand.x, nextCommand.y);
                                                break;
                                        }
                                        commands.splice(pathIndex, 1, {
                                            type: VectorPathCommandType.MOVE,
                                            x: point.x,
                                            y: point.y,
                                        });
                                    }
                                }
                            }
                            if (
                                commands.length < 1
                                || (
                                    commands.length === 1
                                    && (
                                        commands[0].type === VectorPathCommandType.MOVE
                                        || commands[0].type === VectorPathCommandType.CLOSE
                                    )
                                )
                            ) {
                                const deleteShapes = deleteShapeMap.get(layerIndex) ?? new Set<string>();
                                deleteShapes.add(nodeId);
                                deleteShapeMap.set(layerIndex, deleteShapes);
                                continue;
                            }
                            const node = newLayerDocument.querySelector(`[data-ogr-id="${nodeId}"]`);
                            if (!node) continue;
                            node.setAttribute('d', serializeVectorPathCommands(commands));
                        }
                    }

                    const svgString = serializer.serializeToString(newLayerDocument).replace(/xmlns=""/g, '');

                    const image = await new Promise<HTMLImageElement>((resolve) => {
                        const image = new Image();
                        image.onload = () => {
                            resolve(image);
                        };
                        image.onerror = () => {
                            resolve(image);
                        }
                        image.src = URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml' }));
                    });

                    actions.push(new UpdateLayerAction<UpdateVectorLayerOptions>(
                        {
                            id: layer.id,
                            data: {
                                sourceUuid: await createStoredSvg(image),
                            },
                        },
                    ));
                }

                // Delete an entire shape
                for (const [layerIndex, nodeIds] of deleteShapeMap.entries()) {
                    const layer = editingLayers.value[layerIndex];
                    if (!layer) continue;

                    const layerDocument = await getStoredSvgDocument(layer.data.sourceUuid);
                    const newLayerDocument = layerDocument.cloneNode(true) as Document;

                    for (const nodeId of Array.from(nodeIds)) {
                        newLayerDocument.querySelector(`[data-ogr-id="${nodeId}"]`)?.remove();
                    }
                    generateSvgElementIds(newLayerDocument);

                    const svgString = serializer.serializeToString(newLayerDocument).replace(/xmlns=""/g, '');

                    const image = await new Promise<HTMLImageElement>((resolve) => {
                        const image = new Image();
                        image.onload = () => {
                            resolve(image);
                        };
                        image.onerror = () => {
                            resolve(image);
                        }
                        image.src = URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml' }));
                    });

                    actions.push(new UpdateLayerAction<UpdateVectorLayerOptions>(
                        {
                            id: layer.id,
                            data: {
                                sourceUuid: await createStoredSvg(image),
                            },
                        },
                    ));
                }

                if (actions.length > 0) {
                    await historyStore.dispatch('runAction', {
                        action: new BundleAction('deleteVectorLayerShape', 'action.deleteVectorLayerShape', actions),
                        reserveToken: deleteReserveToken,
                    });
                    this.hasUncroppedChanges = true;
                } else {
                    await historyStore.dispatch('unreserve', { token: deleteReserveToken });
                }
            } catch (error) {
                console.error('[src/canvas/controllers/draw-shape.ts] Error when deleting shapes ', error);
                await historyStore.dispatch('unreserve', { token: deleteReserveToken });
            }

        }
    }

    private async onCopy(event?: AppEmitterEvents['editor.tool.copySelectedLayers']) {
        if (!event) return;
        if (selectedEditControlPointIndices.value.length > 0 || selectedShapes.value.length > 0) {
            event.preventDefault();

            this.copiedShapes = [];
            this.currentCopiedShapesPasteCount = 0;

            const copyShapeMap = new Map<number, Set<number>>();

            if (selectedShapes.value.length > 0) {
                for (const [layerId, shapeId] of selectedShapes.value) {
                    const layerIndex = editingLayers.value.findIndex((layer) => layer.id === layerId);
                    const nodeIndex = editControlPointNodes.value.findIndex((node) => node.getAttribute('data-ogr-id') === shapeId);
                    if (layerIndex < 0 || nodeIndex < 0) continue;

                    const copyShapes = copyShapeMap.get(layerIndex) ?? new Set<number>();
                    copyShapes.add(nodeIndex);
                    copyShapeMap.set(layerIndex, copyShapes);
                }
            } else {
                const selectedIndices = selectedEditControlPointIndices.value;
                for (const pointIndex of selectedIndices) {
                    const point = editControlPoints.value[pointIndex];
                    if (point.attachToIndex != null) continue;

                    const copyShapes = copyShapeMap.get(point.layerIndex) ?? new Set<number>();
                    copyShapes.add(point.nodeIndex);
                    copyShapeMap.set(point.layerIndex, copyShapes);
                }
            }

            for (const [layerIndex, nodeIndices] of copyShapeMap.entries()) {
                const layer = editingLayers.value[layerIndex];
                if (!layer) continue;

                const svgDocument = layer.data.sourceDocument ?? await getStoredSvgDocument(layer.data.sourceUuid);
                const svgTransform = parseNodeTransform(svgDocument.documentElement);

                for (const nodeIndex of Array.from(nodeIndices)) {
                    const node = editControlPointNodes.value[nodeIndex];
                    const { transform: nodeTransform } = editControlPointNodeParsedAttributes.value[nodeIndex];

                    const attributes: Record<string, string> = {};
                    for (const attribute of Array.from(node.attributes)) {
                        attributes[attribute.name] = attribute.value;
                    }

                    this.copiedShapes.push({
                        tagName: node.tagName,
                        attributes,
                        transform: svgTransform.inverse().multiply(nodeTransform),
                    });
                }
            }
        }
    }

    private async onCut(event?: AppEmitterEvents['editor.tool.cutSelectedLayers']) {
        if (!event) return;
        if (selectedEditControlPointIndices.value.length > 0 || selectedShapes.value.length > 0) {
            event.preventDefault();
            this.onCopy(event);
            this.onDelete(true);
            this.currentCopiedShapesPasteCount = -1;
        }
    }

    private async onPaste(event?: AppEmitterEvents['editor.tool.paste']) {
        if (!event) return;

        if (this.copiedShapes.length > 0) {
            event.preventDefault();
            this.currentCopiedShapesPasteCount++;
            if (this.currentCopiedShapesPasteCount >= 6) this.currentCopiedShapesPasteCount = 1;

            const zoom = canvasStore.state.decomposedTransform.scaleX;
            const newLayerOffset = Math.max(10,
                Math.round(((1 / (zoom || 0.00001)) * (window.innerHeight / 20)) / 10) * 10
            ) * this.currentCopiedShapesPasteCount;

            const serializer = new XMLSerializer();

            const layerActions: BaseAction[] = [];

            for (const layer of editingLayers.value) {
                const layerDocument = await getStoredSvgDocument(layer.data.sourceUuid);
                const svgTransform = parseNodeTransform(layerDocument.documentElement);

                const newLayerDocument = layerDocument.cloneNode(true) as Document;

                for (const { tagName, attributes, transform } of this.copiedShapes) {
                    const newTransform = new DOMMatrix()
                        .translateSelf(newLayerOffset, newLayerOffset)
                        .multiply(transform).multiply(svgTransform);

                    const element = newLayerDocument.createElement(tagName);
                    for (const attributeName in attributes) {
                        element.setAttribute(attributeName, attributes[attributeName]);
                    }
                    element.setAttribute('transform', `matrix(${newTransform.a} ${newTransform.b} ${newTransform.c} ${newTransform.d} ${newTransform.e} ${newTransform.f})`);
                    newLayerDocument.documentElement.append(element);

                    const elementId = element.getAttribute('data-ogr-id');
                    if (elementId) {
                    if (!layer.data.pendingSourceDocumentUpdateNodeIds) {
                            layer.data.pendingSourceDocumentUpdateNodeIds = [];
                        }
                        layer.data.pendingSourceDocumentUpdateNodeIds.push(elementId);
                    }
                }

                generateSvgElementIds(newLayerDocument);
                const svgString = serializer.serializeToString(newLayerDocument).replace(/xmlns=""/g, '');

                const image = await new Promise<HTMLImageElement>((resolve) => {
                    const image = new Image();
                    image.onload = () => {
                        resolve(image);
                    };
                    image.onerror = () => {
                        resolve(image);
                    }
                    image.src = URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml' }));
                });

                layerActions.push(new UpdateLayerAction<UpdateVectorLayerOptions>(
                    {
                        id: layer.id,
                        data: {
                            sourceUuid: await createStoredSvg(image),
                        },
                    },
                ));
            }

            await historyStore.dispatch('runAction', {
                action: new BundleAction('pasteShapes', 'action.pasteShapes', layerActions),
            });
            this.hasUncroppedChanges = true;
        }

    }

    private async autoCrop() {
        if (this.hasUncroppedChanges) {
            this.hasUncroppedChanges = false;
            const actions: BaseAction[] = [];
            for (const layer of editingLayers.value) {
                if (layer.type !== 'vector') continue;
                actions.push(new TrimLayerEmptySpaceAction(layer.id));
            }
            if (actions.length > 0) {
                await historyStore.dispatch('runAction', {
                    action: new BundleAction('trimLayerEmptySpace', 'action.trimLayerEmptySpace', actions),
                    // This seems to cause bugs with inconsistent positioning after undo, maybe it's a race condition
                    // mergeWithHistory: [
                    //     'createShapeLayer',
                    //     'createShape',
                    //     'moveVectorLayerControlPoints',
                    //     'updateShapeFillColor',
                    //     'updateShapeStrokeWidth',
                    //     'deleteVectorLayerShape',
                    // ],
                });
            }
        }
    }

    /*-------------------*\
    |                     |
    |   General Utility   |
    |                     |
    \*-------------------*/

    private isReadyForPathExtension(): boolean {
        let tagName: string | null = null;
        let maxPathIndices = new Map<string, number>();
        for (let point of editControlPoints.value) {
            const mapEntry = maxPathIndices.get(`${point.layerIndex}_${point.nodeIndex}`);
            if (
                (!mapEntry || point.pathIndex > mapEntry)
                && point.attachToIndex == null
            ) {
                maxPathIndices.set(`${point.layerIndex}_${point.nodeIndex}`, point.pathIndex);
            }
        }
        if (selectedEditControlPointIndices.value.length === 0) return false;
        for (let selectedIndex of selectedEditControlPointIndices.value) {
            const { layerIndex, nodeIndex, pathIndex } = editControlPoints.value[selectedIndex];
            const node = editControlPointNodes.value[nodeIndex];
            if (tagName == null) {
                tagName = node.tagName;
            } else if (tagName !== node.tagName) {
                return false;
            }
            const maxIndex = maxPathIndices.get(`${layerIndex}_${nodeIndex}`);
            if (pathIndex !== maxIndex) return false;
        }
        return ['polyline', 'polygon', 'path'].includes(tagName!);
    }

    private selectExtendPathNodes(
        tagName: string,
        drawingShapes: DrawingShape[] = [],
        extendPathInfo: ExtendPathInfo[] = [],
    ) {
        if (['polyline', 'polygon', 'path'].includes(tagName)) {
            const unwatch = watch(() => editControlPoints.value, selectExtendedControlPoints);
            const timeoutHandle = window.setTimeout(selectExtendedControlPoints, 100);
            function selectExtendedControlPoints() {
                unwatch();
                window.clearTimeout(timeoutHandle);

                let isExtendingPathsContinue: boolean | null = extendPathInfo.length > 0 ? false : null;

                const greatestIndices = new Map<string, { pointIndex: number, pathIndex: number }>();

                for (const [pointIndex, { layerIndex, nodeIndex, pathIndex, attachToIndex }] of editControlPoints.value.entries()) {
                    const pointLayer = editingLayers.value[layerIndex];
                    const pointNode = editControlPointNodes.value[nodeIndex];
                    const pointNodeId = pointNode.getAttribute('data-ogr-id');

                    for (const { layer, element } of drawingShapes) {
                        if (pointLayer.id !== layer.id) continue;
                        const elementId = element.getAttribute('data-ogr-id');
                        if (pointNodeId !== elementId) continue;
                        const currentGreatestIndex = greatestIndices.get(`${layer.id}_${elementId}`);
                        if (
                            (!currentGreatestIndex || currentGreatestIndex.pathIndex < pathIndex)
                            && attachToIndex == null
                        ) {
                            greatestIndices.set(`${layer.id}_${elementId}`, {
                                pointIndex,
                                pathIndex,
                            });
                        }
                    }

                    for (const { layerId, nodeId } of extendPathInfo) {
                        if (pointLayer.id !== layerId) continue;
                        if (pointNodeId !== nodeId) continue;
                        const currentGreatestIndex = greatestIndices.get(`${layerId}_${nodeId}`);
                        if (
                            (!currentGreatestIndex || currentGreatestIndex.pathIndex < pathIndex)
                            && attachToIndex == null
                        ) {
                            greatestIndices.set(`${layerId}_${nodeId}`, {
                                pointIndex,
                                pathIndex,
                            });
                        }
                    }
                }

                selectedEditControlPointIndices.value = [];
                selectedEditControlAttachPointIndices.value = [];
                for (const { pointIndex } of greatestIndices.values()) {
                    selectedEditControlPointIndices.value.push(pointIndex);
                }
                if (selectedEditControlPointIndices.value.length > 0) {
                    isExtendingPathsContinue = true;
                }
                if (isExtendingPathsContinue != null) {
                    isExtendingPaths.value = isExtendingPathsContinue;
                }
            }
        }

    }

    private async createEditingLayersFromSelectedLayers(newIds: number[], oldIds?: number[]) {
        if (this.drawingPointerId != null) return;

        let hasSelectedLayerListChanged = false;
        if (newIds.length !== oldIds?.length) {
            hasSelectedLayerListChanged = true;
        } else {
            for (let i = 0; i < newIds.length; i++) {
                if (newIds[i] !== oldIds[i]) {
                    hasSelectedLayerListChanged = true;
                    break;
                }
            }
        }

        if (hasSelectedLayerListChanged) {
            await this.autoCrop();
            if (!['colorPicker', 'opacity'].includes(editorStore.state.activeToolPrevious!)) {
                selectedEditControlPointIndices.value = [];
                selectedEditControlAttachPointIndices.value = [];
            }
            selectedShapes.value = [];
            isExtendingPaths.value = false;
        }

        getSelectedLayers<WorkingFileVectorLayer>(oldIds).filter(
            layer => layer.type === 'vector'
        ).forEach((layer) => {
            delete layer.data.sourceDocument;
        });

        this.selectedLayers = getSelectedLayers<WorkingFileVectorLayer>(newIds).filter(
            layer => layer.type === 'vector'
        );
        for (const layer of this.selectedLayers) {
            getStoredSvgDocument(layer.data.sourceUuid).then((document) => {
                layer.data.pendingSourceDocumentUpdateNodeIds = [];
                layer.data.sourceDocument = document;
            });
        }
        editingLayers.value = this.selectedLayers.slice();
        this.updateToolbarFromEditingLayers();
    }

    private updateToolbarFromEditingLayers() {
        if (editingLayers.value.length > 0) {
            
        }
    }

    private getTransformedCursorInfo(): { viewTransformPoint: DOMPoint, transformBoundsPoint: DOMPoint, viewDecomposedTransform: DecomposedMatrix } {
        const devicePixelRatio = window.devicePixelRatio || 1;
        const viewTransform = canvasStore.get('transform');
        const viewDecomposedTransform = canvasStore.get('decomposedTransform');
        const viewTransformPoint = new DOMPoint(this.lastCursorX * devicePixelRatio, this.lastCursorY * devicePixelRatio)
            .matrixTransform(viewTransform.inverse());
        
        const originTranslateX = transformBoundsLeft.value + (transformOriginX.value * transformBoundsWidth.value);
        const originTranslateY = transformBoundsTop.value + (transformOriginY.value * transformBoundsHeight.value);
        const boundsTransform =
            new DOMMatrix()
            .translateSelf(originTranslateX, originTranslateY)
            .rotateSelf(transformBoundsRotation.value * Math.RADIANS_TO_DEGREES)
            .translateSelf(-originTranslateX, -originTranslateY);
        const transformBoundsPoint =
            new DOMPoint(this.lastCursorX * devicePixelRatio, this.lastCursorY * devicePixelRatio)
            .matrixTransform(viewTransform.inverse())
            .matrixTransform(boundsTransform.inverse());
        return {
            viewTransformPoint,
            transformBoundsPoint,
            viewDecomposedTransform,
        };
    }

    protected handleCursorIcon() {
        let newIcon = super.handleCursorIcon();
        if (!newIcon) {
            if (selectedShapes.value.length > 0) {
                const decomposedViewTransform = canvasStore.get('decomposedTransform');
                const dragHandle = transformDragHandleHighlight.value;
                newIcon = 'crosshair';
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
                    handleRotation += this.previewTransformRotation ?? transformBoundsRotation.value;
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
                const rotateHandle = transformRotateHandleHighlight.value;
                if (rotateHandle === true) {
                    let handleRotation = 0;
                    handleRotation += this.previewTransformRotation ?? transformBoundsRotation.value;
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
            } else if (hoveringEditControlPointIndices.value.length > 0) {
                newIcon = 'grabbing';
            } else {
                newIcon = 'crosshair';
            }
        }
        canvasStore.set('cursor', newIcon);
        return newIcon;
    }
}
