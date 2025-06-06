import { nextTick, watch, type WatchStopHandle } from 'vue';
import { v4 as uuidv4 } from 'uuid';

import { BundleAction } from '@/actions/bundle';
import { InsertLayerAction } from '@/actions/insert-layer';
import { SelectLayersAction } from '@/actions/select-layers';
import { UpdateLayerAction } from '@/actions/update-layer';

import BaseCanvasMovementController from './base-movement';

import { t } from '@/i18n';
import { decomposeMatrix } from '@/lib/dom-matrix';
import appEmitter, { type AppEmitterEvents } from '@/lib/emitter';
import { isInput } from '@/lib/events';
import { getKeyboardAction } from '@/lib/keyboard';
import { rotateDirectionVector2d } from '@/lib/math';
import { TextDocumentEditor, TextDocumentSelection, TextDocumentEditorWithSelection } from '@/lib/text-editor';
import { textMetaDefaults } from '@/lib/text-common';
import { calculateTextPlacement } from '@/lib/text-render';

import canvasStore from '@/store/canvas';
import { cssViewTransform } from '@/store/editor';
import historyStore from '@/store/history';
import preferencesStore from '@/store/preferences';
import workingFileStore, { getLayerById, getLayerGlobalTransform, getLayersByType, getSelectedLayers, ensureUniqueLayerSiblingName } from '@/store/working-file';

import {
    textToolbarEmitter, isEditorTextareaFocused, editingTextLayerId, editingTextLayer,
    editingRenderTextPlacement, editingTextDocumentSelection,
    dragHandleHighlight, createNewTextLayerSize, toolbarTextMeta, toolbarTextDefaults,
    overlaySelectionCursorPosition, overlaySelectionCursorSize, editingLayerCssTransform,
} from '../store/text-state';

import { runModule } from '@/modules';

import type { UpdateTextLayerOptions, WorkingFileTextLayer, TextDocument, InsertTextLayerOptions, TextDocumentSpanMeta } from '@/types';
import type { PointerTracker } from './base';
import type { DecomposedMatrix } from '@/lib/dom-matrix';

const DRAG_TYPE_ALL = 0;
const DRAG_TYPE_TOP = 1;
const DRAG_TYPE_BOTTOM = 2;
const DRAG_TYPE_LEFT = 4;
const DRAG_TYPE_RIGHT = 8;

const CLEARED_EDITOR_TEXTAREA_LENGTH = 2;

export default class CanvasTextController extends BaseCanvasMovementController {

    private dragStartPickLayer: number | null = null;
    private dragStartPosition: DOMPoint | null = null;
    private dragStartDragType: number | null = null;
    private transformIsDragging: boolean = false;
    private editingLayerTransformStart: DOMMatrix | null = null;
    private editingLayerDocumentStart: TextDocument | null = null;
    private editingLayerWidthStart: number | null = null;
    private editingLayerHeightStart: number | null = null;
    private editingLayerDocumentOnFocus: TextDocument | null = null;
    private editingLayerDocumentOnFocusId: number | null = null;

    private isCreatingLayer: boolean = false;
    private createdLayerId: number | null = null;

    private editorTextareaContainer: HTMLDivElement | null = null;
    private editorTextarea: HTMLTextAreaElement | null = null;
    private editorTextareaId: string = 'textControllerKeyboardInput' + uuidv4();
    private isEditorTextareaComposing: boolean = false;
    private isEditorTextareaDirty: boolean = false; // Unsaved changes have been made
    private editorTextareaQueueSaveTimeoutHandle: number | undefined = undefined;
    private editorTextareaSelectWordTimestamp: number = 0;

    private isKeydownEventSupported: boolean = false;

    private layerEditors: Map<number, { documentEditor: TextDocumentEditor, documentSelection: TextDocumentSelection }> = new Map();
    private isHoveringLayerHorizontal: boolean = true;

    private selectedLayerIdsUnwatch: WatchStopHandle | null = null;
    private editingTextDocumentSelectionUnwatch: WatchStopHandle | null = null;
    private editingTextLayerIdUnwatch: WatchStopHandle | null = null;
    private editingTextLayerDimensionsUnwatch: WatchStopHandle | null = null;
    private editingTextLayerDirectionUnwatch: WatchStopHandle | null = null;

