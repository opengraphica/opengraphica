import mitt from 'mitt';
import { computed, ref, watch } from 'vue';

import { useRenderer } from '@/renderers';

import { PerformantStore } from '@/store/performant-store';
import {
    getBrushById, brushPreviews, generateBrushPreview
} from '../store/brush-library-state';

import type { RGBAColor } from '@/types';

export const showBrushDrawer = ref<boolean>(false);

export const brushShape = ref<string>('');
export const brushHardness = ref<number>(1);
export const brushSpacing = ref<number>(0.05);
export const brushJitter = ref<number>(0);
export const brushPressureTaper = ref<number>(0);
export const brushPressureMinSize = ref<number>(1);
export const brushDensity = ref<number>(1);
export const brushPressureMinDensity = ref<number>(1);
export const brushAngle = ref<number>(0);
export const brushColorBlendingStrength = ref<number>(0);
export const brushPressureMinColorBlendingStrength = ref<number>(0);
export const brushColorBlendingPersistence = ref<number>(0);
export const brushConcentration = ref<number>(0);
export const brushPressureMinConcentration = ref<number>(0);

export const cursorHoverPosition = ref<DOMPoint>(new DOMPoint());

export const drawEmitter = mitt();

interface PermanentStorageState {
    brushSize: number;
    brushSmoothing: number;
    colorPalette: RGBAColor[];
    colorPaletteIndex: number;
    selectedBrush: string;
}

const permanentStorage = new PerformantStore<{ dispatch: {}, state: PermanentStorageState }>({
    name: 'drawBrushStateStore',
    state: {
        brushSize: 100,
        brushSmoothing: 0.45078125, // 25%,
        colorPalette: [
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
        colorPaletteIndex: 0,
        selectedBrush: 'simplePen'
    },
    restore: ['brushSize', 'colorPalette', 'colorPaletteIndex', 'selectedBrushCategory', 'selectedBrush'],
});

export const brushSize = permanentStorage.getWritableRef('brushSize');
export const brushSmoothing = permanentStorage.getWritableRef('brushSmoothing');
export const colorPalette = permanentStorage.getDeepWritableRef('colorPalette');
export const colorPaletteIndex = permanentStorage.getWritableRef('colorPaletteIndex');
export const selectedBrush = permanentStorage.getWritableRef('selectedBrush');

export const brushColor = computed(() => {
    return colorPalette.value[colorPaletteIndex.value];
});

export const colorPaletteDockTop = ref(0);
export const colorPaletteDockLeft = ref(0);
export const colorPaletteDockVisible = ref<boolean>(false);

export const sizeDockTop = ref(0);
export const sizeDockLeft = ref(0);
export const sizeDockVisible = ref<boolean>(false);

export const smoothingDockTop = ref(0);
export const smoothingDockLeft = ref(0);
export const smoothingDockVisible = ref<boolean>(false);

export const selectedBrushCategoryId = ref<string>();

export const selectedBrushPreview = computed<HTMLCanvasElement | undefined>(() => {
    return brushPreviews[selectedBrush.value];
});

watch(() => selectedBrush.value, (selectedBrush) => {
    const brushDefinition = getBrushById(selectedBrush);
    if (!brushDefinition) return;
    selectedBrushCategoryId.value = brushDefinition.categories[0];
    brushShape.value = brushDefinition.shape;
    brushHardness.value = brushDefinition.hardness ?? 1;
    brushPressureMinSize.value = brushDefinition.pressureMinSize ?? 1;
    brushPressureTaper.value = brushDefinition.pressureTaper ?? 0;
    brushSpacing.value = brushDefinition.spacing ?? 0.05;
    brushJitter.value = brushDefinition.jitter ?? 0;
    brushPressureMinDensity.value = brushDefinition.pressureMinDensity ?? 1;
    brushDensity.value = brushDefinition.density ?? 1;
    brushAngle.value = brushDefinition.angle ?? 0;
    brushColorBlendingStrength.value = brushDefinition.colorBlendingStrength ?? 0;
    brushPressureMinColorBlendingStrength.value = brushDefinition.pressureMinColorBlendingStrength ?? 0;
    brushColorBlendingPersistence.value = brushDefinition.colorBlendingPersistence ?? 0;
    brushConcentration.value = brushDefinition.concentration ?? 1;
    brushPressureMinConcentration.value = brushDefinition.pressureMinConcentration ?? 1;
}, { immediate: true });

export function generateSelectedBrushPreview() {
    if (!brushPreviews[selectedBrush.value]) {
        generateBrushPreview(selectedBrush.value);
    }
}
