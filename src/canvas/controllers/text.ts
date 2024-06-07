import { watch, type WatchStopHandle } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import BaseCanvasMovementController from './base-movement';
import canvasStore from '@/store/canvas';
import { isInput } from '@/lib/events';
import { TextDocumentEditor, TextDocumentSelection, TextDocumentEditorWithSelection } from '@/lib/text-editor';
import { calculateTextPlacement } from '@/lib/text-render';
import workingFileStore, { getLayerById, getLayerGlobalTransform, getLayersByType } from '@/store/working-file';

import { isEditorTextareaFocused, editingTextLayerId, editingRenderTextPlacement, editingTextDocumentSelection } from '../store/text-state';

import type { WorkingFileTextLayer } from '@/types';
import type { DecomposedMatrix } from '@/lib/dom-matrix';

const DRAG_TYPE_ALL = 0;
const DRAG_TYPE_TOP = 1;
const DRAG_TYPE_BOTTOM = 2;
const DRAG_TYPE_LEFT = 4;
const DRAG_TYPE_RIGHT = 8;

export default class CanvasTextController extends BaseCanvasMovementController {

    private dragStartPickLayer: number | null = null;

    private editorTextarea: HTMLTextAreaElement | null = null;
    private editorTextareaId: string = 'textControllerKeyboardInput' + uuidv4();
    private isEditorTextareaFocused: boolean = false;
    private isEditorTextareaComposing: boolean = false;

    private layerEditors: Map<number, { documentEditor: TextDocumentEditor, documentSelection: TextDocumentSelection }> = new Map();
    private editingLayerId: number | null = null;

    private selectedLayerIdsUnwatch: WatchStopHandle | null = null;

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
            for (const newId of newIds ?? []) {
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
        }, { immediate: true });
        
    }

    onLeave(): void {
        this.destroyEditorTextarea();
        editingTextLayerId.value = null;

        this.selectedLayerIdsUnwatch?.();
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
                if (!event.shiftKey && !documentSelection.isEmpty()) {
                    documentSelection.isActiveSideEnd = false;
                    documentSelection.moveCharacterPrevious(0, false);
                } else if (event.ctrlKey) {
                    documentSelection.moveWordPrevious(event.shiftKey);
                } else {
                    documentSelection.moveCharacterPrevious(1, event.shiftKey);
                }
                break;
            case 'Right': case 'ArrowRight':
                if (!event.shiftKey && !documentSelection.isEmpty()) {
                    documentSelection.isActiveSideEnd = true;
                    documentSelection.moveCharacterNext(0, false);
                } else if (event.ctrlKey) {
                    documentSelection.moveWordNext(event.shiftKey);
                } else {
                    documentSelection.moveCharacterNext(1, event.shiftKey);
                }
                break;
            case 'Up': case 'ArrowUp':
                documentSelection.moveLinePrevious(1, event.shiftKey);
                break;
            case 'Down': case 'ArrowDown':
                documentSelection.moveLineNext(1, event.shiftKey);
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
            this.onDragStart();
        }
    }

    onPointerDown(e: PointerEvent): void {
        super.onPointerDown(e);
        if (isInput(e.target)) return;
        if (e.isPrimary && ['mouse', 'pen'].includes(e.pointerType) && e.button === 0) {
            this.onDragStart();
        }
    }

    async onPointerUp(e: PointerEvent): Promise<void> {
        super.onPointerUp(e);
        if (e.isPrimary) {
            this.onDragEnd();    
        }
    }

    private onDragStart() {
        let { viewTransformPoint } = this.getTransformedCursorInfo();
        this.dragStartPickLayer = this.pickLayer(viewTransformPoint);

        // TODO - check for drag handle click before doing this.
        setTimeout(() => {
            if (this.dragStartPickLayer != null) {
                editingTextLayerId.value = this.dragStartPickLayer;
                this.editorTextarea?.focus();
            }
        }, 0);
    }

    private onDragEnd() {
        
    }

    private pickLayer(viewTransformPoint: DOMPoint): number | null {
        const textLayers = getLayersByType('text').reverse();
        let selectedLayer: number | null = null;
        for (const layer of textLayers) {
            const layerTransform = getLayerGlobalTransform(layer.id).inverse();
            const layerTransformPoint = viewTransformPoint.matrixTransform(layerTransform);
            if (layerTransformPoint.x > 0 && layerTransformPoint.y > 0 && layerTransformPoint.x < layer.width && layerTransformPoint.y < layer.height) {
                selectedLayer = layer.id;
                break;
            }
        }
        return selectedLayer;
    }

    private getTransformedCursorInfo(): { viewTransformPoint: DOMPoint, /* transformBoundsPoint: DOMPoint, */ viewDecomposedTransform: DecomposedMatrix } {
        const devicePixelRatio = window.devicePixelRatio || 1;
        const viewTransform = canvasStore.get('transform');
        const viewDecomposedTransform = canvasStore.get('decomposedTransform');
        const viewTransformPoint = new DOMPoint(this.lastCursorX * devicePixelRatio, this.lastCursorY * devicePixelRatio)
            .matrixTransform(viewTransform.inverse());
        
        // const originTranslateX = left.value + (transformOriginX.value * width.value);
        // const originTranslateY = top.value + (transformOriginY.value * height.value);
        // const boundsTransform =
        //     new DOMMatrix()
        //     .translateSelf(originTranslateX, originTranslateY)
        //     .rotateSelf(rotation.value * Math.RADIANS_TO_DEGREES)
        //     .translateSelf(-originTranslateX, -originTranslateY);
        // const transformBoundsPoint =
        //     new DOMPoint(this.lastCursorX * devicePixelRatio, this.lastCursorY * devicePixelRatio)
        //     .matrixTransform(viewTransform.inverse())
        //     .matrixTransform(boundsTransform.inverse());
        return {
            viewTransformPoint,
            // transformBoundsPoint,
            viewDecomposedTransform
        };
    }

    protected handleCursorIcon() {
        let newIcon = super.handleCursorIcon();
        if (!newIcon) {
            newIcon = 'text';
        }
        canvasStore.set('cursor', newIcon);
        return newIcon;
    }
}
