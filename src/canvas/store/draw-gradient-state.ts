import { ref } from 'vue';
import { PerformantStore } from '@/store/performant-store';

import type {
    WorkingFileGradientLayer, WorkingFileGradientColorStop, WorkingFileGradientColorSpace,
    WorkingFileGradientFillType, WorkingFileGradientSpreadMethod,
} from '@/types';

export const positionHandleRadius = 5;
export const colorStopHandleRadius = 3;

export const cursorHoverPosition = ref<DOMPoint>(new DOMPoint());

export const editingLayers = ref<WorkingFileGradientLayer[]>([]);

interface PermanentStorageState {
    activeColorStops: Array<WorkingFileGradientColorStop>;
    blendColorSpace: WorkingFileGradientColorSpace;
    fillType: WorkingFileGradientFillType;
    spreadMethod: WorkingFileGradientSpreadMethod;
}

const permanentStorage = new PerformantStore<{ dispatch: {}, state: PermanentStorageState }>({
    name: 'drawGradientStateStore',
    state: {
        activeColorStops: [
            {
                offset: 0,
                color: {
                    is: 'color',
                    r: 0, g: 0, b: 0, alpha: 1,
                    style: '#000000'
                }
            },
            {
                offset: 1,
                color: {
                    is: 'color',
                    r: 1, g: 1, b: 1, alpha: 1,
                    style: '#ffffff'
                }
            },
        ],
        blendColorSpace: 'oklab',
        fillType: 'linear',
        spreadMethod: 'pad',
    },
    restore: ['blendColorSpace', 'fillType', 'spreadMethod'],
});

export const activeColorStops = permanentStorage.getWritableRef('activeColorStops');
export const blendColorSpace = permanentStorage.getWritableRef('blendColorSpace');
export const fillType = permanentStorage.getWritableRef('fillType');
export const spreadMethod = permanentStorage.getWritableRef('spreadMethod');
