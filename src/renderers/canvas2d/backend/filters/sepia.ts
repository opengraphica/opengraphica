import { type SepiaCanvasFilterParams } from '@/canvas/filters/sepia';
import type { CanvasFilter } from '@/types';

export function fragment(
    filter: CanvasFilter<SepiaCanvasFilterParams>,
    sourceImageData: Uint8ClampedArray,
    targetImageData: Uint8ClampedArray,
    dataPosition: number,
) {
    targetImageData[dataPosition] = sourceImageData[dataPosition];
    targetImageData[dataPosition + 1] = sourceImageData[dataPosition + 1];
    targetImageData[dataPosition + 2] = sourceImageData[dataPosition + 2];
    targetImageData[dataPosition + 3] = sourceImageData[dataPosition + 3];
}
