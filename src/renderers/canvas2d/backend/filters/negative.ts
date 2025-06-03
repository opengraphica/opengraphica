import { transfer8BitImageDataToLinearSrgb, transferLinearSrgbTo8BitImageData, transfer8BitImageDataToSrgb, transferSrgbTo8BitImageData } from '@/canvas/filters/color-space';
import { colorToHsva, colorToRgba } from '@/lib/color';

import { NegativeInvertColorSpace, type NegativeCanvasFilterParams } from '@/canvas/filters/negative';
import type { CanvasFilter } from '@/types';

export function fragment(
    filter: CanvasFilter<NegativeCanvasFilterParams>,
    sourceImageData: Uint8ClampedArray,
    targetImageData: Uint8ClampedArray,
    dataPosition: number,
) {
    const colorSpace = filter.params.colorSpace ?? 0;
    const invertRed = filter.params.invertRed ?? false;
    const invertGreen = filter.params.invertGreen ?? false;
    const invertBlue = filter.params.invertBlue ?? false;
    const invertValue = filter.params.invertValue ?? false;

    let rgba = (colorSpace === NegativeInvertColorSpace.PERCEPTUAL_RGB)
        ? transfer8BitImageDataToSrgb(sourceImageData, dataPosition)
        : transfer8BitImageDataToLinearSrgb(sourceImageData, dataPosition);
    
    if (invertRed) {
        rgba.r = 1.0 - rgba.r;
    }
    if (invertGreen) {
        rgba.g = 1.0 - rgba.g;
    }
    if (invertBlue) {
        rgba.b = 1.0 - rgba.b;
    }
    if (invertValue) {
        const hsva = colorToHsva(rgba, 'rgba');
        hsva.v = 1.0 - hsva.v;
        rgba = colorToRgba(hsva, 'hsva');
    }
    
    return (colorSpace === NegativeInvertColorSpace.PERCEPTUAL_RGB)
        ? transferSrgbTo8BitImageData(rgba, targetImageData, dataPosition)
        : transferLinearSrgbTo8BitImageData(rgba, targetImageData, dataPosition);
}
