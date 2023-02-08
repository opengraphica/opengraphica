import fragmentShader from './chroma.frag';
import { transfer8BitImageDataToLinearSrgb, transferLinearSrgbTo8BitImageData } from '../color-space';
import { linearRgbaToOklab, oklabToLinearRgba, lchaToLaba, labaToLcha } from '@/lib/color';

import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

interface ChromaCanvasFilterParams {
    chroma?: number;
}

export default class ChromaCanvasFilter implements CanvasFilter<ChromaCanvasFilterParams> {
    public name = 'chroma';
    public params: ChromaCanvasFilterParams = {};

    public getEditConfig() {
        return {
            chroma: {
                type: 'percentage',
                default: 0,
                preview: 0.25,
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
        const chroma = -1.0 + Math.tan((Math.min(0.9999, this.params.chroma ?? 0.0) + 1.0) * Math.PI / 4.0)

        let rgba = transfer8BitImageDataToLinearSrgb(sourceImageData, dataPosition);
        const laba = linearRgbaToOklab(rgba);
        const lcha = labaToLcha(laba);
        if (chroma > 0) {
            lcha.c = lcha.c + (1.0 - lcha.c) * chroma / 4.0;
        } else {
            lcha.c = lcha.c * (1.0 - Math.abs(chroma));
        }
        lcha.c = Math.min(1.0, Math.max(0.0, lcha.c));
        rgba = oklabToLinearRgba(lchaToLaba(lcha));

        transferLinearSrgbTo8BitImageData(rgba, targetImageData, dataPosition);
    }
}
