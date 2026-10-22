import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

export enum FilmGrainBlendMode {
    NORMAL = 0,
    SUBTRACT = 1,
    ADD = 2,
}

export interface FilmGrainCanvasFilterParams {
    grayscale?: boolean;
    intensity?: number;
    grainScale?: number;
    seed?: number;
    blendMode?: FilmGrainBlendMode;
}

export default class FilmGrainCanvasFilter implements CanvasFilter<FilmGrainCanvasFilterParams> {
    public name = 'filmGrain';
    public params: FilmGrainCanvasFilterParams = {};

    public getEditConfig() {
        return {
            grayscale: {
                type: 'boolean',
                constant: true,
                default: false,
            },
            intensity: {
                type: 'percentage',
                default: 0.25,
                preview: 0.4,
                min: 0,
                max: 1
            },
            grainScale: {
                type: 'percentage',
                default: 1,
                min: 0.1,
                max: 5,
            },
            seed: {
                type: 'percentage',
                default: 0,
                min: 0,
                max: 1,
            },
            blendMode: {
                type: 'integer',
                constant: true,
                default: FilmGrainBlendMode.NORMAL,
                options: [
                    { key: 'normal', value: FilmGrainBlendMode.NORMAL },
                    { key: 'subtract', value: FilmGrainBlendMode.SUBTRACT },
                    { key: 'add', value: FilmGrainBlendMode.ADD },
                ]
            },
        } as CanvasFilterEditConfig;
    }
}
