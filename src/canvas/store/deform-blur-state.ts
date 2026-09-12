import { ref } from 'vue';
import { PerformantStore } from '@/store/performant-store';

export const cursorHoverPosition = ref<DOMPoint>(new DOMPoint());
export const cursorHoverAngle = ref<number>(0);

export const brushShape = ref('M 1,0.5 A 0.5,0.5 0 0 1 0.5,1 0.5,0.5 0 0 1 0,0.5 0.5,0.5 0 0 1 0.5,0 0.5,0.5 0 0 1 1,0.5 Z');

interface PermanentStorageState {
    brushDensity: number;
    brushHardness: number;
    brushOpacity: number;
    brushPressureMinDensity: number;
    brushPressureMinSize: number;
    brushPressureTaper: number;
    brushSize: number;
    brushSmoothing: number;
    brushStrength: number;
}

const permanentStorage = new PerformantStore<{ dispatch: {}, state: PermanentStorageState }>({
    name: 'deformBlurStateStore',
    state: {
        brushDensity: 1,
        brushHardness: 0.5,
        brushOpacity: 1,
        brushPressureMinDensity: 0,
        brushPressureMinSize: 0,
        brushPressureTaper: 1,
        brushSize: 100,
        brushSmoothing: 0.45078125, // 25%
        brushStrength: 0.25,
    },
    restore: ['brushSize']
});

export const brushDensity = permanentStorage.getWritableRef('brushDensity');
export const brushHardness = permanentStorage.getWritableRef('brushHardness');
export const brushOpacity = permanentStorage.getWritableRef('brushOpacity');
export const brushPressureMinDensity = permanentStorage.getWritableRef('brushPressureMinDensity');
export const brushPressureMinSize = permanentStorage.getWritableRef('brushPressureMinSize');
export const brushPressureTaper = permanentStorage.getWritableRef('brushPressureTaper');
export const brushSize = permanentStorage.getWritableRef('brushSize');
export const brushSmoothing = permanentStorage.getWritableRef('brushSmoothing');
export const brushStrength = permanentStorage.getWritableRef('brushStrength');

export const hardnessDockTop = ref(0);
export const hardnessDockLeft = ref(0);
export const hardnessDockVisible = ref<boolean>(false);

export const opacityDockTop = ref(0);
export const opacityDockLeft = ref(0);
export const opacityDockVisible = ref<boolean>(false);

export const sizeDockTop = ref(0);
export const sizeDockLeft = ref(0);
export const sizeDockVisible = ref<boolean>(false);
export const isPreviewingSize = ref(false);

export const strengthDockTop = ref(0);
export const strengthDockLeft = ref(0);
export const strengthDockVisible = ref<boolean>(false);