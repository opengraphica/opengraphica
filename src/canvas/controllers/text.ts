import { watch, type WatchStopHandle, watchEffect } from 'vue';
import { v4 as uuidv4 } from 'uuid';

import { SelectLayersAction } from '@/actions/select-layers';
import { UpdateLayerAction } from '@/actions/update-layer';
import { BundleAction } from '@/actions/bundle';

import BaseCanvasMovementController from './base-movement';
import canvasStore from '@/store/canvas';

import { decomposeMatrix } from '@/lib/dom-matrix';
import { isInput } from '@/lib/events';
import { rotateDirectionVector2d } from '@/lib/math';
import { TextDocumentEditor, TextDocumentSelection, TextDocumentEditorWithSelection } from '@/lib/text-editor';
import { calculateTextPlacement } from '@/lib/text-render';

import historyStore from '@/store/history';
import workingFileStore, { getLayerById, getLayerGlobalTransform, getLayersByType, getSelectedLayers } from '@/store/working-file';

import {
    isEditorTextareaFocused, editingTextLayerId, editingRenderTextPlacement, editingTextDocumentSelection, dragHandleHighlight,
} from '../store/text-state';

import type { UpdateTextLayerOptions, WorkingFileTextLayer, TextDocument } from '@/types';
import type { PointerTracker } from './base';
import type { DecomposedMatrix } from '@/lib/dom-matrix';
import appEmitter from '@/lib/emitter';

const DRAG_TYPE_ALL = 0;
const DRAG_TYPE_TOP = 1;
const DRAG_TYPE_BOTTOM = 2;
const DRAG_TYPE_LEFT = 4;
const DRAG_TYPE_RIGHT = 8;

export default class CanvasTextController extends BaseCanvasMovementController {

    private dragStartPickLayer: number | null = null;
    private dragStartPosition: DOMPoint | null = null;
    private transformIsDragging: boolean = false;
    private editingLayerTransformStart: DOMMatrix | null = null;
    private editingLayerDocumentStart: TextDocument | null = null;
    private editingLayerWidthStart: number | null = null;
    private editingLayerHeightStart: number | null = null;

    private editorTextarea: HTMLTextAreaElement | null = null;
    private editorTextareaId: string = 'textControllerKeyboardInput' + uuidv4();
    private isEditorTextareaComposing: boolean = false;

    private layerEditors: Map<number, { documentEditor: TextDocumentEditor, documentSelection: TextDocumentSelection }> = new Map();
    private editingLayer: WorkingFileTextLayer | null = null;
    private isHoveringLayerHorizontal: boolean = true;

    private selectedLayerIdsUnwatch: WatchStopHandle | null = null;
    private editingLayerIdUnwatch: WatchStopHandle | null = null;

    onEnter(): void {
        super.onEnter();

        this.createEditorTextarea();

        // Create text editor instances for currently selected layers.
        this.selectedLayerIdsUnwatch = watch(() => workingFileStore.state.selectedLayerIds, (newIds, oldIds) => {
            for (const oldId of oldIds ?? []) {
                try {
                    const editors = this.layerEditors.get(oldId);
                    if (editors) {
                        const { documentEditor, documentSelection } = editors;
                        documentEditor.dispose();
                        documentSelection.dispose();
                        this.layerEditors.delete(oldId);
                    }
                } catch (error) { /* Ignore */ }
            }
            newIds = newIds ?? [];
            for (const newId of newIds) {
                const layer = getLayerById(newId);
                if (layer?.type === 'text') {
                    const documentEditor = new TextDocumentEditor(layer.data);
                    documentEditor.onNotifyChange(() => {
                        if (editingTextLayerId.value === newId) {
                            let isHorizontal = ['ltr', 'rtl'].includes(layer.data.lineDirection);
                            editingRenderTextPlacement.value = calculateTextPlacement(layer.data, {
                                wrapSize: isHorizontal ? layer.width : layer.height,
                            });
                        }
                    });
                    const documentSelection = new TextDocumentSelection(documentEditor);
                    documentSelection.onNotifyChange(() => {
                        if (editingTextLayerId.value === newId) {
                            editingTextDocumentSelection.value = documentSelection.getSelectionState();
                        }
                    });
                    this.layerEditors.set(newId, {
                        documentEditor,
                        documentSelection,
                    });
                }
            }
            if (!newIds.includes(editingTextLayerId.value as number)) {
                editingTextLayerId.value = newIds[0] ?? null;
            }
        }, { immediate: true });

        this.editingLayerIdUnwatch = watch(() => editingTextLayerId.value, (id) => {
            if (id == null) return;
            this.editingLayer = getLayerById(id) as WorkingFileTextLayer;
        }, { immediate: true });
        
        this.onFontsLoaded = this.onFontsLoaded.bind(this);
        appEmitter.on('editor.tool.fontsLoaded', this.onFontsLoaded);
        
    }

