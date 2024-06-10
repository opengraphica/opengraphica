import { watch, type WatchStopHandle, watchEffect } from 'vue';
import { v4 as uuidv4 } from 'uuid';

import { SelectLayersAction } from '@/actions/select-layers';

import BaseCanvasMovementController from './base-movement';
import canvasStore from '@/store/canvas';
import { isInput } from '@/lib/events';
import { TextDocumentEditor, TextDocumentSelection, TextDocumentEditorWithSelection } from '@/lib/text-editor';
import { calculateTextPlacement } from '@/lib/text-render';

import historyStore from '@/store/history';
import workingFileStore, { getLayerById, getLayerGlobalTransform, getLayersByType, getSelectedLayers } from '@/store/working-file';

import {
    isEditorTextareaFocused, editingTextLayerId, editingRenderTextPlacement, editingTextDocumentSelection,
} from '../store/text-state';

import type { WorkingFileTextLayer } from '@/types';
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

    private editorTextarea: HTMLTextAreaElement | null = null;
    private editorTextareaId: string = 'textControllerKeyboardInput' + uuidv4();
    private isEditorTextareaComposing: boolean = false;

    private layerEditors: Map<number, { documentEditor: TextDocumentEditor, documentSelection: TextDocumentSelection }> = new Map();
    private isEditingHorizontal: boolean = true;

    private selectedLayerIdsUnwatch: WatchStopHandle | null = null;
    private editingLayerUnwatch: WatchStopHandle | null = null;

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
        
        this.onFontsLoaded = this.onFontsLoaded.bind(this);
        appEmitter.on('editor.tool.fontsLoaded', this.onFontsLoaded);
        
    }

    onLeave(): void {
        this.destroyEditorTextarea();
        editingTextLayerId.value = null;

        appEmitter.off('editor.tool.fontsLoaded', this.onFontsLoaded);

        this.selectedLayerIdsUnwatch?.();
        this.editingLayerUnwatch?.();
    }

    private onFontsLoaded() {
        if (editingTextLayerId.value != null) {
            const layer = getLayerById(editingTextLayerId.value) as WorkingFileTextLayer;
            if (!layer) return;
            let isHorizontal = ['ltr', 'rtl'].includes(layer.data.lineDirection);
            editingRenderTextPlacement.value = calculateTextPlacement(layer.data, {
                wrapSize: isHorizontal ? layer.width : layer.height,
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
                    this.isEditingHorizontal = isHorizontal;
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
        this.isEditingHorizontal = true;
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
        if (pointer && pointer.down.button === 0) {
            if (pointer.isDragging) {
                this.onDragMove(pointer);
            }
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
        let { viewTransformPoint } = this.getTransformedCursorInfo(pointer.down.pageX, pointer.down.pageY);
        const dragStartPickLayer = this.pickLayer(viewTransformPoint);
        this.dragStartPickLayer = dragStartPickLayer;
        this.dragStartPosition = viewTransformPoint;

        if (dragStartPickLayer != null && !workingFileStore.state.selectedLayerIds.includes(dragStartPickLayer)) {
            historyStore.dispatch('runAction', {
                action: new SelectLayersAction([dragStartPickLayer])
            });
        }

        // TODO - check for resize handle click before doing this.
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

    private onDragMove(pointer: PointerTracker) {
        const pageX = pointer.move?.pageX ?? 0;
        const pageY = pointer.move?.pageY ?? 0;
        const { viewTransformPoint } = this.getTransformedCursorInfo(pageX, pageY);
        if (editingTextLayerId.value == null) return;
        const editors = this.layerEditors.get(editingTextLayerId.value);
        if (!editors || !this.editorTextarea) return;
        const { documentSelection } = editors;
        const pointerMoveCursor = this.getEditorCursorAtPoint(viewTransformPoint);
        const pointerDownCursor = documentSelection.isActiveSideEnd ? documentSelection.start : documentSelection.end;
        documentSelection.setPosition(pointerDownCursor.line, pointerDownCursor.character, false);
        documentSelection.setPosition(pointerMoveCursor.line, pointerMoveCursor.character, true);
    }

    private onDragEnd() {
        this.dragStartPickLayer = null;
        this.dragStartPosition = null;
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
                        cursor.character = line.glyphs[line.glyphs.length - 1].documentCharacterIndex + 1;
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
                        cursor.character = line.glyphs[line.glyphs.length - 1].documentCharacterIndex + 1;
                        break findVerticalCursor;
                    }
                }
            }
        }
        return cursor;
    }

    private getTransformedCursorInfo(pageX: number, pageY: number): { viewTransformPoint: DOMPoint, /* transformBoundsPoint: DOMPoint, */ viewDecomposedTransform: DecomposedMatrix } {
        const devicePixelRatio = window.devicePixelRatio || 1;
        const viewTransform = canvasStore.get('transform');
        const viewDecomposedTransform = canvasStore.get('decomposedTransform');
        const viewTransformPoint = new DOMPoint(pageX * devicePixelRatio, pageY * devicePixelRatio)
            .matrixTransform(viewTransform.inverse());
        
        return {
            viewTransformPoint,
            viewDecomposedTransform
        };
    }

    protected handleCursorIcon() {
        let newIcon = super.handleCursorIcon();
        if (!newIcon) {
            newIcon = (this.isEditingHorizontal) ? 'text' : 'vertical-text';
        }
        canvasStore.set('cursor', newIcon);
        return newIcon;
    }
}
