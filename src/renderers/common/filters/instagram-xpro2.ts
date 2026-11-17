import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

export interface InstagramXpro2CanvasFilterParams {
    mix?: number;
}

export default class InstagramXpro2CanvasFilter implements CanvasFilter<InstagramXpro2CanvasFilterParams> {
    public name = 'instagramXpro2';
    public params: InstagramXpro2CanvasFilterParams = {};

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