    onLeave(): void {
        this.destroyEditorTextarea();
        editingTextLayerId.value = null;

        appEmitter.off('editor.tool.fontsLoaded', this.onFontsLoaded);

        this.selectedLayerIdsUnwatch?.();
        this.editingLayerIdUnwatch?.();
    }

    private onFontsLoaded() {
        if (editingTextLayerId.value != null) {
            if (!this.editingLayer) return;
            let isHorizontal = ['ltr', 'rtl'].includes(this.editingLayer.data.lineDirection);
            editingRenderTextPlacement.value = calculateTextPlacement(this.editingLayer.data, {
                wrapSize: isHorizontal ? this.editingLayer.width : this.editingLayer.height,
            });
        }
    }

    private createEditorTextarea() {
        // Need a textarea in order to listen for keyboard inputs in an accessible, multi-platform independent way
        this.editorTextarea = document.createElement('textarea');
        this.editorTextarea.id = this.editorTextareaId;
        this.editorTextarea.setAttribute('autocorrect', 'off');
        this.editorTextarea.setAttribute('autocapitalize', 'off');
        this.editorTextarea.setAttribute('autocomplete', 'off');
        this.editorTextarea.setAttribute('spellcheck', 'false');
        this.editorTextarea.setAttribute('style', `position: absolute; top: 0; left: 0; padding: 0; width: 1px; height: 1px; background: transparent; border: none; outline: none; color: transparent; opacity: 0.01; pointer-events: none;`);
        document.body.appendChild(this.editorTextarea);

        this.onFocusEditorTextarea = this.onFocusEditorTextarea.bind(this);
        this.editorTextarea.addEventListener('focus', this.onFocusEditorTextarea, true);
        this.onBlurEditorTextarea = this.onBlurEditorTextarea.bind(this);
        this.editorTextarea.addEventListener('blur', this.onBlurEditorTextarea, true);
        this.onCompositionStartEditorTextarea = this.onCompositionStartEditorTextarea.bind(this);
        this.editorTextarea.addEventListener('compositionstart', this.onCompositionStartEditorTextarea, true);
        this.onCompositionUpdateEditorTextarea = this.onCompositionUpdateEditorTextarea.bind(this);
        this.editorTextarea.addEventListener('compositionupdate', this.onCompositionUpdateEditorTextarea, true);
        this.onCompositionEndEditorTextarea = this.onCompositionEndEditorTextarea.bind(this);
        this.editorTextarea.addEventListener('compositionend', this.onCompositionEndEditorTextarea, true);
        this.onInputEditorTextarea = this.onInputEditorTextarea.bind(this);
        this.editorTextarea.addEventListener('input', this.onInputEditorTextarea, true);
        this.onKeydownEditorTextarea = this.onKeydownEditorTextarea.bind(this);
        this.editorTextarea.addEventListener('keydown', this.onKeydownEditorTextarea, true);
    }

    private destroyEditorTextarea() {
        this.editorTextarea?.removeEventListener('focus', this.onFocusEditorTextarea, true);
        this.editorTextarea?.removeEventListener('blur', this.onBlurEditorTextarea, true);
        this.editorTextarea?.removeEventListener('compositionstart', this.onCompositionStartEditorTextarea, true);
        this.editorTextarea?.removeEventListener('compositionupdate', this.onCompositionUpdateEditorTextarea, true);
        this.editorTextarea?.removeEventListener('compositionend', this.onCompositionEndEditorTextarea, true);
        this.editorTextarea?.removeEventListener('input', this.onInputEditorTextarea, true);
        this.editorTextarea?.removeEventListener('keydown', this.onKeydownEditorTextarea, true);
        this.editorTextarea?.parentNode?.removeChild(this.editorTextarea);
        this.editorTextarea = null;
    }

    private onFocusEditorTextarea() {
        isEditorTextareaFocused.value = true;
        if (editingTextLayerId.value != null) {
            const editors = this.layerEditors.get(editingTextLayerId.value);
            if (editors) {
                const { documentSelection } = editors;
                const layer = getLayerById(editingTextLayerId.value) as WorkingFileTextLayer;
                if (layer) {
                    let isHorizontal = ['ltr', 'rtl'].includes(layer.data.lineDirection);
                    editingRenderTextPlacement.value = calculateTextPlacement(layer.data, {
                        wrapSize: isHorizontal ? layer.width : layer.height,
                    });
                }
                editingTextDocumentSelection.value = documentSelection.getSelectionState();
            }
        }
    }

