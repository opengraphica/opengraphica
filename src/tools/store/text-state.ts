import mitt from 'mitt';
import { computed, reactive, ref } from 'vue';
import { textMetaDefaults } from '@/lib/text-common';
import { getLayerById, getLayerGlobalTransform } from '@/store/working-file';
import { PerformantStore } from '@/store/performant-store';

import type {
    CalculatedTextPlacement, RGBAColor,
    TextDocumentSelectionState, TextDocument, TextDocumentSpanMeta, WorkingFileTextLayer
} from '@/types';

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

export const editingTextLayer = ref<WorkingFileTextLayer | null>(null);

interface PermanentStorageState {
    fillColorPalette: RGBAColor[];
    fillColorPaletteIndex: number;
    lineAlignment: TextDocument['lineAlignment'],
    lineDirection: TextDocument['lineDirection'],
    wrapDirection: TextDocument['wrapDirection'],
    wrapAt: TextDocument['wrapAt'],
}

const permanentStorage = new PerformantStore<{ dispatch: {}, state: PermanentStorageState }>({
    name: 'textStateStore',
    state: {
        fillColorPalette: [
            {
                is: 'color',
                r: 0,
                g: 0,
                b: 0,
                alpha: 1,
                style: '#000000'
            },
            {
                is: 'color',
                r: 1,
                g: 1,
                b: 1,
                alpha: 1,
                style: '#ffffff'
            },
            {
                is: 'color',
                r: 1,
                g: 0,
                b: 0,
                alpha: 1,
                style: '#ff0000'
            },
        ],
        fillColorPaletteIndex: 0,
        lineAlignment: 'start',
        lineDirection: 'ltr',
        wrapDirection: 'ttb',
        wrapAt: 'wordThenLetter',
    },
    restore: ['fillColorPalette', 'fillColorPaletteIndex', 'lineAlignment', 'lineDirection', 'wrapDirection', 'wrapAt'],
});

export const fillColorPalette = permanentStorage.getDeepWritableRef('fillColorPalette');
export const fillColorPaletteIndex = permanentStorage.getWritableRef('fillColorPaletteIndex');

toolbarTextMeta.fillColor = fillColorPalette.value[fillColorPaletteIndex.value];

export const toolbarTextDefaults = reactive({
    lineAlignment: permanentStorage.getWritableRef('lineAlignment'),
    lineDirection: permanentStorage.getWritableRef('lineDirection'),
    wrapDirection: permanentStorage.getWritableRef('wrapDirection'),
    wrapAt: permanentStorage.getWritableRef('wrapAt'),
});

if (['ltr', 'rtl'].includes(toolbarTextDefaults.lineDirection) && !['ttb', 'btt'].includes(toolbarTextDefaults.wrapDirection)) {
    toolbarTextDefaults.wrapDirection = 'ttb';
}
if (['ttb', 'btt'].includes(toolbarTextDefaults.lineDirection) && !['ltr', 'rtl'].includes(toolbarTextDefaults.wrapDirection)) {
    toolbarTextDefaults.wrapDirection = 'rtl';
}

export const fillColorPaletteDockTop = ref(0);
export const fillColorPaletteDockLeft = ref(0);
export const fillColorPaletteDockVisible = ref<boolean>(false);