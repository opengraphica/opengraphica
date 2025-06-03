import { transfer8BitImageDataToLinearSrgb, transfer8BitImageDataToSrgb, transferSrgbTo8BitImageData, linearSrgbChannelToSrgbChannel } from '@/canvas/filters/color-space';

import { GrayscaleDesaturationMode, type GrayscaleCanvasFilterParams } from '@/canvas/filters/grayscale';
import type { CanvasFilter } from '@/types';

export function fragment(
    filter: CanvasFilter<GrayscaleCanvasFilterParams>,
    sourceImageData: Uint8ClampedArray,
    targetImageData: Uint8ClampedArray,
    dataPosition: number,
) {
    const mode = filter.params.mode ?? 0;
    const percentage = filter.params.mix ?? 0;

    let rgba: { r: number, g: number, b: number, alpha: number };

    var intensity = 0;
    if (mode === GrayscaleDesaturationMode.LUMINANCE) {
        rgba = transfer8BitImageDataToLinearSrgb(sourceImageData, dataPosition);
        intensity = linearSrgbChannelToSrgbChannel(rgba.r * 0.22 + rgba.g * 0.72 + rgba.b * 0.06);
    } else {
        rgba = transfer8BitImageDataToSrgb(sourceImageData, dataPosition);
        if (mode === GrayscaleDesaturationMode.LUMA) {
            intensity = rgba.r * 0.22 + rgba.g * 0.72 + rgba.b * 0.06;
        } else if (mode === GrayscaleDesaturationMode.LIGHTNESS) {
            intensity = 0.5 * (Math.max(rgba.r, rgba.g, rgba.b) + Math.min(rgba.r, rgba.g, rgba.b));
        } else if (mode === GrayscaleDesaturationMode.AVERAGE) {
            intensity = (rgba.r + rgba.g + rgba.b) / 3.0;
        } else if (mode === GrayscaleDesaturationMode.VALUE) {
            intensity = Math.max(rgba.r, rgba.g, rgba.b);
        }
    }

    rgba.r = (rgba.r * (1 - percentage)) + (intensity * percentage);
    rgba.g = (rgba.g * (1 - percentage)) + (intensity * percentage);
    rgba.b = (rgba.b * (1 - percentage)) + (intensity * percentage);

    return transferSrgbTo8BitImageData(rgba, targetImageData, dataPosition);
}
