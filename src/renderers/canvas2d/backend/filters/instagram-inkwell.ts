import { transfer8BitImageDataToSrgb, transferSrgbTo8BitImageData } from '@/canvas/filters/color-space';

import { type InstagramInkwellCanvasFilterParams } from '@/canvas/filters/instagram-inkwell';
import type { CanvasFilter } from '@/types';

export function fragment(
    filter: CanvasFilter<InstagramInkwellCanvasFilterParams>,
    sourceImageData: Uint8ClampedArray,
    targetImageData: Uint8ClampedArray,
    dataPosition: number,
) {
    const mix = filter.params.mix ?? 0;

    let rgba = transfer8BitImageDataToSrgb(sourceImageData, dataPosition);
    const sourceR = rgba.r;
    const sourceG = rgba.g;
    const sourceB = rgba.b;

    rgba.r = rgba.r * 0.7 + (0.393 * rgba.r + 0.769 * rgba.g + 0.189 * rgba.b) * 0.3;
    rgba.g = rgba.g * 0.7 + (0.349 * rgba.r + 0.686 * rgba.g + 0.168 * rgba.b) * 0.3;
    rgba.b = rgba.b * 0.7 + (0.272 * rgba.r + 0.534 * rgba.g + 0.131 * rgba.b) * 0.3;

    const contrast = -1.0 + Math.tan((Math.min(0.9999, 0.1) + 1.0) * Math.PI / 4.0);
    rgba.r += (rgba.r - 0.5) * contrast;
    rgba.g += (rgba.g - 0.5) * contrast;
    rgba.b += (rgba.b - 0.5) * contrast;

    const brightness = 1.1;
    rgba.r = Math.min(Math.max(rgba.r * brightness, 0.0), 1.0);
    rgba.g = Math.min(Math.max(rgba.g * brightness, 0.0), 1.0);
    rgba.b = Math.min(Math.max(rgba.b * brightness, 0.0), 1.0);

    const intensity = (
        rgba.r * 0.22 +
        rgba.g * 0.72 +
        rgba.b * 0.06
    );

    rgba.r = (sourceR * (1 - mix)) + (intensity * mix);
    rgba.g = (sourceG * (1 - mix)) + (intensity * mix);
    rgba.b = (sourceB * (1 - mix)) + (intensity * mix);

    return transferSrgbTo8BitImageData(rgba, targetImageData, dataPosition);
}
