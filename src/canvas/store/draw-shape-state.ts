import { computed, ref } from 'vue';

import { PerformantStore } from '@/store/performant-store';

import type { RGBAColor, WorkingFileVectorLayer } from '@/types';

export const cursorHoverPosition = ref<DOMPoint>(new DOMPoint());
export const editingLayers = ref<WorkingFileVectorLayer[]>([]);
export const showShapeDrawer = ref(false);

export const styleDockVisible = ref(false);
export const styleDockLeft = ref(0);
export const styleDockTop = ref(0);

export const hasVisibleToolbarOverlay = computed(() => {
    return showShapeDrawer.value;
});

interface PermanentStorageState {
    selectedShapeType: string;
    strokeColor: RGBAColor;
    strokeWidth: number;
    fillColor: RGBAColor;
}

const permanentStorage = new PerformantStore<{ dispatch: {}, state: PermanentStorageState }>({
    name: 'drawShapeStateStore',
    state: {
        selectedShapeType: 'rectangle',
        strokeColor: {
            is: 'color',
            r: 0,
            g: 0,
            b: 0,
            alpha: 1,
            style: '#000000'
        },
        strokeWidth: 0,
        fillColor: {
            is: 'color',
            r: 0,
            g: 0,
            b: 0,
            alpha: 1,
            style: '#000000'
        },
    },
    restore: ['selectedShapeType', 'strokeColor', 'fillColor'],
});

export const selectedShapeType = permanentStorage.getWritableRef('selectedShapeType');
export const strokeColor = permanentStorage.getWritableRef('strokeColor');
export const fillColor = permanentStorage.getWritableRef('fillColor');