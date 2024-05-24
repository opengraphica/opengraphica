import mitt from 'mitt';
import { computed, ref, watch } from 'vue';
import defaultBrushDefinitions from '@/config/default-brushes.json';
import { PerformantStore } from '@/store/performant-store';

import type { RGBAColor } from '@/types';

interface BrushDefinition {
    name: string;
    shape: string;
}

interface BrushDefinitionLibrary {
    [key: string]: {
        name: string;
        brushes: {
            [key: string]: BrushDefinition;
        }
    }
}

const brushDefinitions: BrushDefinitionLibrary = { ...defaultBrushDefinitions } as unknown as BrushDefinitionLibrary;

export const selectedBrushCategory = ref<string>('simple');
export const selectedBrush = ref<string>('circle');

export const brushShape = ref<string>('');

export const cursorHoverPosition = ref<DOMPoint>(new DOMPoint());

watch(() => [selectedBrushCategory.value, selectedBrush.value], ([category, brush]) => {
    const brushDefinition = brushDefinitions[category]?.brushes[brush];
    brushShape.value = brushDefinition.shape;
}, { immediate: true });

export const drawEmitter = mitt();

interface PermanentStorageState {
    brushSize: number;
    brushColor: RGBAColor;
}

const permanentStorage = new PerformantStore<{ dispatch: {}, state: PermanentStorageState }>({
    name: 'drawStateStore',
    state: {
        brushSize: 100,
        brushColor: {
            is: 'color',
            r: 0,
            g: 0,
            b: 0,
            alpha: 1,
            style: '#000000'
        },
    },
    restore: ['brushSize', 'brushColor']
});

export const brushSize = permanentStorage.getWritableRef('brushSize');
export const brushColor = permanentStorage.getWritableRef('brushColor');
