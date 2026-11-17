import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

export interface InstagramClarendonCanvasFilterParams {
    mix?: number;
}

export default class InstagramClarendonCanvasFilter implements CanvasFilter<InstagramClarendonCanvasFilterParams> {
    public name = 'instagramClarendon';
    public params: InstagramClarendonCanvasFilterParams = {};

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
