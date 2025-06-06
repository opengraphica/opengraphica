import { transfer8BitImageDataToSrgb, transferSrgbTo8BitImageData, linearSrgbChannelToSrgbChannel } from '@/canvas/filters/color-space';
import { linearSrgbaToOklab, oklabToLinearSrgba, lchaToLaba, labaToLcha } from '@/lib/color';

import { type InstagramGinghamCanvasFilterParams } from '@/canvas/filters/instagram-gingham';
import type { CanvasFilter } from '@/types';

const overlayFill = { r: 0.90196, g: 0.90196, b: 0.98039 };

export function fragment(
    filter: CanvasFilter<InstagramGinghamCanvasFilterParams>,
    sourceImageData: Uint8ClampedArray,
    targetImageData: Uint8ClampedArray,
    dataPosition: number,
) {
    const mix = filter.params.mix ?? 0;

    let rgba = transfer8BitImageDataToSrgb(sourceImageData, dataPosition);
    const sourceR = rgba.r;
    const sourceG = rgba.g;
    const sourceB = rgba.b;

    const topR = linearSrgbChannelToSrgbChannel(overlayFill.r);
    const bottomR = rgba.r;
    const topG = linearSrgbChannelToSrgbChannel(overlayFill.g);
    const bottomG = rgba.g;
    const topB = linearSrgbChannelToSrgbChannel(overlayFill.b);
    const bottomB = rgba.b;
    rgba.r = (
        ((topR * bottomR) * (1.0 - bottomR)) +
        ((1.0 - ((1.0 - topR) * (1.0 - bottomR))) * bottomR)
    );
    rgba.g = (
        ((topG * bottomG) * (1.0 - bottomG)) +
        ((1.0 - ((1.0 - topG) * (1.0 - bottomG))) * bottomG)
    );
    rgba.b = (
        ((topB * bottomB) * (1.0 - bottomB)) +
        ((1.0 - ((1.0 - topB) * (1.0 - bottomB))) * bottomB)
    );

    const contrast = -1.0 + Math.tan((Math.min(0.9999, -0.1) + 1.0) * Math.PI / 4.0);
    rgba.r += (rgba.r - 0.5) * contrast;
    rgba.g += (rgba.g - 0.5) * contrast;
    rgba.b += (rgba.b - 0.5) * contrast;

    const lcha = labaToLcha(linearSrgbaToOklab(rgba));
    lcha.h += -10;
    rgba = oklabToLinearSrgba(lchaToLaba(lcha));

    rgba.r = (sourceR * (1 - mix)) + (rgba.r * mix);
    rgba.g = (sourceG * (1 - mix)) + (rgba.g * mix);
    rgba.b = (sourceB * (1 - mix)) + (rgba.b * mix);

    return transferSrgbTo8BitImageData(rgba, targetImageData, dataPosition);
}