    onEnter(): void {
        super.onEnter();

        this.createEditorTextarea();

        // Create text editor instances for currently selected layers.
        this.selectedLayerIdsUnwatch = watch(() => workingFileStore.state.selectedLayerIds, (newIds, oldIds) => {
            for (const oldId of oldIds ?? []) {
                try {
                    if (editingTextLayerId.value === oldId) {
                        editingTextDocumentSelection.value = null;
                    }
                    const editors = this.layerEditors.get(oldId);
                    if (editors) {
                        const { documentEditor, documentSelection } = editors;
                        documentEditor.dispose();
                        documentSelection.dispose();
                        this.layerEditors.delete(oldId);
                    }
                } catch (error) { /* Ignore */ }
            }
            const checkNewIds = newIds ?? [];
            let newTextLayerIds: number[] = [];
            for (const newId of checkNewIds) {
                const layer = getLayerById(newId);
                if (layer?.type === 'text') {
                    newTextLayerIds.push(newId);
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
            if (!newTextLayerIds.includes(editingTextLayerId.value as number)) {
                editingTextLayerId.value = newTextLayerIds[0] ?? null;
            }
        }, { immediate: true });

        this.editingTextDocumentSelectionUnwatch = watch(
            () => ({
                startLine: editingTextDocumentSelection.value?.start?.line as number,
                startCharacter: editingTextDocumentSelection.value?.start?.character as number,
                endLine: editingTextDocumentSelection.value?.end?.line as number,
                endCharacter: editingTextDocumentSelection.value?.end?.character as number
            }),
            (selection, oldSelection) => {
                if (!selection) return;
                if (
                    selection.startLine === oldSelection?.startLine &&
                    selection.startCharacter === oldSelection?.startCharacter &&
                    selection.endLine === oldSelection?.endLine &&
                    selection.endCharacter === oldSelection?.endCharacter
                ) return;
                this.updateToolbarMetaFromActiveSelection();
            }
        );

        this.editingTextLayerIdUnwatch = watch(
            () => editingTextLayerId.value,
            (id) => {
                if (id == null) {
                    editingTextLayer.value = null;
                    return;
                }
                const layer = getLayerById(id) as WorkingFileTextLayer;
                if (layer?.type !== 'text') {
                    editingTextLayer.value = null;
                    return;
                }
                editingTextLayer.value = layer;
            }, { immediate: true }
        );

        this.editingTextLayerDimensionsUnwatch = watch(() => ({
            width: editingTextLayer.value?.width,
        }), ({ width }, { width: oldWidth }) => {
            if (
                editingTextLayerId.value != null && isEditorTextareaFocused.value
                && width != null && oldWidth != null
                && (editingTextLayer.value?.data.wrapDirection === 'rtl' && width != oldWidth)
            ) {
                historyStore.dispatch('runAction', {
                    action: new BundleAction('updateTextLayerProperties', `action.updateTextLayerProperties`, [
                        new UpdateLayerAction<UpdateTextLayerOptions>({
                            id: editingTextLayerId.value,
                            transform: new DOMMatrix().translate(oldWidth - width).multiply(editingTextLayer.value.transform)
                        }),
                    ]),
                    mergeWithHistory: ['typeInTextLayer'],
                });
            }
        });

        this.editingTextLayerDirectionUnwatch = watch(() => ([
            editingTextLayer.value?.data.lineDirection,
            editingTextLayer.value?.data.wrapDirection,
        ]), ([lineDirection]) => {
            if (!editingTextLayer.value || !lineDirection) return;
            let isHorizontal = ['ltr', 'rtl'].includes(lineDirection);
            editingRenderTextPlacement.value = calculateTextPlacement(editingTextLayer.value.data, {
                wrapSize: isHorizontal ? editingTextLayer.value.width : editingTextLayer.value.height,
            });
        });

        this.onToolbarMetaChanged = this.onToolbarMetaChanged.bind(this);
        textToolbarEmitter.on('toolbarMetaChanged', this.onToolbarMetaChanged);
        this.onToolbarDocumentChanged = this.onToolbarDocumentChanged.bind(this);
        textToolbarEmitter.on('toolbarDocumentChanged', this.onToolbarDocumentChanged);

        this.onFontsLoaded = this.onFontsLoaded.bind(this);
        this.onHistoryStep = this.onHistoryStep.bind(this);
        appEmitter.on('editor.tool.fontsLoaded', this.onFontsLoaded);
        appEmitter.on('editor.history.step', this.onHistoryStep);
        
    }

    onLeave(): void {
        this.destroyEditorTextarea();
        editingTextLayerId.value = null;
        editingTextDocumentSelection.value = null;

        textToolbarEmitter.off('toolbarMetaChanged', this.onToolbarMetaChanged);
        textToolbarEmitter.off('toolbarDocumentChanged', this.onToolbarDocumentChanged);
        appEmitter.off('editor.tool.fontsLoaded', this.onFontsLoaded);

        this.selectedLayerIdsUnwatch?.();
        this.editingTextDocumentSelectionUnwatch?.();
        this.editingTextLayerIdUnwatch?.();
        this.editingTextLayerDimensionsUnwatch?.();
        this.editingTextLayerDirectionUnwatch?.();
    }

    private async onHistoryStep(event?: AppEmitterEvents['editor.history.step']) {
        if (['moduleCropResize', 'typeInTextLayer', 'updateTextLayerProperties'].includes(event?.action.id as string)) {

            // Update document editor with new document.
            if (editingTextLayerId.value != null) {
                await nextTick();
                const editors = this.layerEditors.get(editingTextLayerId.value);
                const layer = getLayerById<WorkingFileTextLayer>(editingTextLayerId.value);
                if (layer?.type === 'text' && editors) {
                    layer.data = JSON.parse(JSON.stringify(layer.data));
                    editors.documentEditor.setDocument(layer.data);
                }
            }

            if (event?.action.id === 'moduleCropResize') {
                this.updateToolbarMetaFromActiveSelection();
            }
        }
    }

    private onFontsLoaded() {
        if (editingTextLayerId.value != null) {
            if (!editingTextLayer.value) return;
            let isHorizontal = ['ltr', 'rtl'].includes(editingTextLayer.value.data.lineDirection);
            editingRenderTextPlacement.value = calculateTextPlacement(editingTextLayer.value.data, {
                wrapSize: isHorizontal ? editingTextLayer.value.width : editingTextLayer.value.height,
            });
        }
    }

    private onToolbarDocumentChanged(event: any) {        
        if (!editingTextLayer.value) return;
        const { name, value } = event as { name: keyof TextDocument, value: any };
        editingTextLayer.value.data[name] = value as never;
        this.editingLayerDocumentOnFocusId = editingTextLayerId.value;
        this.editingLayerDocumentOnFocus = JSON.parse(JSON.stringify(editingTextLayer.value.data));
        this.isEditorTextareaDirty = true;
        this.saveEditorTextarea('updateTextLayerProperties');
    }

    private onToolbarMetaChanged(event: any) {
        if (!event || editingTextLayerId.value == null) return;
        const editors = this.layerEditors.get(editingTextLayerId.value);
        if (!editors) return;
        const { documentEditor, documentSelection } = editors;
        const { name, value } = event as { name: string, value: any };
        if (!documentSelection.isEmpty()) {
            documentEditor.setMetaRange(
                documentSelection.start.line,
                documentSelection.start.character,
                documentSelection.end.line,
                documentSelection.end.character,
                { [name]: value },
            );
            this.isEditorTextareaDirty = true;
            this.saveEditorTextarea('updateTextLayerProperties');
        } else {
            documentEditor.queueMetaChange(name as keyof TextDocumentSpanMeta, value);
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

        this.editorTextareaContainer = document.createElement('div');
        this.editorTextareaContainer.setAttribute('style', `position: absolute; top: 0; left: 0; padding: 0; width: 1px; height: 1px; background: transparent; border: none; outline: none; color: transparent; opacity: 0.01; pointer-events: none;`);
        this.editorTextareaContainer.appendChild(this.editorTextarea);
        document.body.appendChild(this.editorTextareaContainer);

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

    private updateEditorTextareaPosition() {
        if (!this.editorTextarea) return;
        this.editorTextarea.style.transformOrigin = '0% 0%';
        this.editorTextarea.style.transform = editingLayerCssTransform.value;
        this.editorTextarea.style.left = `${overlaySelectionCursorPosition.value.x}px`;
        this.editorTextarea.style.top = `${overlaySelectionCursorPosition.value.y + overlaySelectionCursorSize.value}px`;
        if (!this.editorTextareaContainer) return;
        this.editorTextareaContainer.style.transformOrigin = '0% 0%';
        this.editorTextareaContainer.style.transform = cssViewTransform.value;
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
        this.editorTextareaContainer?.parentNode?.removeChild(this.editorTextareaContainer);
        this.editorTextareaContainer = null;
    }

    private onFocusEditorTextarea() {
        isEditorTextareaFocused.value = true;
        if (editingTextLayerId.value != null) {
            const editors = this.layerEditors.get(editingTextLayerId.value);
            if (editors) {
                const { documentSelection } = editors;
                const layer = getLayerById(editingTextLayerId.value) as WorkingFileTextLayer;
                if (layer && layer.type === 'text') {
                    this.editingLayerDocumentOnFocusId = layer.id;
                    this.editingLayerDocumentOnFocus = JSON.parse(JSON.stringify(layer.data));
                    let isHorizontal = ['ltr', 'rtl'].includes(layer.data.lineDirection);
                    editingRenderTextPlacement.value = calculateTextPlacement(layer.data, {
                        wrapSize: isHorizontal ? layer.width : layer.height,
                    });
                }
                editingTextDocumentSelection.value = documentSelection.getSelectionState();
            }
        }
        this.clearEditorTextarea();
    }

    private onBlurEditorTextarea() {
        if (this.isEditorTextareaDirty) {
            this.saveEditorTextarea();
        }
        isEditorTextareaFocused.value = false;
    }

    private onCompositionStartEditorTextarea(event: CompositionEvent) {
        this.isEditorTextareaComposing = true;
        this.replaceCompositionText(event);
        this.updateEditorTextareaPosition();
    }

    private onCompositionUpdateEditorTextarea(event: CompositionEvent) {
        this.replaceCompositionText(event);
    }

    private onCompositionEndEditorTextarea(event: CompositionEvent) {
        this.isEditorTextareaComposing = false;
        this.replaceCompositionText(event, true);
        this.isEditorTextareaDirty = true;
        this.queueSaveEditorTextarea();
        this.clearEditorTextarea();
    }

    private replaceCompositionText(event: CompositionEvent, isEnd: boolean = false) {
        if (editingTextLayerId.value == null) return;
        const editors = this.layerEditors.get(editingTextLayerId.value);
        if (!editors || !this.editorTextarea) return;
        if (event.data.length > 0) {
            const { documentEditor, documentSelection } = editors;
            TextDocumentEditorWithSelection.insertTextAtCurrentPosition(documentEditor, documentSelection, event.data, true);
            if (isEnd) {
                const { line, character } = documentSelection.getPosition();
                documentSelection.setPosition(line, character);
            }
        }
    }

    private async onInputEditorTextarea(event: Event) {
        if (editingTextLayerId.value == null) return;
        const editors = this.layerEditors.get(editingTextLayerId.value);
        if (!editors || !this.editorTextarea) return;

        // Because mobile virtual keyboards absolutely suck, we must detect basic things like backspace
        // by comparing the input's value to an expected result.
        if (this.isEditorTextareaBackspace()) {
            const { documentEditor, documentSelection } = editors;
            TextDocumentEditorWithSelection.deleteCharacterAtCurrentPosition(documentEditor, documentSelection, false);
            this.isEditorTextareaDirty = true;
            this.clearEditorTextarea();
            this.queueSaveEditorTextarea();
        } else if (this.isEditorTextareaDelete()) {
            const { documentEditor, documentSelection } = editors;
            TextDocumentEditorWithSelection.deleteCharacterAtCurrentPosition(documentEditor, documentSelection, true);
            this.isEditorTextareaDirty = true;
            this.clearEditorTextarea();
            this.queueSaveEditorTextarea();
        } else if (this.editorTextarea.value.length < CLEARED_EDITOR_TEXTAREA_LENGTH) {
            // We got in a bad state. This can happen when the user picks an auto-suggestion,
            // and the browser's selection API stops working. Browser bug.
            if (this.isEditorTextareaBrokenBackspace()) {
                const { documentEditor, documentSelection } = editors;
                TextDocumentEditorWithSelection.deleteCharacterAtCurrentPosition(documentEditor, documentSelection, false);
                this.isEditorTextareaDirty = true;
                this.clearEditorTextarea();
            }
            // Blur & refocus to fix selection API.
            this.editorTextarea.blur();
            setTimeout(() => {
                this.editorTextarea?.focus();
            }, 0);
        }

        if (this.isEditorTextareaComposing) return;
        if (this.editorTextarea.value.length > CLEARED_EDITOR_TEXTAREA_LENGTH) {
            const { documentEditor, documentSelection } = editors;
            TextDocumentEditorWithSelection.insertTextAtCurrentPosition(documentEditor, documentSelection, this.extractEditorTextareaInput());
            this.isEditorTextareaDirty = true;
            this.queueSaveEditorTextarea();
        }
        this.clearEditorTextarea();
    };

    private onKeydownEditorTextarea(event: KeyboardEvent) {
        if (editingTextLayerId.value == null) return;
        const editors = this.layerEditors.get(editingTextLayerId.value);
        if (!editors) return;
        let handled = true;
        const { documentEditor, documentSelection } = editors;
        switch (event.key) {
            case 'Backspace':
                event.preventDefault();
                if (event.ctrlKey) {
                    documentSelection.moveWordPrevious(true);
                    TextDocumentEditorWithSelection.deleteSelection(documentEditor, documentSelection);
                } else {
                    TextDocumentEditorWithSelection.deleteCharacterAtCurrentPosition(documentEditor, documentSelection, false);
                }
                this.isEditorTextareaDirty = true;
                this.queueSaveEditorTextarea();
                break;
            case 'Delete':
                event.preventDefault();
                if (event.ctrlKey) {
                    documentSelection.moveWordNext(true);
                    TextDocumentEditorWithSelection.deleteSelection(documentEditor, documentSelection);
                } else {
                    TextDocumentEditorWithSelection.deleteCharacterAtCurrentPosition(documentEditor, documentSelection, true);
                }
                this.isEditorTextareaDirty = true;
                this.queueSaveEditorTextarea();
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
                event.preventDefault();
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
                    event.preventDefault();
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
                        this.clearEditorTextarea();
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
                        this.clearEditorTextarea();

                        // Delete selection
                        TextDocumentEditorWithSelection.deleteSelection(documentEditor, documentSelection);

                        this.isEditorTextareaDirty = true;
                        this.queueSaveEditorTextarea();
                    }
                    break;
                }
            default:
                const shortcutAction = getKeyboardAction(event.key, event.ctrlKey, event.shiftKey, event.altKey);
                if (shortcutAction?.target == 'history/undo') {
                    event.preventDefault();
                    const actionSplit = shortcutAction.target.split('/');
                    if (this.isEditorTextareaDirty) {
                        this.saveEditorTextarea().then(() => {
                            runModule(actionSplit[0], actionSplit[1]);
                        });
                    } else {
                        runModule(actionSplit[0], actionSplit[1]);
                    }
                } else if (shortcutAction?.target == 'history/redo') {
                    event.preventDefault();
                    this.isEditorTextareaDirty = false;
                    clearTimeout(this.editorTextareaQueueSaveTimeoutHandle);
                    const actionSplit = shortcutAction.target.split('/');
                    runModule(actionSplit[0], actionSplit[1]);
                } else {
                    handled = false;
                }
        }
        if (handled) {
            this.clearEditorTextarea();
            canvasStore.set('dirty', true);
            // TODO - update tool selection GUI?
        }
        // this.extendFixedBounds(editingTextLayerId.value);
        return !handled;
    }

    onMultiTouchTap(touches) {
        if (touches.length === 1) {
            if (this.dragStartPickLayer == null) {
                this.onDragStart(touches[0]);
                this.onDragEnd();
            }
        }
    }

    onPointerDown(e: PointerEvent): void {
        super.onPointerDown(e);
        if (isInput(e.target)) return;
        if (e.isPrimary && ['mouse', 'pen'].includes(e.pointerType) && e.button === 0) {
            const pointer = this.pointers.filter((pointer) => pointer.id === e.pointerId)[0];
            this.onDragStart(pointer);
        }
        if (e.pointerType === 'touch') {
            let { viewTransformPoint } = this.getTransformedCursorInfo(e.pageX, e.pageY);
            const dragStartPickLayer = this.pickLayer(viewTransformPoint);
            if (dragStartPickLayer != null && dragStartPickLayer === editingTextLayerId.value) {
                const pointer = this.pointers.filter((pointer) => pointer.id === e.pointerId)[0];
                this.onDragStart(pointer);
            }
        }
        setTimeout(() => {
            this.handleCursorIcon();
        }, 0);
    }

    onPointerDoubleTap(e: PointerEvent): void {
        super.onPointerDoubleTap(e);

        // Double click selects the word that the user clicked on.
        if (editingTextLayerId.value == null) return;
        const editors = this.layerEditors.get(editingTextLayerId.value);
        if (!editors || !this.editorTextarea) return;
        let { viewTransformPoint } = this.getTransformedCursorInfo(e.pageX, e.pageY);
        const { documentEditor, documentSelection } = editors;
        const cursorPosition = this.getEditorCursorAtPoint(viewTransformPoint);
        const wordStart = documentEditor.getWordStartPosition(cursorPosition.line, cursorPosition.character);
        const wordEnd = documentEditor.getWordEndPosition(cursorPosition.line, cursorPosition.character);
        documentSelection.setPosition(wordStart.line, wordStart.character);
        documentSelection.setPosition(wordEnd.line, wordEnd.character, true);
        this.editorTextareaSelectWordTimestamp = window.performance.now();
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
                action: new SelectLayersAction([dragStartPickLayer]),
                mergeWithHistory: 'selectLayers',
            });
        }

