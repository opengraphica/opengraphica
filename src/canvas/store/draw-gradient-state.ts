import { computed, ref } from 'vue';
import { PerformantStore } from '@/store/performant-store';
import defaultGradientPresets from '@/config/default-gradients.json';
import { t } from '@/i18n';

import type {
    WorkingFileGradientLayer, WorkingFileGradientColorStop, WorkingFileGradientColorSpace,
    WorkingFileGradientFillType, WorkingFileGradientSpreadMethod, RGBAColor,
} from '@/types';

export const positionHandleRadius = 5;
export const colorStopHandleRadius = 3;
export const radiusMultiplierTouch = 2.5;

export const cursorHoverPosition = ref<DOMPoint>(new DOMPoint());
export const showStopDrawer = ref(false);
export const hasVisibleToolbarOverlay = computed(() => {
    return showStopDrawer.value;
});

export const editingLayers = ref<WorkingFileGradientLayer[]>([]);

export interface GradientPreset {
    name: string;
    stops: WorkingFileGradientColorStop<RGBAColor>[];
}

interface PermanentStorageState {
    activeColorStops: Array<WorkingFileGradientColorStop>;
    blendColorSpace: WorkingFileGradientColorSpace;
    fillType: WorkingFileGradientFillType;
    presets: GradientPreset[];
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
        presets: defaultGradientPresets.map((preset) => {
            preset.name = t(preset.name);
            return preset as GradientPreset;
        }),
        spreadMethod: 'pad',
    },
    restore: ['activeColorStops', 'blendColorSpace', 'fillType', 'presets', 'spreadMethod'],
});

export const activeColorStops = permanentStorage.getWritableRef('activeColorStops');
export const blendColorSpace = permanentStorage.getWritableRef('blendColorSpace');
export const fillType = permanentStorage.getWritableRef('fillType');
export const presets = permanentStorage.getDeepWritableRef('presets');
export const spreadMethod = permanentStorage.getWritableRef('spreadMethod');
