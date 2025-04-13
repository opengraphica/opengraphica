import { transfer8BitImageDataToLinearSrgb, transferLinearSrgbTo8BitImageData } from '@/canvas/filters/color-space';
import { linearSrgbaToOklab, oklabToLinearSrgba, lchaToLaba, labaToLcha } from '@/lib/color';
import { ChromaModifyMode, type ChromaCanvasFilterParams } from '@/canvas/filters/chroma';

import type { CanvasFilter } from '@/types';

export function fragment(
    filter: CanvasFilter<ChromaCanvasFilterParams>,
    sourceImageData: Uint8ClampedArray,
    targetImageData: Uint8ClampedArray,
    dataPosition: number,
) {
    const mode = filter.params.mode ?? 0;
    const chroma = Math.tan((Math.min(0.9999, filter.params.chroma ?? 0.0) + 1.0) * Math.PI / 4.0) + (mode === ChromaModifyMode.MULTIPLY ? 0.0 : -1.0);

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
