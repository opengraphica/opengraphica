import fragmentShader from './saturation.frag';
import { transfer8BitImageDataToLinearSrgb, transferLinearSrgbTo8BitImageData } from '../color-space';
import { linearSrgbaToOklab, oklabToLinearSrgba, lchaToLaba, labaToLcha } from '@/lib/color';

import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

interface SaturationCanvasFilterParams {
    saturation?: number;
}

export default class SaturationCanvasFilter implements CanvasFilter<SaturationCanvasFilterParams> {
    public name = 'saturation';
    public params: SaturationCanvasFilterParams = {};

    public getEditConfig() {
        return {
            saturation: {
                type: 'percentage',
                default: 0,
                preview: 0.5,
                min: -1,
                max: 1
            }
        } as CanvasFilterEditConfig;
    }

    public getFragmentShader() {
        return fragmentShader;
    }

    public getVertexShader(){
        return undefined;
    }

    public fragment(sourceImageData: Uint8ClampedArray, targetImageData: Uint8ClampedArray, dataPosition: number) {
        const saturation = (this.params.saturation ?? 0.0);

        let rgba = transfer8BitImageDataToLinearSrgb(sourceImageData, dataPosition);
        const laba = linearSrgbaToOklab(rgba);
        const lcha = labaToLcha(laba);
        // let s = Math.sqrt(laba.a * laba.a + laba.b * laba.b) / laba.l;
        // const { l, c } = lcha;
        // if (saturation > 0) {
        //     s = s + (1.0 - s) * saturation;
        // } else {
        //     s = s * (1.0 - Math.abs(saturation));
        // }
        // lcha.c = Math.abs(l * s) / (Math.sqrt(s * s - saturation * saturation));
        // lcha.l = Math.abs((c * Math.sqrt(-(s*s) + saturation * saturation)) / s);
        if (saturation > 0) {
            lcha.c = lcha.c + (1.0 - lcha.c) * saturation;
        } else {
            lcha.c = lcha.c * (1.0 - Math.abs(saturation));
        }
        lcha.c = Math.min(1.0, Math.max(0.0, lcha.c));
        rgba = oklabToLinearSrgba(lchaToLaba(lcha));

        transferLinearSrgbTo8BitImageData(rgba, targetImageData, dataPosition);
    }
}
