import { computed, ref, watch } from 'vue';

import { PerformantStore } from '@/store/performant-store';
import {
    getBrushById, brushPreviews, generateBrushPreview
} from '../store/brush-library-state';

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

export const cursorHoverPosition = ref<DOMPoint>(new DOMPoint());

interface PermanentStorageState {
    brushSize: number;
    brushOpacity: number;
    brushSmoothing: number;
    selectedBrush: string;
}

const permanentStorage = new PerformantStore<{ dispatch: {}, state: PermanentStorageState }>({
    name: 'eraseBrushStateStore',
    state: {
        brushSize: 100,
        brushOpacity: 1,
        brushSmoothing: 0.45078125, // 25%,
        selectedBrush: 'simplePen',
    },
    restore: ['brushSize', 'brushOpacity', 'brushSmoothing', 'selectedBrush'],
});

export const brushSize = permanentStorage.getWritableRef('brushSize');
export const brushOpacity = permanentStorage.getWritableRef('brushOpacity');
export const brushSmoothing = permanentStorage.getWritableRef('brushSmoothing');
export const selectedBrush = permanentStorage.getWritableRef('selectedBrush');

export const opacityDockTop = ref(0);
export const opacityDockLeft = ref(0);
export const opacityDockVisible = ref<boolean>(false);

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
}, { immediate: true });

export function generateSelectedBrushPreview() {
    if (!brushPreviews[selectedBrush.value]) {
        generateBrushPreview(selectedBrush.value);
    }
}
