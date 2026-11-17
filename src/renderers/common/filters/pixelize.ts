import type { CanvasFilter, CanvasFilterEditConfig, RGBAColor } from '@/types';

export interface PixelizeCanvasFilterParams {
    size?: number;
    offsetX?: number;
    offsetY?: number;
}

export default class PixelizeCanvasFilter implements CanvasFilter<PixelizeCanvasFilterParams> {
    public name = 'pixelize';
    public params: PixelizeCanvasFilterParams = {};

    public getEditConfig() {
        return {
            size: {
                type: 'percentage',
                default: 0.35,
                min: 0,
                max: 1,
            },
            offsetX: {
                type: 'percentage',
                default: 0,
                min: -1,
                max: 1,
            },
            offsetY: {
                type: 'percentage',
                default: 0,
                min: -1,
                max: 1,
            },
        } as CanvasFilterEditConfig;
    }
}
