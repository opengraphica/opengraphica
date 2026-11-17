import type { CanvasFilter, CanvasFilterEditConfig, RGBAColor } from '@/types';

export interface WhiteBalanceCanvasFilterParams {
    white?: RGBAColor;
}

export default class WhiteBalanceCanvasFilter implements CanvasFilter<WhiteBalanceCanvasFilterParams> {
    public name = 'whiteBalance';
    public params: WhiteBalanceCanvasFilterParams = {};

    public getEditConfig() {
        return {
            white: {
                type: 'color',
                default: { is: 'color', r: 1, g: 1, b: 1, alpha: 1, style: '#ffffff' },
            },
        } as CanvasFilterEditConfig;
    }
}