    private onBlurEditorTextarea() {
        isEditorTextareaFocused.value = false;
        // TODO - update layer in history
    }

    private onCompositionStartEditorTextarea(event: CompositionEvent) {
        this.isEditorTextareaComposing = true;
        // TODO
    }

    private onCompositionUpdateEditorTextarea(event: CompositionEvent) {
        // TODO
    }

    private onCompositionEndEditorTextarea(event: CompositionEvent) {
        this.isEditorTextareaComposing = false;
        // TODO
    }

    private onInputEditorTextarea(event: Event) {
        if (editingTextLayerId.value == null) return;
        if (!this.isEditorTextareaComposing) {
            const editors = this.layerEditors.get(editingTextLayerId.value);
            if (!editors || !this.editorTextarea) return;
            const { documentEditor, documentSelection } = editors;
            TextDocumentEditorWithSelection.insertTextAtCurrentPosition(documentEditor, documentSelection, this.editorTextarea.value);
            this.editorTextarea.value = '';
            // this.extendFixedBounds(editingTextLayerId.value);
        }
    };

    private onKeydownEditorTextarea(event: KeyboardEvent) {
        if (editingTextLayerId.value == null) return;
        const editors = this.layerEditors.get(editingTextLayerId.value);
        if (!editors) return;
        let handled = true;
        const { documentEditor, documentSelection } = editors;
        switch (event.key) {
            case 'Backspace':
                TextDocumentEditorWithSelection.deleteCharacterAtCurrentPosition(documentEditor, documentSelection, false);
                break;
            case 'Delete':
                TextDocumentEditorWithSelection.deleteCharacterAtCurrentPosition(documentEditor, documentSelection, true);
                break;
            case 'Home':
                documentSelection.moveLineStart(event.shiftKey);
                break;
            case 'End':
                documentSelection.moveLineEnd(event.shiftKey);
                break;
            case 'Left': case 'ArrowLeft':
            case 'Right': case 'ArrowRight':
            case 'Up': case 'ArrowUp':
            case 'Down': case 'ArrowDown':
                let mappedKey = {
                    'Left': 'ArrowLeft',
                    'Right': 'ArrowRight',
                    'Up': 'ArrowUp',
                    'Down': 'ArrowDown',
                }[event.key as string] ?? event.key;
                let finalKey = mappedKey;
                const lineDirection = documentEditor.document.lineDirection;
                const wrapDirection = documentEditor.document.wrapDirection;
                if (lineDirection === 'rtl') {
                    if (mappedKey === 'ArrowLeft') finalKey = 'ArrowRight';
                    else if (mappedKey === 'ArrowRight') finalKey = 'ArrowLeft';
                } else if (lineDirection === 'ttb') {
                    if (mappedKey === 'ArrowUp') finalKey = 'ArrowLeft';
                    else if (mappedKey === 'ArrowDown') finalKey = 'ArrowRight';
                } else if (lineDirection === 'btt') {
                    if (mappedKey === 'ArrowUp') finalKey = 'ArrowRight';
                    else if (mappedKey === 'ArrowDown') finalKey = 'ArrowLeft';
                }
                if (['ltr', 'rtl'].includes(lineDirection)) {
                    if (wrapDirection === 'btt') {
                        if (mappedKey === 'ArrowUp') finalKey = 'ArrowDown';
                        else if (mappedKey === 'ArrowDown') finalKey = 'ArrowUp';
                    }
                } else { // ttb / btt
                    if (wrapDirection === 'ltr') {
                        if (mappedKey === 'ArrowLeft') finalKey = 'ArrowUp';
                        else if (mappedKey === 'ArrowRight') finalKey = 'ArrowDown';
                    } else { // rtl
                        if (mappedKey === 'ArrowLeft') finalKey = 'ArrowDown';
                        else if (mappedKey === 'ArrowRight') finalKey = 'ArrowUp';
                    }
                }

                if (finalKey === 'ArrowLeft') {
                    if (!event.shiftKey && !documentSelection.isEmpty()) {
                        documentSelection.isActiveSideEnd = false;
                        documentSelection.moveCharacterPrevious(0, false);
                    } else if (event.ctrlKey) {
                        documentSelection.moveWordPrevious(event.shiftKey);
                    } else {
                        documentSelection.moveCharacterPrevious(1, event.shiftKey);
                    }
                }
                else if (finalKey === 'ArrowRight') {
                    if (!event.shiftKey && !documentSelection.isEmpty()) {
                        documentSelection.isActiveSideEnd = true;
                        documentSelection.moveCharacterNext(0, false);
                    } else if (event.ctrlKey) {
                        documentSelection.moveWordNext(event.shiftKey);
                    } else {
                        documentSelection.moveCharacterNext(1, event.shiftKey);
                    }
                }
                else if (finalKey === 'ArrowUp') {
                    documentSelection.moveLinePrevious(1, event.shiftKey);
                }
                else if (finalKey === 'ArrowDown') {
                    documentSelection.moveLineNext(1, event.shiftKey);
                }
                break;
            case 'a':
                if (event.ctrlKey) {
                    documentSelection.setPosition(0, 0);
                    const lastLine = documentEditor.getLineCount() - 1;
                    documentSelection.setPosition(lastLine, documentEditor.getLineCharacterCount(lastLine), true);
                    break;
                }
            case 'b':
                if (event.ctrlKey) {
                    event.preventDefault();
                    // TODO - toggle bold
                    break;
                }
            case 'c':
                if (event.ctrlKey) {
                    event.preventDefault();
                    if (this.editorTextarea) {
                        this.editorTextarea.value = documentSelection.getText();
                        this.editorTextarea.select();
                        this.editorTextarea.setSelectionRange(0, 99999);
                        document.execCommand('copy'); // TODO - use new API
                        this.editorTextarea.value = '';
                    }
                    break;
                }
            case 'i':
                if (event.ctrlKey) {
                    event.preventDefault();
                    // TODO - toggle oblique / italics
                    break;
                }
            case 'u':
                if (event.ctrlKey) {
                    event.preventDefault();
                    // TODO - toggle underline
                    break;
                }
            case 'x':
                if (event.ctrlKey) {
                    event.preventDefault();
                    if (this.editorTextarea) {
                        this.editorTextarea.value = documentSelection.getText();
                        this.editorTextarea.select();
                        this.editorTextarea.setSelectionRange(0, 99999);
                        document.execCommand('copy'); // TODO - use new API
                        this.editorTextarea.value = '';

                        // Delete selection
                        TextDocumentEditorWithSelection.deleteSelection(documentEditor, documentSelection);
                    }
                    break;
                }
            default:
                handled = false;
        }
        if (handled) {
            canvasStore.set('dirty', true);
            // TODO - update tool selection GUI?
        }
        // this.extendFixedBounds(editingTextLayerId.value);
        return !handled;
    }

