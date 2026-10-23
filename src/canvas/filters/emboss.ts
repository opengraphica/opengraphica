import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

export enum EmbossType {
    BLEND = 0,
    HEIGHTMAP = 1,
}

export interface EmbossCanvasFilterParams {
    type?: EmbossType;
    angle?: number;
    elevation?: number;
}

export default class EmbossCanvasFilter implements CanvasFilter<EmbossCanvasFilterParams> {
    public name = 'emboss';
    public params: EmbossCanvasFilterParams = {};

    public getEditConfig() {
        return {
            type: {
                type: 'integer',
                constant: true,
                default: EmbossType.BLEND,
                options: [
                    { key: 'blend', value: EmbossType.BLEND },
                    { key: 'heightmap', value: EmbossType.HEIGHTMAP }
                ]
            },
            angle: {
                type: 'percentage',
                default: 0,
                min: 0,
                max: 1,
            },
            elevation: {
                type: 'percentage',
                default: 0.5,
                preview: 0.75,
                min: 0,
                max: 1,
            },
        } as CanvasFilterEditConfig;
    }
}