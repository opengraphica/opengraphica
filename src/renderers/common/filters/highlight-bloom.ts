import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';


export interface HighlightBloomCanvasFilterParams {
    threshold?: number;
    radius?: number;
    strength?: number;
}

export default class HighlightBloomCanvasFilter implements CanvasFilter<HighlightBloomCanvasFilterParams> {
    public name = 'highlightBloom';
    public params: HighlightBloomCanvasFilterParams = {};
    public passes = 2;
    public maxPassTextureSize = 512;

    public getEditConfig() {
        return {
            threshold: {
                type: 'percentageRange',
                default: [0.5, 0.5],
                preview: [0.3, 0.5],
                min: 0,
                max: 1
            },
            radius: {
                type: 'percentage',
                default: 0,
                preview: 0.2,
                min: 0,
                max: 1
            },
            strength: {
                type: 'percentage',
                default: 0,
                preview: 0.5,
                min: 0,
                max: 1
            },
        } as CanvasFilterEditConfig;
    }
}