    onMultiTouchDown() {
        super.onMultiTouchDown();
        if (this.touches.length === 1) {
            this.onDragStart(this.touches[0]);
        }
    }

    onPointerDown(e: PointerEvent): void {
        super.onPointerDown(e);
        if (isInput(e.target)) return;
        if (e.isPrimary && ['mouse', 'pen'].includes(e.pointerType) && e.button === 0) {
            const pointer = this.pointers.filter((pointer) => pointer.id === e.pointerId)[0];
            this.onDragStart(pointer);
        }
        setTimeout(() => {
            this.handleCursorIcon();
        }, 0);
    }

    onPointerMove(e: PointerEvent): void {
        super.onPointerMove(e);
        const pointer = this.pointers.filter((pointer) => pointer.id === e.pointerId)[0];
        const isDragging = pointer && pointer.down.button === 0 && pointer.isDragging;
        if (isDragging) {
            this.onDragMove(pointer);
        } else {
            this.onCursorHover(e);
        }
        this.handleCursorIcon();
    }

    onPointerUp(e: PointerEvent): void {
        super.onPointerUp(e);
        if (e.isPrimary) {
            this.onDragEnd();    
        }
        this.handleCursorIcon();
    }

    private onDragStart(pointer: PointerTracker) {
        let { viewTransformPoint, transformBoundsPoint } = this.getTransformedCursorInfo(pointer.down.pageX, pointer.down.pageY);
        const dragStartPickLayer = this.pickLayer(viewTransformPoint);
        this.dragStartPickLayer = dragStartPickLayer;
        this.dragStartPosition = viewTransformPoint;

        if (dragStartPickLayer != null && !workingFileStore.state.selectedLayerIds.includes(dragStartPickLayer)) {
            historyStore.dispatch('runAction', {
                action: new SelectLayersAction([dragStartPickLayer])
            });
        }

        // Figure out which resize/rotate handles were clicked on, or if clicked in empty space just to drag
        this.determineDragType(transformBoundsPoint);
        this.editingLayerTransformStart = null;
        this.editingLayerDocumentStart = null;
        this.editingLayerWidthStart = null;
        this.editingLayerHeightStart = null;

        if (this.transformIsDragging) {
            // Pointer resizes / moves text layer.
            if (editingTextLayerId.value == null || this.editingLayer == null) return;
            this.editingLayerTransformStart = new DOMMatrix().multiply(this.editingLayer.transform);
            this.editingLayerDocumentStart = JSON.parse(JSON.stringify(this.editingLayer.data)) as TextDocument;
            this.editingLayerWidthStart = this.editingLayer.width;
            this.editingLayerHeightStart = this.editingLayer.height;
        } else {
            // Pointer manipulates text selection.
            // Wait and then assign focus, because the browser immediately focuses on clicked element.
            setTimeout(() => {
                // Focus active editor
                if (dragStartPickLayer != null) {
                    editingTextLayerId.value = dragStartPickLayer;
                    this.editorTextarea?.focus();
                }

                // Set cursor position based on pointer position
                if (editingTextLayerId.value == null) return;
                const editors = this.layerEditors.get(editingTextLayerId.value);
                if (!editors || !this.editorTextarea) return;
                const { documentSelection } = editors;
                const cursorPosition = this.getEditorCursorAtPoint(viewTransformPoint);
                documentSelection.setPosition(cursorPosition.line, cursorPosition.character);
            }, 0);
        }
    }

