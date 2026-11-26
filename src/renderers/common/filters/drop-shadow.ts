import type { CanvasFilter, CanvasFilterEditConfig, RGBAColor } from '@/types';

export interface DropShadowCanvasFilterParams {
    xOffset?: number;
    yOffset?: number;
    blurRadius?: number;
    growRadius?: number;
    color?: RGBAColor;
}

export default class DropShadowCanvasFilter implements CanvasFilter<DropShadowCanvasFilterParams> {
    public name = 'dropShadow';
    public params: DropShadowCanvasFilterParams = {};
    public passes = 2;

    public getEditConfig() {
        return {
            color: {
                type: 'color',
                default: { is: 'color', r: 0, g: 0, b: 0, alpha: 1, style: '#000000' },
            },
            xOffset: {
                type: 'float',
                min: -1000,
                max: 1000,
                step: 10,
                units: 'px',
                default: 0,
                preview: 30,
            },
            yOffset: {
                type: 'float',
                min: -1000,
                max: 1000,
                step: 10,
                units: 'px',
                default: 0,
                preview: 30,
            },
            blurRadius: {
                type: 'float',
                min: 0,
                max: 1000,
                step: 10,
                units: 'px',
                default: 0,
                preview: 30,
            },
            growRadius: {
                type: 'float',
                min: 0,
                max: 1000,
                step: 10,
                units: 'px',
                default: 0,
            },
        } as CanvasFilterEditConfig;
    }

    public getExtendedBounds = (params: any) => {
        return [
            Math.abs(Math.min(-params.blurRadius - params.growRadius + params.xOffset, 0.0)),
            Math.abs(Math.min(-params.blurRadius - params.growRadius + params.yOffset, 0.0)),
            Math.max(params.blurRadius + params.growRadius + params.xOffset, 0.0),
            Math.max(params.blurRadius + params.growRadius + params.yOffset, 0.0),
        ];
    }
}