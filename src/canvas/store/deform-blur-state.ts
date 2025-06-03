import { ref } from 'vue';
import { PerformantStore } from '@/store/performant-store';

export const cursorHoverPosition = ref<DOMPoint>(new DOMPoint());

export const brushShape = ref('M 1,0.5 A 0.5,0.5 0 0 1 0.5,1 0.5,0.5 0 0 1 0,0.5 0.5,0.5 0 0 1 0.5,0 0.5,0.5 0 0 1 1,0.5 Z');

interface PermanentStorageState {
    brushSize: number;
}

const permanentStorage = new PerformantStore<{ dispatch: {}, state: PermanentStorageState }>({
    name: 'deformBlurStateStore',
    state: {
        brushSize: 100,
    },
    restore: ['brushSize']
});

export const brushSize = permanentStorage.getWritableRef('brushSize');
