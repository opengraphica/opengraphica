import fragmentShader from './brightness.frag';
import { transfer8BitImageDataToLinearSrgb, transferLinearSrgbTo8BitImageData } from '../color-space';

import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

enum BrightnessMode {
    GAMMA = 0,
    SHIFT = 1
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
                default: BrightnessMode.GAMMA,
                options: [
                    { key: 'gamma', value: BrightnessMode.GAMMA },
                    { key: 'shift', value: BrightnessMode.SHIFT }
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

        const rgb = [sourceImageData[dataPosition + 0] / 255, sourceImageData[dataPosition + 1] / 255, sourceImageData[dataPosition + 2] / 255];
        const newRgb = [rgb[0], rgb[1], rgb[2]];

        if (mode === BrightnessMode.GAMMA) {
            brightness = Math.tan((Math.min(0.9999, brightness) + 1.0) * Math.PI / 4.0);
            newRgb[0] = Math.pow(newRgb[0], 1.0 / brightness);
            newRgb[1] = Math.pow(newRgb[1], 1.0 / brightness);
            newRgb[2] = Math.pow(newRgb[2], 1.0 / brightness);
        } else if (mode === BrightnessMode.SHIFT) {
            if (brightness < 0) {
                const darknessMultiplier = Math.abs(brightness);
                newRgb[0] -= newRgb[0] * darknessMultiplier;
                newRgb[1] -= newRgb[1] * darknessMultiplier;
                newRgb[2] -= newRgb[2] * darknessMultiplier;
            }
            else {
                newRgb[0] += ((1.0 - newRgb[0]) * brightness);
                newRgb[1] += ((1.0 - newRgb[1]) * brightness);
                newRgb[2] += ((1.0 - newRgb[2]) * brightness);
            }
        }

        const intensity = rgb[0] * 0.22 + rgb[1] * 0.72 + rgb[2] * 0.06;
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
        rgb[0] = (rgb[0] * (1.0 - mixValue)) + (newRgb[0] * mixValue);
        rgb[1] = (rgb[1] * (1.0 - mixValue)) + (newRgb[1] * mixValue);
        rgb[2] = (rgb[2] * (1.0 - mixValue)) + (newRgb[2] * mixValue);

        targetImageData[dataPosition] = rgb[0] * 255;
        targetImageData[dataPosition + 1] = rgb[1] * 255;
        targetImageData[dataPosition + 2] = rgb[2] * 255;
        targetImageData[dataPosition + 3] = sourceImageData[dataPosition + 3];
    }
}
