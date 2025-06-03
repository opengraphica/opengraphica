import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

export interface Instagram1997CanvasFilterParams {
    mix?: number;
}

export default class Instagram1997CanvasFilter implements CanvasFilter<Instagram1997CanvasFilterParams> {
    public name = 'instagram1997';
    public params: Instagram1997CanvasFilterParams = {};

    public getEditConfig() {
        return {
            mix: {
                type: 'percentage',
                default: 1,
                min: 0,
                max: 1
            }
        } as CanvasFilterEditConfig;
    }
}
