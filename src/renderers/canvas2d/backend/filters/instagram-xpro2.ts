import { transfer8BitImageDataToSrgb, transferSrgbTo8BitImageData } from '@/canvas/filters//color-space';
import { pointDistance2d } from '@/lib/math';

import { type InstagramXpro2CanvasFilterParams } from '@/canvas/filters/instagram-xpro2';
import type { CanvasFilter } from '@/types';

const stop1 = { r: 0.90196, g: 0.90588, b: 0.87843, a: 1.0 };
const stop2 = { r: 0.16862, g: 0.16470, b: 0.63137, a: 0.6 };

export function fragment(
    filter: CanvasFilter<InstagramXpro2CanvasFilterParams>,
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

    const radius = 0.85;
    
    const interpolation = Math.min(Math.max(pointDistance2d(0.0, 0.0, -0.5 + uvX, -0.5 + uvY) - (1.0 - radius), 0.0), 1.0);
    const gradientColor = {
        r: (interpolation * stop2.r) + (1.0 - interpolation) * stop1.r,
        g: (interpolation * stop2.g) + (1.0 - interpolation) * stop1.g,
        b: (interpolation * stop2.b) + (1.0 - interpolation) * stop1.b,
    } 

    rgba.r = (1.0 - ((1.0 - (rgba.r)) / Math.max(0.00001, (gradientColor.r))));
    rgba.g = (1.0 - ((1.0 - (rgba.g)) / Math.max(0.00001, (gradientColor.g))));
    rgba.b = (1.0 - ((1.0 - (rgba.b)) / Math.max(0.00001, (gradientColor.b))));

    rgba.r = rgba.r * 0.7 + (0.393 * rgba.r + 0.769 * rgba.g + 0.189 * rgba.b) * 0.3;
    rgba.g = rgba.g * 0.7 + (0.349 * rgba.r + 0.686 * rgba.g + 0.168 * rgba.b) * 0.3;
    rgba.b = rgba.b * 0.7 + (0.272 * rgba.r + 0.534 * rgba.g + 0.131 * rgba.b) * 0.3;

    rgba.r = (sourceR * (1 - mix)) + (rgba.r * mix);
    rgba.g = (sourceG * (1 - mix)) + (rgba.g * mix);
    rgba.b = (sourceB * (1 - mix)) + (rgba.b * mix);

    return transferSrgbTo8BitImageData(rgba, targetImageData, dataPosition);
}
