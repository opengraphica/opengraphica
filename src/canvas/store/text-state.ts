import { ref } from 'vue';

import { CalculatedTextPlacement, TextDocumentSelectionState } from '@/types';

export const isEditorTextareaFocused = ref<boolean>(false);
export const editingTextLayerId = ref<number | null>(null);
export const editingRenderTextPlacement = ref<CalculatedTextPlacement | null>(null);
export const editingTextDocumentSelection = ref<TextDocumentSelectionState | null>(null);