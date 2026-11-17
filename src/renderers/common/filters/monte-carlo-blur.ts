import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

export interface MonteCarloBlurCanvasFilterParams {
    iterations?: number;
    size?: number;
}

export default class MonteCarloBlurCanvasFilter implements CanvasFilter<MonteCarloBlurCanvasFilterParams> {
    public name = 'monteCarloBlur';
    public params: MonteCarloBlurCanvasFilterParams = {};

    public getEditConfig() {
        return {
            iterations: {
                type: 'integer',
                constant: true,
                default: 32,
                preview: 32,
                options: [
                    { key: '1', value: 1 },
                    { key: '2', value: 2 },
                    { key: '4', value: 4 },
                    { key: '8', value: 8 },
                    { key: '16', value: 16 },
                    { key: '32', value: 32 },
                    { key: '64', value: 64 },
                ]
            },
            size: {
                type: 'percentage',
                default: 0.25,
                preview: 0.25,
                min: 0,
                max: 1,
            },
        } as CanvasFilterEditConfig;
    }
}
