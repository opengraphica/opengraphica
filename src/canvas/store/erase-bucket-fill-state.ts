import { ref } from 'vue';

import { PerformantStore } from '@/store/performant-store';

interface PermanentStorageState {
    antialias: boolean;
    feather: number;
    opacity: number;
    strength: number;
}

const permanentStorage = new PerformantStore<{ dispatch: {}, state: PermanentStorageState }>({
    name: 'eraseBucketFillStateStore',
    state: {
        antialias: true,
        feather: 0,
        opacity: 1,
        strength: 0.5,
    },
    restore: ['antialias', 'feather', 'opacity', 'strength'],
});

export const antialias = permanentStorage.getDeepWritableRef('antialias');
export const feather = permanentStorage.getWritableRef('feather');
export const opacity = permanentStorage.getWritableRef('opacity');
export const strength = permanentStorage.getWritableRef('strength');

export const opacityDockTop = ref(0);
export const opacityDockLeft = ref(0);
export const opacityDockVisible = ref<boolean>(false);

export const strengthDockTop = ref(0);
export const strengthDockLeft = ref(0);
export const strengthDockVisible = ref<boolean>(false);

export const featherDockTop = ref(0);
export const featherDockLeft = ref(0);
export const featherDockVisible = ref<boolean>(false);

export const settingsDockTop = ref(0);
export const settingsDockLeft = ref(0);
export const settingsDockVisible = ref<boolean>(false);