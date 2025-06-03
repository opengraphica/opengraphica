import { type GaussianBlurCanvasFilterParams } from '@/canvas/filters/gaussian-blur';
import type { CanvasFilter } from '@/types';

export function fragment(
    filter: CanvasFilter<GaussianBlurCanvasFilterParams>,
    sourceImageData: Uint8ClampedArray,
    targetImageData: Uint8ClampedArray,
    dataPosition: number,
) {
    targetImageData[dataPosition + 0] = sourceImageData[dataPosition + 0];
    targetImageData[dataPosition + 1] = sourceImageData[dataPosition + 1];
    targetImageData[dataPosition + 2] = sourceImageData[dataPosition + 2];
    targetImageData[dataPosition + 3] = sourceImageData[dataPosition + 3];
}
