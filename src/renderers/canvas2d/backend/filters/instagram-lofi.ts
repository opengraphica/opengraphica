import { transfer8BitImageDataToSrgb, transferSrgbTo8BitImageData } from '@/canvas/filters/color-space';
import { linearSrgbaToOklab, oklabToLinearSrgba, lchaToLaba, labaToLcha, srgbaToLinearSrgba, linearSrgbaToSrgba } from '@/lib/color';
import { pointDistance2d } from '@/lib/math';

import { type InstagramLofiCanvasFilterParams } from '@/canvas/filters/instagram-lofi';
import type { CanvasFilter } from '@/types';

const stop1 = { r: 0.0, g: 0.0, b: 0.0, a: 0.0 };
const stop2 = { r: 0.13333, g: 0.13333, b: 0.13333, a: 0.25 };

export function fragment(
    filter: CanvasFilter<InstagramLofiCanvasFilterParams>,
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

    const radius = 0.75;
    
    const interpolation = Math.min(Math.max(pointDistance2d(0.0, 0.0, -0.5 + uvX, -0.5 + uvY) - (1.0 - radius), 0.0), 1.0);
    const gradientColor = {
        r: (interpolation * stop2.r) + (1.0 - interpolation) * stop1.r,
        g: (interpolation * stop2.g) + (1.0 - interpolation) * stop1.g,
        b: (interpolation * stop2.b) + (1.0 - interpolation) * stop1.b,
        a: (interpolation * stop2.a) + (1.0 - interpolation) * stop1.a,
    } 
    rgba.r = (gradientColor.r * gradientColor.a) + (rgba.r * (1.0 - gradientColor.a));
    rgba.g = (gradientColor.g * gradientColor.a) + (rgba.g * (1.0 - gradientColor.a));
    rgba.b = (gradientColor.b * gradientColor.a) + (rgba.b * (1.0 - gradientColor.a));

    const chroma = Math.tan((Math.min(0.9999, -0.15) + 1.0) * Math.PI / 4.0);
    const lab = linearSrgbaToOklab(srgbaToLinearSrgba(rgba));
    const lch = labaToLcha(lab);
    let c = lch.c * chroma;
    c = Math.min(Math.max(c, 0.0), 1.0);
    lch.c = c;
    rgba = linearSrgbaToSrgba(oklabToLinearSrgba(lchaToLaba(lch)));

    const contrast = -1.0 + Math.tan((Math.min(0.9999, 0.2) + 1.0) * Math.PI / 4.0);
    rgba.r += (rgba.r - 0.5) * contrast;
    rgba.g += (rgba.g - 0.5) * contrast;
    rgba.b += (rgba.b - 0.5) * contrast;

    rgba.r = (sourceR * (1 - mix)) + (rgba.r * mix);
    rgba.g = (sourceG * (1 - mix)) + (rgba.g * mix);
    rgba.b = (sourceB * (1 - mix)) + (rgba.b * mix);

    return transferSrgbTo8BitImageData(rgba, targetImageData, dataPosition);
}
