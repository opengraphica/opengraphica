import type { CanvasFilter, CanvasFilterEditConfig, RGBAColor } from '@/types';

export interface TiltShiftBlurCanvasFilterParams {
    blurRadius?: number;
    gradientRadius?: number;
    angle?: number;
    offset?: number;
}

export default class TiltShiftBlurCanvasFilter implements CanvasFilter<TiltShiftBlurCanvasFilterParams> {
    public name = 'TiltShiftBlur';
    public params: TiltShiftBlurCanvasFilterParams = {};

    public getEditConfig() {
        return {
            blurRadius: {
                type: 'percentage',
                default: 0.15,
                min: 0,
                max: 1,
            },
            gradientRadius: {
                type: 'percentage',
                default: 0.85,
                min: 0,
                max: 1,
            },
            angle: {
                type: 'percentage',
                default: 0,
                min: -1,
                max: 1,
            },
            offset: {
                type: 'percentage',
                default: 0,
                min: -1,
                max: 1,
            },
        } as CanvasFilterEditConfig;
    }
}
