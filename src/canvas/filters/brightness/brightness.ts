import fragmentShader from './brightness.frag';
import { transfer8BitImageDataToLinearSrgb, transferLinearSrgbTo8BitImageData, transfer8BitImageDataToSrgb, transferSrgbTo8BitImageData } from '../color-space';
import { colorToRgba, colorToHsla, linearRgbaToOklab, oklabToLinearRgba, lchaToLaba, labaToLcha } from '@/lib/color';

import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

enum BrightnessMode {
    LUMINANCE = 0,
    GAMMA = 1,
    SHIFT = 2,
}

interface BrightnessCanvasFilterParams {
    mode?: BrightnessMode;
    brightness?: number;
    effectiveRange?: number[];
    effectiveRangeFeather?: number[];
}

export default class BrightnessCanvasFilter implements CanvasFilter<BrightnessCanvasFilterParams> {
    public name = 'brightness';
    public params: BrightnessCanvasFilterParams = {};

    public getEditConfig() {
        return {
            mode: {
                type: 'integer',
                constant: true,
                default: BrightnessMode.LUMINANCE,
                options: [
                    { key: 'luminance', value: BrightnessMode.LUMINANCE },
                    { key: 'gamma', value: BrightnessMode.GAMMA },
                    { key: 'shift', value: BrightnessMode.SHIFT },
                ]
            },
            brightness: {
                type: 'percentage',
                default: 0,
                preview: 0.4,
                min: -1,
                max: 1
            },
            effectiveRange: {
                type: 'percentageRange',
                default: [0, 1],
                preview: [0, 1],
                min: 0,
                max: 1
            },
            effectiveRangeFeather: {
                type: 'percentageRange',
                default: [0, 1],
                preview: [0, 1],
                min: 0,
                max: 1
            }
        } as CanvasFilterEditConfig;
    }

    public getFragmentShader() {
        return fragmentShader;
    }

    public getVertexShader() {
        return undefined;
    }

    public fragment(sourceImageData: Uint8ClampedArray, targetImageData: Uint8ClampedArray, dataPosition: number) {
        const mode = this.params.mode ?? 0;
        let brightness = (this.params.brightness ?? 0);
        const effectiveRange = (this.params.effectiveRange ?? [0, 1]);
        const effectiveRangeFeather = (this.params.effectiveRangeFeather ?? [0, 1]);

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
            const lcha = labaToLcha(linearRgbaToOklab(rgba));
            lcha.l = Math.max(0.0, lcha.l + brightness);
            newRgba = oklabToLinearRgba(lchaToLaba(lcha));
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
}