        // Figure out which resize/rotate handles were clicked on, or if clicked in empty space just to drag
        this.determineDragType(transformBoundsPoint);
        this.dragStartDragType = dragHandleHighlight.value;
        this.editingLayerTransformStart = null;
        this.editingLayerDocumentStart = null;
        this.editingLayerWidthStart = null;
        this.editingLayerHeightStart = null;
        this.isCreatingLayer = false;
        this.createdLayerId = null;

        if (this.dragStartPickLayer != null || dragHandleHighlight.value != null) {

            if (this.transformIsDragging) {
                // Pointer resizes / moves text layer.
                if (editingTextLayerId.value == null || editingTextLayer.value == null) return;
                this.editingLayerTransformStart = new DOMMatrix().multiply(editingTextLayer.value.transform);
                this.editingLayerDocumentStart = JSON.parse(JSON.stringify(editingTextLayer.value.data)) as TextDocument;
                this.editingLayerWidthStart = editingTextLayer.value.width;
                this.editingLayerHeightStart = editingTextLayer.value.height;
            } else {
                // Pointer manipulates text selection.
                // Wait and then assign focus, because the browser immediately focuses on clicked element.
                setTimeout(() => {
                    // Focus active editor
                    if (dragStartPickLayer != null && !isEditorTextareaFocused.value) {
                        editingTextLayerId.value = dragStartPickLayer;
                        this.editorTextarea?.focus();
                    }

                    // Don't continue if double click already executed.
                    if (window.performance.now() < this.editorTextareaSelectWordTimestamp + 250) return;

                    // Set cursor position based on pointer position
                    if (editingTextLayerId.value == null) return;
                    const editors = this.layerEditors.get(editingTextLayerId.value);
                    if (!editors || !this.editorTextarea) return;
                    const { documentSelection } = editors;
                    const cursorPosition = this.getEditorCursorAtPoint(viewTransformPoint);
                    documentSelection.setPosition(cursorPosition.line, cursorPosition.character);
                }, 0);
            }
        } else {
            this.isCreatingLayer = true;
        }
    }

    private onDragMove(pointer: PointerTracker) {
        const pageX = pointer.move?.pageX ?? 0;
        const pageY = pointer.move?.pageY ?? 0;
        const { viewTransformPoint, transformBoundsPoint } = this.getTransformedCursorInfo(pageX, pageY);

        // Creating new text layer
        if (this.isCreatingLayer) {
            const { viewTransformPoint: pointerDownPoint } = this.getTransformedCursorInfo(
                pointer.down.pageX, pointer.down.pageY
            );
            if (this.createdLayerId == null) {
                // User just started dragging mouse; create a new text layer
                this.createNewTextLayerAtPosition(pointerDownPoint, false);
            } else if (this.createdLayerId > -1) {
                const createdLayer = getLayerById<WorkingFileTextLayer>(this.createdLayerId);
                // Resize width or height of layer when user drags mouse during text layer creation
                if (createdLayer) {
                    const topLeft = new DOMPoint(
                        Math.min(pointerDownPoint.x, viewTransformPoint.x),
                        Math.min(pointerDownPoint.y, viewTransformPoint.y),
                    );
                    const bottomRight = new DOMPoint(
                        Math.max(pointerDownPoint.x, viewTransformPoint.x),
                        Math.max(pointerDownPoint.y, viewTransformPoint.y),
                    );
                    const isHorizontal = ['ltr', 'rtl'].includes(createdLayer.data.lineDirection);
                    const decomposedTransform = decomposeMatrix(createdLayer.transform);
                    if (isHorizontal) {
                        createdLayer.transform = new DOMMatrix().translate(
                            topLeft.x,
                            decomposedTransform.translateY,
                        );
                        createdLayer.width = bottomRight.x - topLeft.x;
                    } else {
                        createdLayer.transform = new DOMMatrix().translate(
                            decomposedTransform.translateX,
                            topLeft.y,
                        );
                        createdLayer.height = bottomRight.y - topLeft.y;
                    }
                }
            }
        }
        else {
            if (editingTextLayerId.value == null) return;

            // Resizing text boundaries
            if (this.transformIsDragging) {
                if (!this.editingLayerTransformStart || this.editingLayerWidthStart == null || this.editingLayerHeightStart == null || editingTextLayer.value == null || this.dragStartPosition == null) return;
                let dragHandle = this.dragStartDragType;
                const decomposedViewTransform = canvasStore.get('decomposedTransform');
                const textLayerTransform = getLayerGlobalTransform(editingTextLayer.value);
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
                    editingTextLayer.value.transform = new DOMMatrix().translateSelf(deltaX, deltaY).multiplySelf(this.editingLayerTransformStart);
                } else if (dragHandle === DRAG_TYPE_RIGHT) {
                    editingTextLayer.value.width = Math.max(1, this.editingLayerWidthStart + rotatedDragVector.x);
                } else if (dragHandle === DRAG_TYPE_LEFT) {
                    const translationVector = rotateDirectionVector2d(
                        rotatedDragVector.x, 0.0, rotationDirection
                    )
                    editingTextLayer.value.transform = new DOMMatrix().translateSelf(translationVector.x, translationVector.y).multiplySelf(this.editingLayerTransformStart);
                    editingTextLayer.value.width = Math.max(1, this.editingLayerWidthStart - rotatedDragVector.x);
                } else if (dragHandle === DRAG_TYPE_BOTTOM) {
                    editingTextLayer.value.height = Math.max(1, this.editingLayerHeightStart + rotatedDragVector.x);
                } else if (dragHandle === DRAG_TYPE_TOP) {
                    const translationVector = rotateDirectionVector2d(
                        rotatedDragVector.x, 0.0, rotationDirection
                    )
                    editingTextLayer.value.transform = new DOMMatrix().translateSelf(translationVector.x, translationVector.y).multiplySelf(this.editingLayerTransformStart);
                    editingTextLayer.value.height = Math.max(1, this.editingLayerHeightStart - rotatedDragVector.x);
                }
                if (dragHandle != null && dragHandle !== DRAG_TYPE_ALL && editingTextLayer.value.data.boundary !== 'box') {
                    editingTextLayer.value.data.boundary = 'box';
                }
            } else if (this.dragStartPickLayer != null) { // Selecting text
                const editors = this.layerEditors.get(editingTextLayerId.value);
                if (!editors || !this.editorTextarea) return;
                const { documentSelection } = editors;
                const pointerMoveCursor = this.getEditorCursorAtPoint(viewTransformPoint);
                const pointerDownCursor = documentSelection.isActiveSideEnd ? documentSelection.start : documentSelection.end;
                documentSelection.setPosition(pointerDownCursor.line, pointerDownCursor.character, false);
                documentSelection.setPosition(pointerMoveCursor.line, pointerMoveCursor.character, true);
            }
        }
    }

    private onDragEnd() {
        if (this.isCreatingLayer) {
            const createdLayerId = this.createdLayerId;
            // User never dragged their mouse and just clicked; create new text layer
            if (createdLayerId == null && this.dragStartPosition) {
                this.createNewTextLayerAtPosition(this.dragStartPosition, true);
            }
            // User previously dragged their mouse during text layer creation, and those position changes should be saved to history
            if (createdLayerId != null && createdLayerId > -1) {
                const createdLayer = getLayerById(createdLayerId);
                if (createdLayer) {
                    historyStore.dispatch('runAction', {
                        action: new UpdateLayerAction({
                            id: createdLayerId,
                            transform: createdLayer.transform,
                            width: createdLayer.width,
                            height: createdLayer.height
                        }),
                        mergeWithHistory: 'createTextLayer'
                    });
                }
                setTimeout(() => {
                    editingTextLayerId.value = createdLayerId;
                    this.editorTextarea?.focus();
                }, 1);
            }
        } else {
            // Commit drag handle resize transforms to history.
            if (
                this.transformIsDragging && editingTextLayerId.value != null && editingTextLayer.value && this.editingLayerTransformStart && this.editingLayerWidthStart != null && this.editingLayerHeightStart != null &&
                (editingTextLayer.value.transform !== this.editingLayerTransformStart || editingTextLayer.value.width !== this.editingLayerWidthStart || editingTextLayer.value.height !== this.editingLayerHeightStart)
            ) {
                const isResize = editingTextLayer.value.width !== this.editingLayerWidthStart || editingTextLayer.value.height !== this.editingLayerHeightStart;
                const updateLayerActions: UpdateLayerAction<any>[] = [];
                updateLayerActions.push(new UpdateLayerAction({
                    id: editingTextLayerId.value,
                    transform: editingTextLayer.value.transform,
                    width: editingTextLayer.value.width,
                    height: editingTextLayer.value.height,
                }, {
                    transform: this.editingLayerTransformStart,
                    width: this.editingLayerWidthStart,
                    height: this.editingLayerHeightStart,
                }));
                if (isResize && this.editingLayerDocumentStart && this.editingLayerDocumentStart.boundary !== 'box') {
                    const oldData = this.editingLayerDocumentStart;
                    this.editingLayerDocumentStart = JSON.parse(JSON.stringify(oldData));
                    updateLayerActions.push(new UpdateLayerAction<UpdateTextLayerOptions>({
                        id: editingTextLayerId.value,
                        data: editingTextLayer.value.data,
                    }, {
                        data: oldData,
                    }));
                }
                historyStore.dispatch('runAction', {
                    action: new BundleAction(
                        'textTransform', isResize ? 'action.textTransformResize' : 'action.textTransformTranslate',
                        updateLayerActions
                    )
                });
            }
        }

        this.isCreatingLayer = false;
        this.createdLayerId = null;
        this.dragStartPickLayer = null;
        this.dragStartPosition = null;
        this.dragStartDragType = null;
        this.transformIsDragging = false;
    }

    private onCursorHover(pointer: PointerEvent) {
        // Set handle highlights based on mouse hover
        const pageX = pointer.pageX ?? 0;
        const pageY = pointer.pageY ?? 0;

        const { viewTransformPoint, transformBoundsPoint, viewDecomposedTransform } = this.getTransformedCursorInfo(pageX, pageY);

        const hoveringPickLayer = this.pickLayer(viewTransformPoint);
        if (hoveringPickLayer != null) {
            const hoveringLayer = getLayerById(hoveringPickLayer) as WorkingFileTextLayer;
            const hoveringLayerGlobalTransform = getLayerGlobalTransform(hoveringLayer);
            const decomposedHoveringLayerGlobalTransform = decomposeMatrix(hoveringLayerGlobalTransform);
            let layerDirection = (['ttb', 'btt'].includes(hoveringLayer?.data.lineDirection) ? 0 : Math.PI / 2.0) + decomposedHoveringLayerGlobalTransform.rotation + viewDecomposedTransform.rotation;
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

    private async createNewTextLayerAtPosition(position: DOMPoint, isDynamic = false) {
        this.createdLayerId = -1;
        const lineDirection = toolbarTextDefaults.lineDirection;
        const isHorizontal = ['ltr', 'rtl'].includes(lineDirection);

        const newTextDocument: TextDocument = {
            boundary: isDynamic ? 'dynamic' : 'box',
            lineAlignment: toolbarTextDefaults.lineAlignment,
            lineDirection, 
            wrapDirection: toolbarTextDefaults.wrapDirection,
            wrapAt: toolbarTextDefaults.wrapAt,
            lines: [
                {
                    spans: [
                        {
                            text: '',
                            meta: this.generateTextMeta(toolbarTextMeta),
                        },
                    ],
                },
            ],
        };

        const textPlacement = calculateTextPlacement(newTextDocument);
        const textPlacementWidth = isHorizontal ? textPlacement.lineDirectionSize : textPlacement.wrapDirectionSize;
        const textPlacementHeight = isHorizontal ? textPlacement.wrapDirectionSize : textPlacement.lineDirectionSize;
        if (textPlacementWidth > 1 && textPlacementHeight > 1) {
            createNewTextLayerSize.value.x = textPlacementWidth;
            createNewTextLayerSize.value.y = textPlacementHeight;
        }

        const insertLayerAction = new InsertLayerAction<InsertTextLayerOptions>({
            type: 'text',
            name: ensureUniqueLayerSiblingName(workingFileStore.state.layers[0]?.id, t('toolbar.text.newTextLayerName')),
            transform: new DOMMatrix().translate(
                isDynamic || !isHorizontal ? position.x - (createNewTextLayerSize.value.x / 2) : position.x,
                isDynamic || isHorizontal ? position.y - (createNewTextLayerSize.value.y / 2) : position.y,
            ),
            width: isDynamic || !isHorizontal ? createNewTextLayerSize.value.x : 1,
            height: isDynamic || isHorizontal ? createNewTextLayerSize.value.y : 1,
            data: newTextDocument,
        });
        const createTextLayerAction = new BundleAction('createTextLayer', 'action.createTextLayer', [insertLayerAction]);
        await historyStore.dispatch('runAction', {
            action: createTextLayerAction,
        });
        this.createdLayerId = insertLayerAction.insertedLayerId;
        const createdLayerId = this.createdLayerId;

        setTimeout(() => {
            editingTextLayerId.value = createdLayerId;
            this.editorTextarea?.focus();
        }, 50);
    }

    private generateTextMeta(meta: Record<string, any>) {
        const newMeta: Record<string, any> = {};
        for (const prop in meta) {
            if (textMetaDefaults[prop as keyof typeof textMetaDefaults] !== meta[prop]) {
                newMeta[prop] = meta[prop];
            }
        }
        return newMeta as Partial<typeof textMetaDefaults>;
    }

    private updateToolbarMetaFromActiveSelection() {
        if (editingTextLayerId.value == null) return;
        const editors = this.layerEditors.get(editingTextLayerId.value);
        if (editors == null) return;
        const { documentEditor, documentSelection } = editors;
        const selectionMeta = documentEditor.getMetaRange(
            documentSelection.start.line,
            documentSelection.start.character,
            documentSelection.end.line,
            documentSelection.end.character,
        );
        if (!documentSelection.isEmpty()) {
            documentEditor.queuedMetaChanges = null;
        }
        for (const key in selectionMeta) {
            if (documentEditor.queuedMetaChanges?.[key as keyof TextDocumentSpanMeta] != null) continue;
            const values = selectionMeta[key];
            if (values.length > 1) {
                toolbarTextMeta[key as keyof TextDocumentSpanMeta] = null;
            } else {
                toolbarTextMeta[key as keyof TextDocumentSpanMeta] = values[0];
            }
        }
    }

    private clearEditorTextarea() {
        if (!this.editorTextarea) return;
        this.editorTextarea.value = 'ab';
        this.editorTextarea.select();
        this.editorTextarea.setSelectionRange(1, 1);
    }

    private extractEditorTextareaInput() {
        if (!this.editorTextarea) return '';
        if (this.editorTextarea.value.length > CLEARED_EDITOR_TEXTAREA_LENGTH) {
            if (this.editorTextarea.value[0] === 'a' && this.editorTextarea.value[this.editorTextarea.value.length - 1] === 'b') {
                return this.editorTextarea.value.slice(1, -1);
            } else if (this.editorTextarea.value[1] === 'b') {
                return this.editorTextarea.value.slice(2);
            }
        }
        return '';
    }

    private isEditorTextareaBackspace() {
        return (
            this.editorTextarea?.value === 'b'
            && this.editorTextarea?.selectionStart === 0
            && this.editorTextarea?.selectionEnd === 0
        );
    }

    private isEditorTextareaBrokenBackspace() {
        return (
            this.editorTextarea?.value === 'a'
            && this.editorTextarea?.selectionStart === 1
            && this.editorTextarea?.selectionEnd === 1
        );
    }

    private isEditorTextareaDelete() {
        return (
            this.editorTextarea?.value === 'a'
            && this.editorTextarea?.selectionStart === 1
            && this.editorTextarea?.selectionEnd === 1
        );
    }

    private queueSaveEditorTextarea() {
        this.editorTextareaQueueSaveTimeoutHandle = window.setTimeout(
            this.saveEditorTextarea.bind(this),
            preferencesStore.get('textLayerSaveDelay')
        );
    }

    private async saveEditorTextarea(actionId: string = 'typeInTextLayer') {
        window.clearTimeout(this.editorTextareaQueueSaveTimeoutHandle);
        this.editorTextareaQueueSaveTimeoutHandle = undefined;
        if (this.isEditorTextareaDirty) {
            if (
                editingTextLayerId.value != null &&
                this.editingLayerDocumentOnFocusId === editingTextLayerId.value &&
                this.editingLayerDocumentOnFocus &&
                editingTextLayer.value?.data
            ) {
                const oldTextDocument = this.editingLayerDocumentOnFocus;
                this.editingLayerDocumentOnFocus = JSON.parse(JSON.stringify(editingTextLayer.value.data));
                this.isEditorTextareaDirty = false;
                await historyStore.dispatch('runAction', {
                    action: new BundleAction(actionId, `action.${actionId}`, [
                        new UpdateLayerAction<UpdateTextLayerOptions>({
                            id: editingTextLayerId.value,
                            data: editingTextLayer.value.data,
                        }, {
                            data: oldTextDocument
                        }),
                    ])
                });
            } else {
                console.error('[src/canvas/controllers/text.ts] Attempted to save text layer changes, but some data was out of sync.');
            }
        }
    }

    private pickLayer(viewTransformPoint: DOMPoint): number | null {
        const textLayers = getLayersByType('text').reverse();
        for (const alreadySelectedLayer of getSelectedLayers().filter(layer => layer.type === 'text')) {
            const layerTransform = getLayerGlobalTransform(alreadySelectedLayer.id).inverse();
            const layerTransformPoint = viewTransformPoint.matrixTransform(layerTransform);
            if (
                dragHandleHighlight.value != null
                || (
                    layerTransformPoint.x > 0 && layerTransformPoint.y > 0
                    && layerTransformPoint.x < alreadySelectedLayer.width && layerTransformPoint.y < alreadySelectedLayer.height
                )
            ) {
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

        if (editingTextLayerId.value == null || editingTextLayer.value == null) return null;
        const isHorizontal = ['ltr', 'rtl'].includes(editingTextLayer.value.data.lineDirection);

        if (transformBoundsPoint.y >= 0 - handleSize - touchForgivenessMargin && transformBoundsPoint.y <= 0 + innerHandleSizeVertical) {
            transformDragType = isHorizontal ? DRAG_TYPE_ALL : DRAG_TYPE_TOP;
        }
        if (transformBoundsPoint.y >= editingTextLayer.value.height - innerHandleSizeVertical && transformBoundsPoint.y <= editingTextLayer.value.height + handleSize + touchForgivenessMargin) {
            transformDragType = isHorizontal ? DRAG_TYPE_ALL : DRAG_TYPE_BOTTOM;
        }
        if (transformBoundsPoint.x >= 0 - handleSize - touchForgivenessMargin && transformBoundsPoint.x <= 0 + innerHandleSizeHorizontal) {
            transformDragType = isHorizontal ? DRAG_TYPE_LEFT : DRAG_TYPE_ALL;
        }
        if (transformBoundsPoint.x >= editingTextLayer.value.width - innerHandleSizeHorizontal && transformBoundsPoint.x <= editingTextLayer.value.width + handleSize + touchForgivenessMargin) {
            transformDragType = isHorizontal ? DRAG_TYPE_RIGHT : DRAG_TYPE_ALL;
        }
        if (
            transformBoundsPoint.x < 0 - handleSize - touchForgivenessMargin ||
            transformBoundsPoint.x > editingTextLayer.value.width + handleSize + touchForgivenessMargin ||
            transformBoundsPoint.y < 0 - handleSize - touchForgivenessMargin ||
            transformBoundsPoint.y > editingTextLayer.value.height + handleSize + touchForgivenessMargin
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
            const textPlacement = editingRenderTextPlacement.value;

            if (textPlacement.isHorizontal) {
                if (textPlacement.wrapDirection === 'btt') {
                    layerTransformPoint.y = textPlacement.wrapDirectionSize - layerTransformPoint.y;
                }

                findHorizontalCursor:
                for (const line of textPlacement.lines) {
                    const wrapBegin = line.wrapOffset;
                    const wrapEnd = wrapBegin + line.heightAboveBaseline + line.heightBelowBaseline;
                    const wrapMin = Math.min(wrapBegin, wrapEnd);
                    const wrapMax = Math.max(wrapBegin, wrapEnd);
                    if (layerTransformPoint.y >= wrapMin && layerTransformPoint.y <= wrapMax) {
                        cursor.line = line.documentLineIndex;
                        if (layerTransformPoint.x < line.lineStartOffset) {
                            cursor.character = line.glyphs[0]?.documentCharacterIndex ?? 0;
                            break findHorizontalCursor;
                        }
                        for (const glyph of line.glyphs) {
                            const left = glyph.advanceOffset;
                            const right = glyph.advanceOffset + glyph.advance;
                            if (layerTransformPoint.x >= left && layerTransformPoint.x <= right) {
                                let glyphCharacterIndex = Math.round(
                                    ((layerTransformPoint.x - left) / (right - left))
                                    * glyph.documentCharacterCount
                                );
                                if (glyph.bidiDirection === 'rtl') {
                                    glyphCharacterIndex = glyph.documentCharacterCount - glyphCharacterIndex;
                                }
                                cursor.character = glyph.documentCharacterIndex + glyphCharacterIndex;
                                break findHorizontalCursor;
                            }
                        }
                        if (line.glyphs.length > 0) {
                            const lastGlyphOnLine = line.glyphs[line.glyphs.length - 1];
                            cursor.character = lastGlyphOnLine.documentCharacterIndex + lastGlyphOnLine.documentCharacterCount;
                        }
                        break findHorizontalCursor;
                    }
                }
            } else { // Vertical
                if (textPlacement.wrapDirection === 'rtl') {
                    layerTransformPoint.x = textPlacement.wrapDirectionSize - layerTransformPoint.x;
                }

                findVerticalCursor:
                for (const line of textPlacement.lines) {
                    
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
                                const glyphCharacterIndex = Math.round(
                                    ((layerTransformPoint.y - top) / (bottom - top))
                                    * glyph.documentCharacterCount
                                );
                                cursor.character = glyph.documentCharacterIndex + glyphCharacterIndex;
                                break findVerticalCursor;
                            }
                        }
                        if (line.glyphs.length > 0) {
                            const lastGlyphOnLine = line.glyphs[line.glyphs.length - 1];
                            cursor.character = lastGlyphOnLine.documentCharacterIndex + lastGlyphOnLine.documentCharacterCount;
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
            if (editingTextLayer.value) {
                transformBoundsPoint =
                    new DOMPoint(this.lastCursorX * devicePixelRatio, this.lastCursorY * devicePixelRatio)
                    .matrixTransform(viewTransform.inverse())
                    .matrixTransform(editingTextLayer.value.transform.inverse());
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
            const dragHandle = this.dragStartDragType ?? dragHandleHighlight.value;
            determineResizeHandleIcon:
            if (dragHandle != null && editingTextLayerId.value != null) {
                if (editingTextLayer.value == null) break determineResizeHandleIcon;
                const textLayerTransform = getLayerGlobalTransform(editingTextLayer.value);
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
