import fragmentShader from './white-balance.frag';
import { transfer8BitImageDataToLinearSrgb, transferLinearSrgbTo8BitImageData } from '../color-space';
import { linearSrgbaToOklab, oklabToLinearSrgba, lchaToLaba, labaToLcha } from '@/lib/color';

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
        // const laba = linearSrgbaToOklab(rgba);
        // const lcha = labaToLcha(laba);
        // if (mode === ChromaModifyMode.MULTIPLY) {
        //     lcha.c *= chroma;
        // } else {
        //     if (chroma > 0) {
        //         lcha.c = lcha.c + (1.0 - lcha.c) * chroma / 4.0;
        //     } else {
        //         lcha.c = lcha.c * (1.0 - Math.abs(chroma));
        //     }
        // }
        // lcha.c = Math.min(1.0, Math.max(0.0, lcha.c));
        // rgba = oklabToLinearSrgba(lchaToLaba(lcha));

        transferLinearSrgbTo8BitImageData(rgba, targetImageData, dataPosition);
    }
}
