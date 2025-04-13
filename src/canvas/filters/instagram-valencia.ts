import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

export interface InstagramValenciaCanvasFilterParams {
    mix?: number;
}

export default class InstagramValenciaCanvasFilter implements CanvasFilter<InstagramValenciaCanvasFilterParams> {
    public name = 'instagramValencia';
    public params: InstagramValenciaCanvasFilterParams = {};

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
