import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

export interface InstagramGinghamCanvasFilterParams {
    mix?: number;
}

export default class InstagramGinghamCanvasFilter implements CanvasFilter<InstagramGinghamCanvasFilterParams> {
    public name = 'instagramGingham';
    public params: InstagramGinghamCanvasFilterParams = {};

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
