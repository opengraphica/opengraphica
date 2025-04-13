import { transfer8BitImageDataToLinearSrgb, transferSrgbTo8BitImageData } from '@/canvas/filters/color-space';
import { linearSrgbaToOklab, labaToLcha } from '@/lib/color';

import { GradientMapColorSpace, type GradientMapCanvasFilterParams } from '@/canvas/filters/gradient-map';
import { sampleGradient } from '@/lib/gradient';

import type { CanvasFilter, WorkingFileGradientColorSpace } from '@/types';

const colorSpaceMap: Record<GradientMapColorSpace, WorkingFileGradientColorSpace> = {
    [GradientMapColorSpace.OKLAB]: 'oklab',
    [GradientMapColorSpace.PERCEPTUAL_RGB]: 'srgb',
    [GradientMapColorSpace.LINEAR_RGB]: 'linearSrgb',
};

export function fragment(
    filter: CanvasFilter<GradientMapCanvasFilterParams>,
    sourceImageData: Uint8ClampedArray,
    targetImageData: Uint8ClampedArray,
    dataPosition: number,
) {
    const percentage = filter.params.mix ?? 0;

    let rgba = transfer8BitImageDataToLinearSrgb(sourceImageData, dataPosition);
    
    const lcha = labaToLcha(linearSrgbaToOklab(rgba));

    var newRgba = sampleGradient(filter.params.gradient!, colorSpaceMap[filter.params.colorSpace!], lcha.l);

    rgba.r = (rgba.r * (1 - percentage)) + (newRgba.r * percentage);
    rgba.g = (rgba.g * (1 - percentage)) + (newRgba.g * percentage);
    rgba.b = (rgba.b * (1 - percentage)) + (newRgba.b * percentage);

    return transferSrgbTo8BitImageData(rgba, targetImageData, dataPosition);
}