    private onDragMove(pointer: PointerTracker) {
        const pageX = pointer.move?.pageX ?? 0;
        const pageY = pointer.move?.pageY ?? 0;
        const { viewTransformPoint } = this.getTransformedCursorInfo(pageX, pageY);
        if (editingTextLayerId.value == null) return;
        if (this.transformIsDragging) {
            if (!this.editingLayerTransformStart || this.editingLayerWidthStart == null || this.editingLayerHeightStart == null || this.editingLayer == null || this.dragStartPosition == null) return;
            const dragHandle = dragHandleHighlight.value;
            const decomposedViewTransform = canvasStore.get('decomposedTransform');
            const textLayerTransform = getLayerGlobalTransform(this.editingLayer);
            const textLayerDecomposedTransform = decomposeMatrix(textLayerTransform);
            const rotationDirection = decomposedViewTransform.rotation + textLayerDecomposedTransform.rotation + ([DRAG_TYPE_TOP, DRAG_TYPE_BOTTOM].includes(dragHandle!) ? Math.PI / 2 : 0);
            const rotatedDragVector = rotateDirectionVector2d(
                viewTransformPoint.x - this.dragStartPosition.x,
                viewTransformPoint.y - this.dragStartPosition.y,
                -rotationDirection,
            );
            if (dragHandle === DRAG_TYPE_ALL) {
                const deltaX = viewTransformPoint.x - this.dragStartPosition.x;
                const deltaY = viewTransformPoint.y - this.dragStartPosition.y;
                this.editingLayer.transform = new DOMMatrix().translateSelf(deltaX, deltaY).multiplySelf(this.editingLayerTransformStart);
            } else if (dragHandle === DRAG_TYPE_RIGHT) {
                this.editingLayer.width = Math.max(1, this.editingLayerWidthStart + rotatedDragVector.x);
            } else if (dragHandle === DRAG_TYPE_LEFT) {
                const translationVector = rotateDirectionVector2d(
                    rotatedDragVector.x, 0.0, rotationDirection
                )
                this.editingLayer.transform = new DOMMatrix().translateSelf(translationVector.x, translationVector.y).multiplySelf(this.editingLayerTransformStart);
                this.editingLayer.width = Math.max(1, this.editingLayerWidthStart - rotatedDragVector.x);
            } else if (dragHandle === DRAG_TYPE_BOTTOM) {
                this.editingLayer.height = Math.max(1, this.editingLayerHeightStart + rotatedDragVector.x);
            } else if (dragHandle === DRAG_TYPE_TOP) {
                const translationVector = rotateDirectionVector2d(
                    rotatedDragVector.x, 0.0, rotationDirection
                )
                this.editingLayer.transform = new DOMMatrix().translateSelf(translationVector.x, translationVector.y).multiplySelf(this.editingLayerTransformStart);
                this.editingLayer.height = Math.max(1, this.editingLayerHeightStart - rotatedDragVector.x);
            }
            if (dragHandle != null && dragHandle !== DRAG_TYPE_ALL && this.editingLayer.data.boundary !== 'box') {
                this.editingLayer.data.boundary = 'box';
            }
        } else {
            const editors = this.layerEditors.get(editingTextLayerId.value);
            if (!editors || !this.editorTextarea) return;
            const { documentSelection } = editors;
            const pointerMoveCursor = this.getEditorCursorAtPoint(viewTransformPoint);
            const pointerDownCursor = documentSelection.isActiveSideEnd ? documentSelection.start : documentSelection.end;
            documentSelection.setPosition(pointerDownCursor.line, pointerDownCursor.character, false);
            documentSelection.setPosition(pointerMoveCursor.line, pointerMoveCursor.character, true);
        }
    }

