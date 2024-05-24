import mitt from 'mitt';
import { ref, watch } from 'vue';
import defaultBrushDefinitions from '@/config/default-brushes.json';
import { PerformantStore } from '@/store/performant-store';

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

export const cursorHoverPosition = ref<DOMPoint>(new DOMPoint());

watch(() => [selectedBrushCategory.value, selectedBrush.value], ([category, brush]) => {
    const brushDefinition = brushDefinitions[category]?.brushes[brush];
    brushShape.value = brushDefinition.shape;
}, { immediate: true });

export const drawEmitter = mitt();

interface PermanentStorageState {
    brushSize: number;
    brushAlpha: number;
}

const permanentStorage = new PerformantStore<{ dispatch: {}, state: PermanentStorageState }>({
    name: 'eraseStateStore',
    state: {
        brushSize: 100,
        brushAlpha: 1,
    },
    restore: ['brushSize', 'brushAlpha']
});

export const brushSize = permanentStorage.getWritableRef('brushSize');
export const brushAlpha = permanentStorage.getWritableRef('brushAlpha');
