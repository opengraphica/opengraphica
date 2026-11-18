import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

export interface RadialSpeedLinesCanvasFilterParams {
    centerRadius?: number;
    lineSpacing?: number;
    lineClumping?: number;
    lineThickness?: number;
    randomization?: number;
}

export default class RadialSpeedLinesCanvasFilter implements CanvasFilter<RadialSpeedLinesCanvasFilterParams> {
    public name = 'radialSpeedLines';
    public params: RadialSpeedLinesCanvasFilterParams = {};

    public getEditConfig() {
        return {
            centerRadius: {
                type: 'percentageRange',
                default: [0.3, 0.3],
                preview: [0.2, 1.0],
                min: 0,
                max: 1,
            },
            lineSpacing: {
                type: 'percentageRange',
                default: [0.3, 0.3],
                preview: [0.16, 0.36],
                min: 0.05,
                max: 1,
            },
            lineClumping: {
                type: 'percentageRange',
                default: [0.0, 0.0],
                preview: [0.0, 0.4],
                min: 0,
                max: 1,
            },
            lineThickness: {
                type: 'percentageRange',
                default: [0.2, 0.2],
                preview: [0.05, 0.2],
                min: 0,
                max: 1,
            },
            seed: {
                type: 'percentage',
                default: 0.5,
                preview: 0.5,
                min: 0,
                max: 1,
            },
        } as CanvasFilterEditConfig;
    }
}