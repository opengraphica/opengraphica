import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

export interface SepiaCanvasFilterParams {
}

export default class SepiaCanvasFilter implements CanvasFilter<SepiaCanvasFilterParams> {
    public name = 'sepia';
    public params: SepiaCanvasFilterParams = {};

    public getEditConfig() {
        return {
        } as CanvasFilterEditConfig;
    }
}
