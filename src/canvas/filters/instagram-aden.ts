import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

export interface InstagramAdenCanvasFilterParams {
    mix?: number;
}

export default class InstagramAdenCanvasFilter implements CanvasFilter<InstagramAdenCanvasFilterParams> {
    public name = 'instagramAden';
    public params: InstagramAdenCanvasFilterParams = {};

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
