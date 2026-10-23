import type { CanvasFilter, CanvasFilterEditConfig, RGBAColor } from '@/types';

export interface ZoomBlurCanvasFilterParams {
    strength?: number;
    centerX?: number;
    centerY?: number;
}

export default class ZoomBlurCanvasFilter implements CanvasFilter<ZoomBlurCanvasFilterParams> {
    public name = 'zoomBlur';
    public params: ZoomBlurCanvasFilterParams = {};

    public getEditConfig() {
        return {
            strength: {
                type: 'percentage',
                default: 0.15,
                min: 0,
                max: 1,
            },
            centerX: {
                type: 'percentage',
                default: 0,
                min: -1,
                max: 1,
            },
            centerY: {
                type: 'percentage',
                default: 0,
                min: -1,
                max: 1,
            },
        } as CanvasFilterEditConfig;
    }
}
