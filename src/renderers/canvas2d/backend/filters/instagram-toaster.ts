import { transfer8BitImageDataToSrgb, transferSrgbTo8BitImageData } from '@/canvas/filters/color-space';
import { pointDistance2d } from '@/lib/math';

import { type InstagramToasterCanvasFilterParams } from '@/canvas/filters/instagram-toaster';
import type { CanvasFilter } from '@/types';

const stop1 = { r: 0.50196, g: 0.30588, b: 0.05882 };
const stop2 = { r: 0.23137, g: 0.0, b: 0.23137 };

export function fragment(
    filter: CanvasFilter<InstagramToasterCanvasFilterParams>,
    sourceImageData: Uint8ClampedArray,
    targetImageData: Uint8ClampedArray,
    dataPosition: number,
    width: number,
    height: number,
) {
    const mix = filter.params.mix ?? 0;

    let rgba = transfer8BitImageDataToSrgb(sourceImageData, dataPosition);

    const uvX = ((dataPosition / 4) % width) / width;
    const uvY = 1.0 - Math.floor((dataPosition / 4) / width) / height;

    const sourceR = rgba.r;
    const sourceG = rgba.g;
    const sourceB = rgba.b;

    const radius = 1.25;
    
    const interpolation = Math.min(Math.max(pointDistance2d(0.0, 0.0, -0.5 + uvX, -0.5 + uvY) - (1.0 - radius), 0.0), 1.0);
    const gradientColor = {
        r: (interpolation * stop2.r) + (1.0 - interpolation) * stop1.r,
        g: (interpolation * stop2.g) + (1.0 - interpolation) * stop1.g,
        b: (interpolation * stop2.b) + (1.0 - interpolation) * stop1.b,
    } 

    rgba.r = (1.0 - ((1.0 - (rgba.r)) * (1.0 - (gradientColor.r))));
    rgba.g = (1.0 - ((1.0 - (rgba.g)) * (1.0 - (gradientColor.g))));
    rgba.b = (1.0 - ((1.0 - (rgba.b)) * (1.0 - (gradientColor.b))));

    const contrast = -1.0 + Math.tan((Math.min(0.9999, 0.3) + 1.0) * Math.PI / 4.0);
    rgba.r += (rgba.r - 0.5) * contrast;
    rgba.g += (rgba.g - 0.5) * contrast;
    rgba.b += (rgba.b - 0.5) * contrast;

    const brightness = 0.9;
    rgba.r = Math.min(Math.max(rgba.r * brightness, 0.0), 1.0);
    rgba.g = Math.min(Math.max(rgba.g * brightness, 0.0), 1.0);
    rgba.b = Math.min(Math.max(rgba.b * brightness, 0.0), 1.0);

    rgba.r = (sourceR * (1 - mix)) + (rgba.r * mix);
    rgba.g = (sourceG * (1 - mix)) + (rgba.g * mix);
    rgba.b = (sourceB * (1 - mix)) + (rgba.b * mix);

    return transferSrgbTo8BitImageData(rgba, targetImageData, dataPosition);
}
