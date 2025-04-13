import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

export interface ColorCorrectionCanvasFilterParams {
}

export default class ColorCorrectionCanvasFilter implements CanvasFilter<ColorCorrectionCanvasFilterParams> {
    public name = 'colorCorrection';
    public params: ColorCorrectionCanvasFilterParams = {};

    public getEditConfig() {
        return {
        } as CanvasFilterEditConfig;
    }
}
