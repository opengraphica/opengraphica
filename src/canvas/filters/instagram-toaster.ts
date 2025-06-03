import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

export interface InstagramToasterCanvasFilterParams {
    mix?: number;
}

export default class InstagramToasterCanvasFilter implements CanvasFilter<InstagramToasterCanvasFilterParams> {
    public name = 'instagramToaster';
    public params: InstagramToasterCanvasFilterParams = {};

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
