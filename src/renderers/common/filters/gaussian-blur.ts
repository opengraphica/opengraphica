import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

export interface GaussianBlurCanvasFilterParams {
    xRadius?: number;
    yRadius?: number;
}

export default class GaussianBlurCanvasFilter implements CanvasFilter<GaussianBlurCanvasFilterParams> {
    public name = 'gaussianBlur';
    public params: GaussianBlurCanvasFilterParams = {};
    public passes = 2;

    public getEditConfig() {
        return {
            xRadius: {
                type: 'percentage',
                default: 0.2,
                min: 0,
                max: 1
            },
            yRadius: {
                type: 'percentage',
                default: 0.2,
                min: 0,
                max: 1
            }
        } as CanvasFilterEditConfig;
    }

}
