import type { CanvasFilter, CanvasFilterEditConfig, RGBAColor } from '@/types';

export interface ChromaKeyCanvasFilterParams {
    eraseColor?: RGBAColor;
    eraseFactor?: number;
    fade?: number;
    hueWeight?: number;
    chromaWeight?: number;
    lightnessWeight?: number;
}

export default class ChromaKeyCanvasFilter implements CanvasFilter<ChromaKeyCanvasFilterParams> {
    public name = 'chromaKey';
    public params: ChromaKeyCanvasFilterParams = {};

    public getEditConfig() {
        return {
            eraseColor: {
                type: 'color',
                default: { is: 'color', r: 0, g: 1, b: 0, alpha: 1, style: '#00ff00' },
            },
            threshold: {
                type: 'percentage',
                default: 0.05,
                min: 0,
                max: 1
            },
            softness: {
                type: 'percentage',
                default: 0.05,
                min: 0,
                max: 1
            },
            spillSuppression: {
                type: 'percentage',
                default: 0.5,
                min: 0,
                max: 1
            },
            hueWeight: {
                type: 'percentage',
                default: 0.9,
                min: 0,
                max: 1,
            },
            chromaWeight: {
                type: 'percentage',
                default: 0.1,
                min: 0,
                max: 1,
            },
            lightnessWeight: {
                type: 'percentage',
                default: 0.1,
                min: 0,
                max: 1,
            },
        } as CanvasFilterEditConfig;
    }
}
