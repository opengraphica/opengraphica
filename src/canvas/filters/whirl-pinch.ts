import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

export interface WhirlPinchCanvasFilterParams {
    whirl?: number;
    pinch?: number;
    radius?: number;
    centerX?: number;
    centerY?: number;
}

export default class WhirlPinchCanvasFilter implements CanvasFilter<WhirlPinchCanvasFilterParams> {
    public name = 'whirlPinch';
    public params: WhirlPinchCanvasFilterParams = {};

    public getEditConfig() {
        return {
            whirl: {
                type: 'percentage',
                default: 0,
                preview: 0.5,
                min: -2,
                max: 2,
            },
            pinch: {
                type: 'percentage',
                default: 0,
                preview: 0,
                min: -2,
                max: 2,
            },
            radius: {
                type: 'percentage',
                default: 0.5,
                min: 0,
                max: 1,
            },
            centerX: {
                type: 'percentage',
                default: 0,
                min: -1,
                max: 1,
            },
            centerY: {
                type: 'percentage',
                default: 0,
                min: -1,
                max: 1,
            },
        } as CanvasFilterEditConfig;
    }
}
