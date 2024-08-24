import { ref } from 'vue';
import defaultBrushDefinitions from '@/config/default-brushes.json';
import { PerformantStore } from '@/store/performant-store';

export const cursorHoverPosition = ref<DOMPoint>(new DOMPoint());

export const brushShape = ref(defaultBrushDefinitions.simple.brushes.circle.shape);

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
