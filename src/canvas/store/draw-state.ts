import mitt from 'mitt';
import { ref, watch } from 'vue';
import defaultBrushDefinitions from '@/config/default-brushes.json';

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
export const brushSize = ref<number>(100);
export const brushColor = ref<RGBAColor>({
    is: 'color',
    r: 0,
    g: 0,
    b: 0,
    alpha: 1,
    style: '#000000'
});

export const cursorHoverPosition = ref<DOMPoint>(new DOMPoint());

watch(() => [selectedBrushCategory.value, selectedBrush.value], ([category, brush]) => {
    const brushDefinition = brushDefinitions[category]?.brushes[brush];
    brushShape.value = brushDefinition.shape;
}, { immediate: true });


export const drawEmitter = mitt();