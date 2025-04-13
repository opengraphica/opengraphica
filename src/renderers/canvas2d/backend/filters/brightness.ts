import { transfer8BitImageDataToLinearSrgb, transferLinearSrgbTo8BitImageData, transfer8BitImageDataToSrgb, transferSrgbTo8BitImageData } from '@/canvas/filters/color-space';
import { linearSrgbaToOklab, oklabToLinearSrgba, lchaToLaba, labaToLcha } from '@/lib/color';

import { BrightnessMode, type BrightnessCanvasFilterParams } from '@/canvas/filters/brightness';
import type { CanvasFilter } from '@/types';

export function fragment(
    filter: CanvasFilter<BrightnessCanvasFilterParams>,
    sourceImageData: Uint8ClampedArray,
    targetImageData: Uint8ClampedArray,
    dataPosition: number,
) {
    const mode = filter.params.mode ?? 0;
    let brightness = (filter.params.brightness ?? 0);
    const effectiveRange = (filter.params.effectiveRange ?? [0, 1]);
    const effectiveRangeFeather = (filter.params.effectiveRangeFeather ?? [0, 1]);

    let rgba = mode === BrightnessMode.LUMINANCE
        ? transfer8BitImageDataToLinearSrgb(sourceImageData, dataPosition)
        : transfer8BitImageDataToSrgb(sourceImageData, dataPosition);
    let newRgba = { ...rgba };

    if (mode === BrightnessMode.GAMMA) {
        brightness = Math.tan((Math.min(0.9999, brightness) + 1.0) * Math.PI / 4.0);
        newRgba.r = Math.pow(newRgba.r, 1.0 / brightness);
        newRgba.g = Math.pow(newRgba.g, 1.0 / brightness);
        newRgba.b = Math.pow(newRgba.b, 1.0 / brightness);
    } else if (mode === BrightnessMode.SHIFT) {
        if (brightness < 0) {
            const darknessMultiplier = Math.abs(brightness);
            newRgba.r -= newRgba.r * darknessMultiplier;
            newRgba.g -= newRgba.g * darknessMultiplier;
            newRgba.b -= newRgba.b * darknessMultiplier;
        }
        else {
            newRgba.r += ((1.0 - newRgba.r) * brightness);
            newRgba.g += ((1.0 - newRgba.g) * brightness);
            newRgba.b += ((1.0 - newRgba.b) * brightness);
        }
    } else if (mode === BrightnessMode.LUMINANCE) {
        const lcha = labaToLcha(linearSrgbaToOklab(rgba));
        lcha.l = Math.max(0.0, lcha.l + brightness);
        newRgba = oklabToLinearSrgba(lchaToLaba(lcha));
    }

    const intensity = rgba.r * 0.22 + rgba.g * 0.72 + rgba.b * 0.06;
    let mixValue = 1.0;
    const effectiveRangeSize = effectiveRange[1] - effectiveRange[0];
    if (mixValue < effectiveRange[0]) {
        mixValue *= 0.0;
    } else if (mixValue < effectiveRange[0] + (effectiveRangeSize * effectiveRangeFeather[0])) {
        mixValue *= (intensity - effectiveRange[0]) / effectiveRangeFeather[0];
    }
    if (mixValue > effectiveRange[1]) {
        mixValue *= 0.0;
    } else if (mixValue > effectiveRange[1] - (effectiveRangeSize * (1.0 - effectiveRangeFeather[1]))) {
        mixValue *= 1.0 - (intensity - (effectiveRangeSize * (1.0 - effectiveRangeFeather[1])) / effectiveRange[1]);
    }
    rgba.r = (rgba.r * (1.0 - mixValue)) + (newRgba.r * mixValue);
    rgba.g = (rgba.g * (1.0 - mixValue)) + (newRgba.g * mixValue);
    rgba.b = (rgba.b * (1.0 - mixValue)) + (newRgba.b * mixValue);

    if (mode === BrightnessMode.LUMINANCE) {
        transferLinearSrgbTo8BitImageData(rgba, targetImageData, dataPosition);
    } else {
        transferSrgbTo8BitImageData(rgba, targetImageData, dataPosition);
    }
}
