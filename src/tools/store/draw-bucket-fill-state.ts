import { ref } from 'vue';

import { PerformantStore } from '@/store/performant-store';

import type { RGBAColor } from '@/types';

interface PermanentStorageState {
    antialias: boolean;
    colorPalette: RGBAColor[];
    colorPaletteIndex: number;
    feather: number;
    strength: number;
}

const permanentStorage = new PerformantStore<{ dispatch: {}, state: PermanentStorageState }>({
    name: 'drawBucketFillStateStore',
    state: {
        antialias: true,
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
        feather: 0,
        strength: 0.5,
    },
    restore: ['antialias', 'colorPalette', 'colorPaletteIndex', 'feather', 'strength'],
});

export const antialias = permanentStorage.getDeepWritableRef('antialias');
export const colorPalette = permanentStorage.getDeepWritableRef('colorPalette');
export const colorPaletteIndex = permanentStorage.getWritableRef('colorPaletteIndex');
export const feather = permanentStorage.getWritableRef('feather');
export const strength = permanentStorage.getWritableRef('strength');

export const colorPaletteDockTop = ref(0);
export const colorPaletteDockLeft = ref(0);
export const colorPaletteDockVisible = ref<boolean>(false);

export const strengthDockTop = ref(0);
export const strengthDockLeft = ref(0);
export const strengthDockVisible = ref<boolean>(false);

export const featherDockTop = ref(0);
export const featherDockLeft = ref(0);
export const featherDockVisible = ref<boolean>(false);

export const settingsDockTop = ref(0);
export const settingsDockLeft = ref(0);
export const settingsDockVisible = ref<boolean>(false);