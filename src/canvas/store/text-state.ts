import mitt from 'mitt';
import { computed, reactive, ref } from 'vue';
import { textMetaDefaults } from '@/lib/text-common';
import { getLayerById, getLayerGlobalTransform } from '@/store/working-file';

import type { CalculatedTextPlacement, TextDocumentSelectionState, TextDocumentSpanMeta } from '@/types';

type RecordWithNull<T> = {
    [P in keyof T]: T[P] | null;
}

export const isEditorTextareaFocused = ref<boolean>(false);
export const editingTextLayerId = ref<number | null>(null);
export const editingRenderTextPlacement = ref<CalculatedTextPlacement | null>(null);
export const editingTextDocumentSelection = ref<TextDocumentSelectionState | null>(null);

export const dragHandleHighlight = ref<number | null>(null);

export const createNewTextLayerSize = ref<DOMPoint>(new DOMPoint(8.32, 43.583999999999996 ));

export const toolbarTextMeta = reactive<RecordWithNull<TextDocumentSpanMeta>>({ ...textMetaDefaults });

export const textToolbarEmitter = mitt();

export const overlaySelectionCursorPosition = ref<DOMPoint>(new DOMPoint());
export const overlaySelectionCursorSize = ref<number>(10);

export const editingLayerCssTransform = computed<string>(() => {
    if (editingTextLayerId.value == null) return '';
    const layer = getLayerById(editingTextLayerId.value);
    if (layer == null) return '';
    const transform = getLayerGlobalTransform(layer);
    return `matrix(${transform.a},${transform.b},${transform.c},${transform.d},${transform.e},${transform.f})`;
});