    private onDragEnd() {

        // Commit transforms to history.
        if (
            this.transformIsDragging && editingTextLayerId.value != null && this.editingLayer && this.editingLayerTransformStart && this.editingLayerWidthStart != null && this.editingLayerHeightStart != null &&
            (this.editingLayer.transform !== this.editingLayerTransformStart || this.editingLayer.width !== this.editingLayerWidthStart || this.editingLayer.height !== this.editingLayerHeightStart)
        ) {
            const isResize = this.editingLayer.width !== this.editingLayerWidthStart || this.editingLayer.height !== this.editingLayerHeightStart;
            const updateLayerActions: UpdateLayerAction<any>[] = [];
            updateLayerActions.push(new UpdateLayerAction({
                id: editingTextLayerId.value,
                transform: this.editingLayer.transform,
                width: this.editingLayer.width,
                height: this.editingLayer.height,
            }, {
                transform: this.editingLayerTransformStart,
                width: this.editingLayerWidthStart,
                height: this.editingLayerHeightStart,
            }));
            if (isResize && this.editingLayerDocumentStart && this.editingLayerDocumentStart.boundary !== 'box') {
                updateLayerActions.push(new UpdateLayerAction<UpdateTextLayerOptions>({
                    id: editingTextLayerId.value,
                    data: this.editingLayer.data,
                }, {
                    data: this.editingLayerDocumentStart,
                }));
            }
            historyStore.dispatch('runAction', {
                action: new BundleAction(
                    'textTransform', isResize ? 'action.textTransformResize' : 'action.textTransformTranslate',
                    updateLayerActions
                )
            });
        }

        this.dragStartPickLayer = null;
        this.dragStartPosition = null;
        this.transformIsDragging = false;
    }

    private onCursorHover(pointer: PointerEvent) {
        // Set handle highlights based on mouse hover
        const pageX = pointer.pageX ?? 0;
        const pageY = pointer.pageY ?? 0;

        const { viewTransformPoint, transformBoundsPoint } = this.getTransformedCursorInfo(pageX, pageY);

        const hoveringPickLayer = this.pickLayer(viewTransformPoint);
        if (hoveringPickLayer != null) {
            const hoveringLayer = getLayerById(hoveringPickLayer) as WorkingFileTextLayer;
            const hoveringLayerGlobalTransform = getLayerGlobalTransform(hoveringLayer);
            const decomposedHoveringLayerGlobalTransform = decomposeMatrix(hoveringLayerGlobalTransform);
            let layerDirection = (['ttb', 'btt'].includes(hoveringLayer?.data.lineDirection) ? 0 : Math.PI / 2.0) + decomposedHoveringLayerGlobalTransform.rotation;
            const layerDirectionBearing = rotateDirectionVector2d(1.0, 0.0, layerDirection);
            this.isHoveringLayerHorizontal = Math.abs(layerDirectionBearing.x) < Math.abs(layerDirectionBearing.y);
        } else {
            this.isHoveringLayerHorizontal = true;
        }

        let transformDragType = this.getTransformDragType(transformBoundsPoint);
        if (transformDragType != null) {
            dragHandleHighlight.value = transformDragType;
        } else {
            dragHandleHighlight.value = null;
        }
    }

    private pickLayer(viewTransformPoint: DOMPoint): number | null {
        const textLayers = getLayersByType('text').reverse();
        for (const alreadySelectedLayer of getSelectedLayers().filter(layer => layer.type === 'text')) {
            const layerTransform = getLayerGlobalTransform(alreadySelectedLayer.id).inverse();
            const layerTransformPoint = viewTransformPoint.matrixTransform(layerTransform);
            if (layerTransformPoint.x > 0 && layerTransformPoint.y > 0 && layerTransformPoint.x < alreadySelectedLayer.width && layerTransformPoint.y < alreadySelectedLayer.height) {
                return alreadySelectedLayer.id;
            }
        }
        for (const layer of textLayers) {
            const layerTransform = getLayerGlobalTransform(layer.id).inverse();
            const layerTransformPoint = viewTransformPoint.matrixTransform(layerTransform);
            if (layerTransformPoint.x > 0 && layerTransformPoint.y > 0 && layerTransformPoint.x < layer.width && layerTransformPoint.y < layer.height) {
                return layer.id;
            }
        }
        return null;
    }

