import fragmentShader from './chroma-key.frag';
import { transfer8BitImageDataToLinearSrgb, transferLinearSrgbTo8BitImageData } from '../color-space';
import { linearSrgbaToOklab, oklabToLinearSrgba, lchaToLaba, labaToLcha } from '@/lib/color';

import type { CanvasFilter, CanvasFilterEditConfig, RGBAColor } from '@/types';

interface ChromaKeyCanvasFilterParams {
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

    public getFragmentShader() {
        return fragmentShader;
    }

    public getVertexShader(){
        return undefined;
    }

    public fragment(sourceImageData: Uint8ClampedArray, targetImageData: Uint8ClampedArray, dataPosition: number) {
        // const mode = this.params.mode ?? 0;
        // const chroma = Math.tan((Math.min(0.9999, this.params.chroma ?? 0.0) + 1.0) * Math.PI / 4.0) + (mode === ChromaModifyMode.MULTIPLY ? 0.0 : -1.0);

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
