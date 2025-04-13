import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

export enum HueColorSpace {
    OKLAB = 0,
    PERCEPTUAL_RGB = 1,
    LINEAR_RGB = 2,
}

export interface HueCanvasFilterParams {
    colorSpace?: HueColorSpace;
    rotate?: number;
}

export default class HueCanvasFilter implements CanvasFilter<HueCanvasFilterParams> {
    public name = 'hue';
    public params: HueCanvasFilterParams = {};

    public getEditConfig() {
        return {
            colorSpace: {
                type: 'integer',
                constant: true,
                default: HueColorSpace.OKLAB,
                options: [
                    { key: 'oklab', value: HueColorSpace.OKLAB },
                    { key: 'perceptualRgb', value: HueColorSpace.PERCEPTUAL_RGB },
                    { key: 'linearRgb', value: HueColorSpace.LINEAR_RGB }
                ]
            },
            rotate: {
                type: 'percentage',
                default: 0,
                preview: 0.3,
                min: -0.5,
                max: 0.5,
            }
        } as CanvasFilterEditConfig;
    }
}
