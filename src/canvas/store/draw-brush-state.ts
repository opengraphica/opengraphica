import mitt from 'mitt';
import { computed, ref, watch } from 'vue';
import defaultBrushDefinitions from '@/config/default-brushes.json';
import { PerformantStore } from '@/store/performant-store';

import type { RGBAColor } from '@/types';

interface BrushDefinition {
    name: string;
    shape: string; // SVG path value that can be used as the shape of the brush
    minSize: number; // Percentage of selected size
    spacing: number; // Percentage of max brush width; determines how close brush steps are drawn together
    minDensity: number; // Percentage; opacity per brush step, low pen pressure
    maxDensity: number; // Percentage; opacity per brush step, high pen pressure
    angle: number; // Radians; rotation angle of shape
    aspectRatio: number; // < 0.5 scales width to 0 and > 0.5 scales height to 0
    colorBlendingFactor: number; // 0 ignores colors underneath brush, and 1 fully uses color underneath brush
    colorBlendingPersistence: number; // Higher values makes it take longer strokes for colorBlendingFactor to have an effect, and recover
    alphaBlendingFactor: number; // 0 always draws on top of transparent areas, and 1 never draws
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

export const brushSmoothing = ref<number>(0);
export const brushShape = ref<string>('');
export const brushMinSize = ref<number>(1);
export const brushSpacing = ref<number>(0.05);
export const brushMinDensity = ref<number>(1);
export const brushMaxDensity = ref<number>(1);
export const brushAngle = ref<number>(0);
export const brushAspectRatio = ref<number>(0.5);
export const brushColorBlendingFactor = ref<number>(0);
export const brushColorBlendingPersistence = ref<number>(0);
export const brushAlphaBlendingFactor = ref<number>(0);

export const cursorHoverPosition = ref<DOMPoint>(new DOMPoint());

export const drawEmitter = mitt();

interface PermanentStorageState {
    brushSize: number;
    brushColor: RGBAColor;
    selectedBrushCategory: string;
    selectedBrush: string;
}

const permanentStorage = new PerformantStore<{ dispatch: {}, state: PermanentStorageState }>({
    name: 'drawBrushStateStore',
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
        selectedBrushCategory: 'simple',
        selectedBrush: 'circle'
    },
    restore: ['brushSize', 'brushColor', 'selectedBrushCategory', 'selectedBrush'],
});

export const brushSize = permanentStorage.getWritableRef('brushSize');
export const brushColor = permanentStorage.getWritableRef('brushColor');
export const selectedBrushCategory = permanentStorage.getWritableRef('selectedBrushCategory');
export const selectedBrush = permanentStorage.getWritableRef('selectedBrush');

watch(() => [selectedBrushCategory.value, selectedBrush.value], ([category, brush]) => {
    const brushDefinition = brushDefinitions[category]?.brushes[brush];
    brushShape.value = brushDefinition.shape;
    brushMinSize.value = brushDefinition.minSize ?? 1;
    brushSpacing.value = brushDefinition.spacing ?? 0.05;
    brushMinDensity.value = brushDefinition.minDensity ?? 1;
    brushMaxDensity.value = brushDefinition.maxDensity ?? 1;
    brushAngle.value = brushDefinition.angle ?? 0;
    brushAspectRatio.value = brushDefinition.aspectRatio ?? 0.5;
    brushColorBlendingFactor.value = brushDefinition.colorBlendingFactor ?? 0;
    brushColorBlendingPersistence.value = brushDefinition.colorBlendingPersistence ?? 0;
    brushAlphaBlendingFactor.value = brushDefinition.alphaBlendingFactor ?? 0;
}, { immediate: true });
