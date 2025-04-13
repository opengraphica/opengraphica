import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

export enum GrayscaleDesaturationMode {
    LUMINANCE = 0,
    LUMA = 1,
    LIGHTNESS = 2,
    AVERAGE = 3,
    VALUE = 4
}

export interface GrayscaleCanvasFilterParams {
    mode?: GrayscaleDesaturationMode,
    mix?: number;
}

export default class GrayscaleCanvasFilter implements CanvasFilter<GrayscaleCanvasFilterParams> {
    public name = 'grayscale';
    public params: GrayscaleCanvasFilterParams = {};

    public getEditConfig() {
        return {
            mode: {
                type: 'integer',
                constant: true,
                default: GrayscaleDesaturationMode.LUMINANCE,
                options: [
                    { key: 'luminance', value: GrayscaleDesaturationMode.LUMINANCE },
                    { key: 'luma', value: GrayscaleDesaturationMode.LUMA },
                    { key: 'lightness', value: GrayscaleDesaturationMode.LIGHTNESS },
                    { key: 'average', value: GrayscaleDesaturationMode.AVERAGE },
                    { key: 'value', value: GrayscaleDesaturationMode.VALUE }
                ],
                optionsHaveDescriptions: true
            },
            mix: {
                type: 'percentage',
                default: 1,
                min: 0,
                max: 1
            }
        } as CanvasFilterEditConfig;
    }
}
