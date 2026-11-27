import { transfer8BitImageDataToLinearSrgb, transferLinearSrgbTo8BitImageData } from '@/renderers/common/filters/color-space';
import { srgbaToLinearSrgba } from '@/lib/color';

import { type WhiteBalanceCanvasFilterParams } from '@/renderers/common/filters/white-balance';
import type { CanvasFilter } from '@/types';

export function fragment(
    filter: CanvasFilter<WhiteBalanceCanvasFilterParams>,
    sourceImageData: Uint8ClampedArray,
    targetImageData: Uint8ClampedArray,
    dataPosition: number,
) {
    const rgba = transfer8BitImageDataToLinearSrgb(sourceImageData, dataPosition);

    const white = srgbaToLinearSrgba(filter.params.white!);

    const neutral = (0.22 * white.r) + (0.72 * white.g) + (0.06 * white.b);

    rgba.r *= neutral / white.r;
    rgba.g *= neutral / white.g;
    rgba.b *= neutral / white.b;

    transferLinearSrgbTo8BitImageData(rgba, targetImageData, dataPosition);
}
