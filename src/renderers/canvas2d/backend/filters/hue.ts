import { transfer8BitImageDataToLinearSrgb, transferLinearSrgbTo8BitImageData, transfer8BitImageDataToSrgb, transferSrgbTo8BitImageData } from '@/canvas/filters/color-space';
import { colorToRgba, colorToHsla, linearSrgbaToOklab, oklabToLinearSrgba, lchaToLaba, labaToLcha } from '@/lib/color';

import { HueColorSpace, type HueCanvasFilterParams } from '@/canvas/filters/hue';
import type { CanvasFilter } from '@/types';

export function fragment(
    filter: CanvasFilter<HueCanvasFilterParams>,
    sourceImageData: Uint8ClampedArray,
    targetImageData: Uint8ClampedArray,
    dataPosition: number
) {
    const rotate = filter.params.rotate ?? 0;

    let rgba = filter.params.colorSpace === HueColorSpace.PERCEPTUAL_RGB
        ? transfer8BitImageDataToSrgb(sourceImageData, dataPosition)
        : transfer8BitImageDataToLinearSrgb(sourceImageData, dataPosition);

    if (filter.params.colorSpace === HueColorSpace.OKLAB) {
        const lcha = labaToLcha(linearSrgbaToOklab(rgba));
        lcha.h += rotate * 360;
        rgba = oklabToLinearSrgba(lchaToLaba(lcha));
    } else {
        const hsla = colorToHsla(rgba, 'rgba');
        hsla.h += rotate;
        rgba = colorToRgba(hsla, 'hsla');
    }

    if (filter.params.colorSpace === HueColorSpace.PERCEPTUAL_RGB) {
        return transferSrgbTo8BitImageData(rgba, targetImageData, dataPosition);
    } else {
        return transferLinearSrgbTo8BitImageData(rgba, targetImageData, dataPosition);
    }
}
