import { ref } from 'vue';
import { PerformantStore } from '@/store/performant-store';

export const cursorHoverPosition = ref<DOMPoint>(new DOMPoint());

type GradientColorSpace = 'oklab' | 'perceptualRgb' | 'linearRgb';
type GradientFillType = 'linear' | 'radial';
type GradientSpreadMethod = 'pad' | 'repeat' | 'reflect';

interface PermanentStorageState {
    colorSpace: GradientColorSpace;
    fillType: GradientFillType;
    spreadMethod: GradientSpreadMethod;
}

const permanentStorage = new PerformantStore<{ dispatch: {}, state: PermanentStorageState }>({
    name: 'drawGradientStateStore',
    state: {
        colorSpace: 'oklab',
        fillType: 'linear',
        spreadMethod: 'pad',
    },
    restore: ['colorSpace', 'fillType', 'spreadMethod'],
});

export const colorSpace = permanentStorage.getWritableRef('colorSpace');
export const fillType = permanentStorage.getWritableRef('fillType');
export const spreadMethod = permanentStorage.getWritableRef('spreadMethod');
