import mitt from 'mitt';
import { ref } from 'vue';
import { PerformantStore } from '@/store/performant-store';

import type {
    RGBAColor,
} from '@/types';

export const cursorHoverPosition = ref<DOMPoint>(new DOMPoint());

interface PermanentStorageState {
    pickedColor: RGBAColor | null;
}

const permanentStorage = new PerformantStore<{ dispatch: {}, state: PermanentStorageState }>({
    name: 'drawColorPickerStateStore',
    state: {
        pickedColor: null,
    },
    restore: [],
});

export const pickedColor = permanentStorage.getWritableRef('pickedColor');

export const drawColorPickerEmitter = mitt();
