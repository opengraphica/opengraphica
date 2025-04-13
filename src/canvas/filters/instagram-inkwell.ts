import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

export interface InstagramInkwellCanvasFilterParams {
    mix?: number;
}

export default class InstagramInkwellCanvasFilter implements CanvasFilter<InstagramInkwellCanvasFilterParams> {
    public name = 'instagramInkwell';
    public params: InstagramInkwellCanvasFilterParams = {};

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
