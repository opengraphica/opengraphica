import fragmentShader from './white-balance.frag';
import { transfer8BitImageDataToLinearSrgb, transferLinearSrgbTo8BitImageData } from '../color-space';
import { linearSrgbaToOklab, srgbaToLinearSrgba, oklabToLinearSrgba, lchaToLaba, labaToLcha } from '@/lib/color';

import type { CanvasFilter, CanvasFilterEditConfig, RGBAColor } from '@/types';

interface WhiteBalanceCanvasFilterParams {
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

    public getFragmentShader() {
        return fragmentShader;
    }

    public getVertexShader(){
        return undefined;
    }

    public fragment(sourceImageData: Uint8ClampedArray, targetImageData: Uint8ClampedArray, dataPosition: number) {
        let rgba = transfer8BitImageDataToLinearSrgb(sourceImageData, dataPosition);

        let white = this.params.white!;
        let whiteLab = linearSrgbaToOklab(srgbaToLinearSrgba(white));
        
        rgba.r *= whiteLab.l / white.r;
        rgba.g *= whiteLab.l / white.g;
        rgba.b *= whiteLab.l / white.b;

        transferLinearSrgbTo8BitImageData(rgba, targetImageData, dataPosition);
    }
}
