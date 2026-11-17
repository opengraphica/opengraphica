import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

export enum BrightnessMode {
    LUMINANCE = 0,
    GAMMA = 1,
    SHIFT = 2,
}

export interface BrightnessCanvasFilterParams {
    mode?: BrightnessMode;
    brightness?: number;
    effectiveRange?: number[];
    effectiveRangeFeather?: number[];
}

export default class BrightnessCanvasFilter implements CanvasFilter<BrightnessCanvasFilterParams> {
    public name = 'brightness';
    public params: BrightnessCanvasFilterParams = {};

    public getEditConfig() {
        return {
            mode: {
                type: 'integer',
                constant: true,
                default: BrightnessMode.LUMINANCE,
                options: [
                    { key: 'luminance', value: BrightnessMode.LUMINANCE },
                    { key: 'gamma', value: BrightnessMode.GAMMA },
                    { key: 'shift', value: BrightnessMode.SHIFT },
                ]
            },
            brightness: {
                type: 'percentage',
                default: 0,
                preview: 0.4,
                min: -1,
                max: 1
            },
            effectiveRange: {
                type: 'percentageRange',
                default: [0, 1],
                preview: [0, 1],
                min: 0,
                max: 1
            },
            effectiveRangeFeather: {
                type: 'percentageRange',
                default: [0, 1],
                preview: [0, 1],
                min: 0,
                max: 1
            }
        } as CanvasFilterEditConfig;
    }
}