    private determineDragType(transformBoundsPoint: DOMPoint) {
        this.transformIsDragging = false;
        // Determine which dimensions to drag on
        let transformDragType = this.getTransformDragType(transformBoundsPoint);
        if (transformDragType != null) {
            this.transformIsDragging = true;
        }
        dragHandleHighlight.value = transformDragType;
    }

    private getTransformDragType(transformBoundsPoint: DOMPoint): number | null {
        const viewDecomposedTransform = canvasStore.get('decomposedTransform');
        const devicePixelRatio = window.devicePixelRatio || 1;
        let transformDragType: number | null = null;
        const remToPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const handleSize = (0.75 * remToPx / viewDecomposedTransform.scaleX * devicePixelRatio) + 2;
        const touchForgivenessMargin = this.touches.length > 0 ? handleSize / 2 : 0;
        const innerHandleSizeVertical = touchForgivenessMargin;
        const innerHandleSizeHorizontal = touchForgivenessMargin;

        if (editingTextLayerId.value == null || this.editingLayer == null) return null;
        const isHorizontal = ['ltr', 'rtl'].includes(this.editingLayer.data.lineDirection);

        if (transformBoundsPoint.y >= 0 - handleSize - touchForgivenessMargin && transformBoundsPoint.y <= 0 + innerHandleSizeVertical) {
            transformDragType = isHorizontal ? DRAG_TYPE_ALL : DRAG_TYPE_TOP;
        }
        if (transformBoundsPoint.y >= this.editingLayer.height - innerHandleSizeVertical && transformBoundsPoint.y <= this.editingLayer.height + handleSize + touchForgivenessMargin) {
            transformDragType = isHorizontal ? DRAG_TYPE_ALL : DRAG_TYPE_BOTTOM;
        }
        if (transformBoundsPoint.x >= 0 - handleSize - touchForgivenessMargin && transformBoundsPoint.x <= 0 + innerHandleSizeHorizontal) {
            transformDragType = isHorizontal ? DRAG_TYPE_LEFT : DRAG_TYPE_ALL;
        }
        if (transformBoundsPoint.x >= this.editingLayer.width - innerHandleSizeHorizontal && transformBoundsPoint.x <= this.editingLayer.width + handleSize + touchForgivenessMargin) {
            transformDragType = isHorizontal ? DRAG_TYPE_RIGHT : DRAG_TYPE_ALL;
        }
        if (
            transformBoundsPoint.x < 0 - handleSize - touchForgivenessMargin ||
            transformBoundsPoint.x > this.editingLayer.width + handleSize + touchForgivenessMargin ||
            transformBoundsPoint.y < 0 - handleSize - touchForgivenessMargin ||
            transformBoundsPoint.y > this.editingLayer.height + handleSize + touchForgivenessMargin
        ) {
            transformDragType = null;
        }
        return transformDragType;
    }

