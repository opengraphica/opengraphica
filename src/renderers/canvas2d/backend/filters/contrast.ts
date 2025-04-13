import { type ContrastCanvasFilterParams } from '@/canvas/filters/contrast';
import type { CanvasFilter } from '@/types';

export function fragment(
    filter: CanvasFilter<ContrastCanvasFilterParams>,
    sourceImageData: Uint8ClampedArray,
    targetImageData: Uint8ClampedArray,
    dataPosition: number
) {
    const contrast = -1.0 + Math.tan((Math.min(0.9999, filter.params.contrast ?? 0) + 1.0) * Math.PI / 4.0);
    const middleGray = (filter.params.middleGray ?? 0.5);

    const rgb = [sourceImageData[dataPosition + 0] / 255, sourceImageData[dataPosition + 1] / 255, sourceImageData[dataPosition + 2] / 255];

    targetImageData[dataPosition + 0] = (rgb[0] + (rgb[0] - middleGray) * contrast) * 255;
    targetImageData[dataPosition + 1] = (rgb[1] + (rgb[1] - middleGray) * contrast) * 255;
    targetImageData[dataPosition + 2] = (rgb[2] + (rgb[2] - middleGray) * contrast) * 255;
    targetImageData[dataPosition + 3] = sourceImageData[dataPosition + 3];
}
