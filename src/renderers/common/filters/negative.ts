import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

export enum NegativeInvertColorSpace {
    PERCEPTUAL_RGB = 0,
    LINEAR_RGB = 1
}

export interface NegativeCanvasFilterParams {
    colorSpace?: NegativeInvertColorSpace;
    invertRed?: boolean;
    invertGreen?: boolean;
    invertBlue?: boolean;
    invertValue?: boolean;
}

export default class NegativeCanvasFilter implements CanvasFilter<NegativeCanvasFilterParams> {
    public name = 'negative';
    public params: NegativeCanvasFilterParams = {};

    public getEditConfig() {
        return {
            colorSpace: {
                type: 'integer',
                constant: true,
                default: NegativeInvertColorSpace.PERCEPTUAL_RGB,
                options: [
                    { key: 'perceptualRgb', value: NegativeInvertColorSpace.PERCEPTUAL_RGB },
                    { key: 'linearRgb', value: NegativeInvertColorSpace.LINEAR_RGB }
                ]
            },
            invertRed: {
                type: 'boolean',
                constant: true,
                default: true
            },
            invertGreen: {
                type: 'boolean',
                constant: true,
                default: true
            },
            invertBlue: {
                type: 'boolean',
                constant: true,
                default: true
            },
            invertValue: {
                type: 'boolean',
                constant: true,
                default: false
            }
        } as CanvasFilterEditConfig;
    }
}
