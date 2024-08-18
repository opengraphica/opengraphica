import { computed, ref } from 'vue';

import { CalculatedTextPlacement, TextDocumentSelectionState } from '@/types';

export const isEditorTextareaFocused = ref<boolean>(false);
export const editingTextLayerId = ref<number | null>(null);
export const editingRenderTextPlacement = ref<CalculatedTextPlacement | null>(null);
export const editingTextDocumentSelection = ref<TextDocumentSelectionState | null>(null);

export const dragHandleHighlight = ref<number | null>(null);

// TODO - base on font and font size selection, use calculateTextPlacement() for a space character.
export const createNewTextLayerSize = ref<DOMPoint>(new DOMPoint(4, 18.75));