    private getEditorCursorAtPoint(viewTransformPoint: DOMPoint): { line: number, character: number } {
        let cursor = { line: 0, character: 0 };
        if (editingRenderTextPlacement.value && editingTextLayerId.value != null) {
            const layerTransform = getLayerGlobalTransform(editingTextLayerId.value).inverse();
            const layerTransformPoint = viewTransformPoint.matrixTransform(layerTransform);
            const lineRenderInfo = editingRenderTextPlacement.value;
            if (lineRenderInfo.isHorizontal) {
                findHorizontalCursor:
                for (const line of lineRenderInfo.lines) {
                    if (layerTransformPoint.y >= line.wrapOffset && layerTransformPoint.y <= line.wrapOffset + line.heightAboveBaseline + line.heightBelowBaseline) {
                        cursor.line = line.documentLineIndex;
                        if (layerTransformPoint.x < line.lineStartOffset) {
                            cursor.character = line.glyphs[0]?.documentCharacterIndex ?? 0;
                            break findHorizontalCursor;
                        }
                        for (const glyph of line.glyphs) {
                            const left = glyph.advanceOffset;
                            const right = glyph.advanceOffset + glyph.advance;
                            if (layerTransformPoint.x >= left && layerTransformPoint.x <= right) {
                                if (layerTransformPoint.x - left < right - layerTransformPoint.x) {
                                    cursor.character = glyph.documentCharacterIndex + (glyph.bidiDirection === 'rtl' ? 1 : 0);
                                } else {
                                    cursor.character = glyph.documentCharacterIndex + (glyph.bidiDirection === 'rtl' ? 0 : 1);
                                }
                                break findHorizontalCursor;
                            }
                        }
                        if (line.glyphs.length > 0) {
                            cursor.character = line.glyphs[line.glyphs.length - 1].documentCharacterIndex + 1;
                        }
                        break findHorizontalCursor;
                    }
                }
            } else { // Vertical
                findVerticalCursor:
                for (const line of lineRenderInfo.lines) {
                    const left = Math.min(line.wrapOffset, line.wrapOffset + line.largestCharacterWidth);
                    const right = Math.max(line.wrapOffset, line.wrapOffset + line.largestCharacterWidth);
                    if (layerTransformPoint.x >= left && layerTransformPoint.x <= right) {
                        cursor.line = line.documentLineIndex;
                        if (layerTransformPoint.y < line.lineStartOffset) {
                            cursor.character = line.glyphs[0]?.documentCharacterIndex ?? 0;
                            break findVerticalCursor;
                        }
                        for (const glyph of line.glyphs) {
                            const top = Math.min(glyph.advanceOffset, glyph.advanceOffset + glyph.advance);
                            const bottom = Math.max(glyph.advanceOffset, glyph.advanceOffset + glyph.advance);
                            if (layerTransformPoint.y >= top && layerTransformPoint.y <= bottom) {
                                if (layerTransformPoint.y - top < bottom - layerTransformPoint.y) {
                                    cursor.character = glyph.documentCharacterIndex;
                                } else {
                                    cursor.character = glyph.documentCharacterIndex + 1;
                                }
                                break findVerticalCursor;
                            }
                        }
                        if (line.glyphs.length > 0) {
                            cursor.character = line.glyphs[line.glyphs.length - 1].documentCharacterIndex + 1;
                        }
                        break findVerticalCursor;
                    }
                }
            }
        }
        return cursor;
    }

    private getTransformedCursorInfo(pageX: number, pageY: number): { viewTransformPoint: DOMPoint, transformBoundsPoint: DOMPoint, viewDecomposedTransform: DecomposedMatrix } {
        const devicePixelRatio = window.devicePixelRatio || 1;
        const viewTransform = canvasStore.get('transform');
        const viewDecomposedTransform = canvasStore.get('decomposedTransform');
        const viewTransformPoint = new DOMPoint(pageX * devicePixelRatio, pageY * devicePixelRatio)
            .matrixTransform(viewTransform.inverse());

        let transformBoundsPoint: DOMPoint | null = null;
        if (editingTextLayerId.value != null) {
            // const originTranslateX = left.value + (transformOriginX.value * width.value);
            // const originTranslateY = top.value + (transformOriginY.value * height.value);
            // const boundsTransform =
            //     new DOMMatrix()
            //     .translateSelf(originTranslateX, originTranslateY)
            //     .rotateSelf(rotation.value * Math.RADIANS_TO_DEGREES)
            //     .translateSelf(-originTranslateX, -originTranslateY);
            if (this.editingLayer) {
                transformBoundsPoint =
                    new DOMPoint(this.lastCursorX * devicePixelRatio, this.lastCursorY * devicePixelRatio)
                    .matrixTransform(viewTransform.inverse())
                    .matrixTransform(this.editingLayer.transform.inverse());
            }
        }
    
        return {
            viewTransformPoint,
            transformBoundsPoint: transformBoundsPoint ?? new DOMPoint(),
            viewDecomposedTransform
        };
    }

    protected handleCursorIcon() {
        let newIcon = super.handleCursorIcon();
        if (!newIcon) {
            newIcon = (this.isHoveringLayerHorizontal) ? 'text' : 'vertical-text';
            const decomposedViewTransform = canvasStore.get('decomposedTransform');
            const dragHandle = dragHandleHighlight.value;
            determineResizeHandleIcon:
            if (dragHandle != null && editingTextLayerId.value != null) {
                if (this.editingLayer == null) break determineResizeHandleIcon;
                const textLayerTransform = getLayerGlobalTransform(this.editingLayer);
                const textLayerDecomposedTransform = decomposeMatrix(textLayerTransform);
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
                handleRotation += decomposedViewTransform.rotation + textLayerDecomposedTransform.rotation;
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
