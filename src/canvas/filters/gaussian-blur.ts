import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

export interface GaussianBlurCanvasFilterParams {
    size?: number;
    pixelSize?: number;
    xIntensity?: number;
    yIntensity?: number;
}

export default class GaussianBlurCanvasFilter implements CanvasFilter<GaussianBlurCanvasFilterParams> {
    public name = 'gaussianBlur';
    public params: GaussianBlurCanvasFilterParams = {};

    public getEditConfig() {
        return {
            size: {
                type: 'percentage',
                default: 0,
                preview: 0.1,
                min: 0,
                max: 1
            },
            pixelSize: {
                type: 'integer',
                default: 0,
                constant: true,
                hidden: true,
                computedValue(params: GaussianBlurCanvasFilterParams, info) {
                    return (Math.round((params?.size ?? 1) * Math.max(info.layerWidth, info.layerHeight))) || 100;
                }
            },
            xIntensity: {
                type: 'percentage',
                default: 1,
                min: 0,
                max: 1
            },
            yIntensity: {
                type: 'percentage',
                default: 1,
                min: 0,
                max: 1
            }
        } as CanvasFilterEditConfig;
    }

}
