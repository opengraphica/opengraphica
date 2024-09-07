import fragmentShader from './chroma.frag';
import { transfer8BitImageDataToLinearSrgb, transferLinearSrgbTo8BitImageData } from '../color-space';
import { linearSrgbaToOklab, oklabToLinearSrgba, lchaToLaba, labaToLcha } from '@/lib/color';

import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

enum ChromaModifyMode {
    MULTIPLY = 0,
    SHIFT = 1
}

interface ChromaCanvasFilterParams {
    chroma?: number;
    mode?: ChromaModifyMode;
}

export default class ChromaCanvasFilter implements CanvasFilter<ChromaCanvasFilterParams> {
    public name = 'chroma';
    public params: ChromaCanvasFilterParams = {};

    public getEditConfig() {
        return {
            mode: {
                type: 'integer',
                constant: true,
                default: ChromaModifyMode.MULTIPLY,
                options: [
                    { key: 'multiply', value: ChromaModifyMode.MULTIPLY },
                    { key: 'shift', value: ChromaModifyMode.SHIFT },
                ]
            },
            chroma: {
                type: 'percentage',
                default: 0,
                preview: 0.4,
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
        const mode = this.params.mode ?? 0;
        const chroma = Math.tan((Math.min(0.9999, this.params.chroma ?? 0.0) + 1.0) * Math.PI / 4.0) + (mode === ChromaModifyMode.MULTIPLY ? 0.0 : -1.0);

        let rgba = transfer8BitImageDataToLinearSrgb(sourceImageData, dataPosition);
        const laba = linearSrgbaToOklab(rgba);
        const lcha = labaToLcha(laba);
        if (mode === ChromaModifyMode.MULTIPLY) {
            lcha.c *= chroma;
        } else {
            if (chroma > 0) {
                lcha.c = lcha.c + (1.0 - lcha.c) * chroma / 4.0;
            } else {
                lcha.c = lcha.c * (1.0 - Math.abs(chroma));
            }
        }
        lcha.c = Math.min(1.0, Math.max(0.0, lcha.c));
        rgba = oklabToLinearSrgba(lchaToLaba(lcha));

        transferLinearSrgbTo8BitImageData(rgba, targetImageData, dataPosition);
    }
}
