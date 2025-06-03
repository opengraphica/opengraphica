import { transfer8BitImageDataToSrgb, transferSrgbTo8BitImageData, srgbChannelToLinearSrgbChannel, linearSrgbChannelToSrgbChannel } from '@/canvas/filters/color-space';
import { linearSrgbaToOklab, oklabToLinearSrgba, lchaToLaba, labaToLcha, srgbaToLinearSrgba, linearSrgbaToSrgba } from '@/lib/color';

import { type InstagramClarendonCanvasFilterParams } from '@/canvas/filters/instagram-clarendon';
import type { CanvasFilter } from '@/types';

const overlayFill = { r: 0.49803, g: 0.73333, b: 0.89019, a: 0.2 };

function step(edge: number, x: number) {
    return x < edge ? 0.0 : 1.0;
}


export function fragment(
    filter: CanvasFilter<InstagramClarendonCanvasFilterParams>,
    sourceImageData: Uint8ClampedArray,
    targetImageData: Uint8ClampedArray,
    dataPosition: number,
) {
    const mix = filter.params.mix ?? 0;

    let rgba = transfer8BitImageDataToSrgb(sourceImageData, dataPosition);
    const sourceR = rgba.r;
    const sourceG = rgba.g;
    const sourceB = rgba.b;

    const topR = rgba.r;
    const bottomR = linearSrgbChannelToSrgbChannel(overlayFill.r);
    const topG = rgba.g;
    const bottomG = linearSrgbChannelToSrgbChannel(overlayFill.g);
    const topB = rgba.b;
    const bottomB = linearSrgbChannelToSrgbChannel(overlayFill.b);
    rgba.r = (rgba.r * (1.0 - overlayFill.a))
        + srgbChannelToLinearSrgbChannel(
            (step(bottomR, 0.5) * (topR * bottomR * 2.0)) + 
            (step(0.5, bottomR) * (1.0 - ((1.0 - topR) * (1.0 - bottomR) * 2.0)))
        ) * overlayFill.a;
    rgba.g =  (rgba.g * (1.0 - overlayFill.a))
        + srgbChannelToLinearSrgbChannel(
            (step(bottomG, 0.5) * (topG * bottomG * 2.0)) + 
            (step(0.5, bottomG) * (1.0 - ((1.0 - topG) * (1.0 - bottomG) * 2.0)))
        ) * overlayFill.a;
    rgba.b =  (rgba.b * (1.0 - overlayFill.a))
        + srgbChannelToLinearSrgbChannel(
            (step(bottomB, 0.5) * (topB * bottomB * 2.0)) + 
            (step(0.5, bottomB) * (1.0 - ((1.0 - topB) * (1.0 - bottomB) * 2.0)))
        ) * overlayFill.a;

    const contrast = -1.0 + Math.tan((Math.min(0.9999, 0.1) + 1.0) * Math.PI / 4.0);
    rgba.r += (rgba.r - 0.5) * contrast;
    rgba.g += (rgba.g - 0.5) * contrast;
    rgba.b += (rgba.b - 0.5) * contrast;

    const chroma = Math.tan((Math.min(0.9999, 0.2) + 1.0) * Math.PI / 4.0);
    const lab = linearSrgbaToOklab(linearSrgbaToSrgba(rgba));
    const lch = labaToLcha(lab);
    let c = lch.c * chroma;
    c = Math.min(Math.max(c, 0.0), 1.0);
    lch.c = c;
    rgba = srgbaToLinearSrgba(oklabToLinearSrgba(lchaToLaba(lch)));

    rgba.r = (sourceR * (1 - mix)) + (rgba.r * mix);
    rgba.g = (sourceG * (1 - mix)) + (rgba.g * mix);
    rgba.b = (sourceB * (1 - mix)) + (rgba.b * mix);

    return transferSrgbTo8BitImageData(rgba, targetImageData, dataPosition);
}
