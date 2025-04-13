import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

export interface InstagramLofiCanvasFilterParams {
    mix?: number;
}

export default class InstagramLofiCanvasFilter implements CanvasFilter<InstagramLofiCanvasFilterParams> {
    public name = 'instagramLofi';
    public params: InstagramLofiCanvasFilterParams = {};

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
