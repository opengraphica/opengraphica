import { type ColorCorrectionCanvasFilterParams } from '@/canvas/filters/color-correction';
import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

export function fragment(
    filter: CanvasFilter<ColorCorrectionCanvasFilterParams>,
    sourceImageData: Uint8ClampedArray,
    targetImageData: Uint8ClampedArray,
    dataPosition: number,
) {
    targetImageData[dataPosition] = sourceImageData[dataPosition];
    targetImageData[dataPosition + 1] = sourceImageData[dataPosition + 1];
    targetImageData[dataPosition + 2] = sourceImageData[dataPosition + 2];
    targetImageData[dataPosition + 3] = sourceImageData[dataPosition + 3];
}
