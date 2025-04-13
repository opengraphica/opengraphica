import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

export interface ContrastCanvasFilterParams {
    contrast?: number;
    middleGray?: number;
}

export default class ContrastCanvasFilter implements CanvasFilter<ContrastCanvasFilterParams> {
    public name = 'contrast';
    public params: ContrastCanvasFilterParams = {};

    public getEditConfig() {
        return {
            contrast: {
                type: 'percentage',
                default: 0,
                preview: 0.3,
                min: -1,
                max: 1
            },
            middleGray: {
                type: 'percentage',
                default: 0.5,
                min: 0,
                max: 1
            }
        } as CanvasFilterEditConfig;
    }
}
