import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

export interface SpreadCanvasFilterParams {
    horizontal?: number;
    vertical?: number;
    seed?: number;
}

export default class SpreadCanvasFilter implements CanvasFilter<SpreadCanvasFilterParams> {
    public name = 'spread';
    public params: SpreadCanvasFilterParams = {};

    public getEditConfig() {
        return {
            horizontal: {
                type: 'percentage',
                default: 0.1,
                preview: 0.1,
                min: 0,
                max: 1
            },
            vertical: {
                type: 'percentage',
                default: 0.1,
                preview: 0.1,
                min: 0,
                max: 1
            },
            seed: {
                type: 'percentage',
                default: 0,
                min: 0,
                max: 1,
            },
        } as CanvasFilterEditConfig;
    }
}
