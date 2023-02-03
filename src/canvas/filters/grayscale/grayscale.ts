import fragmentShader from './grayscale.frag';

import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

enum GrayscaleDesaturationMode {
    LUMINANCE = 0,
    LUMA = 1,
    LIGHTNESS = 2,
    AVERAGE = 3,
    VALUE = 4
}

interface GrayscaleCanvasFilterParams {
    mode?: GrayscaleDesaturationMode,
    mix?: number;
}

export default class GrayscaleCanvasFilter implements CanvasFilter<GrayscaleCanvasFilterParams> {
    public name = 'grayscale';
    public params: GrayscaleCanvasFilterParams = {};

    public getEditConfig() {
        return {
            mode: {
                type: 'integer',
                isConstant: true,
                default: GrayscaleDesaturationMode.LUMINANCE,
                options: [
                    { key: 'luminance', value: GrayscaleDesaturationMode.LUMINANCE },
                    { key: 'luma', value: GrayscaleDesaturationMode.LUMA },
                    { key: 'lightness', value: GrayscaleDesaturationMode.LIGHTNESS },
                    { key: 'average', value: GrayscaleDesaturationMode.AVERAGE },
                    { key: 'value', value: GrayscaleDesaturationMode.VALUE }
                ],
                optionsHaveDescriptions: true
            },
            mix: {
                type: 'percentage',
                default: 1,
                min: 0,
                max: 1
            }
        } as CanvasFilterEditConfig;
    }

    public getFragmentShader() {
        return fragmentShader;
    }

    public getVertexShader(){
        return undefined;
    }

    public fragment(sourceImageData: Uint8ClampedArray, targetImageData: Uint8ClampedArray, dataPosition: number) {
        const mode = this.params.mode ?? 0;
        const percentage = this.params.mix ?? 0;

        const rgb = [
            sourceImageData[dataPosition + 0] / 255,
            sourceImageData[dataPosition + 1] / 255,
            sourceImageData[dataPosition + 2] / 255
        ];

        var intensity = 0;
        if (mode === GrayscaleDesaturationMode.LUMINANCE) {
            intensity = this.linearRgbToSRgb(
                this.sRgbToLinearRgb(rgb[0]) * 0.22 +
                this.sRgbToLinearRgb(rgb[1]) * 0.72 +
                this.sRgbToLinearRgb(rgb[2]) * 0.06
            );
        } else if (mode === GrayscaleDesaturationMode.LUMA) {
            intensity = rgb[0] * 0.22 + rgb[1] * 0.72 + rgb[2] * 0.06;
        } else if (mode === GrayscaleDesaturationMode.LIGHTNESS) {
            intensity = 0.5 * (Math.max(rgb[0], rgb[1], rgb[2]) + Math.min(rgb[0], rgb[1], rgb[2]));
        } else if (mode === GrayscaleDesaturationMode.AVERAGE) {
            intensity = (rgb[0] + rgb[1] + rgb[2]) / 3.0;
        } else if (mode === GrayscaleDesaturationMode.VALUE) {
            intensity = Math.max(rgb[0], rgb[1], rgb[2]);
        }

        targetImageData[dataPosition] = (sourceImageData[dataPosition] * (1 - percentage)) + (intensity * percentage * 255);
        targetImageData[dataPosition + 1] = (sourceImageData[dataPosition + 1] * (1 - percentage)) + (intensity * percentage * 255);
        targetImageData[dataPosition + 2] = (sourceImageData[dataPosition + 2] * (1 - percentage)) + (intensity * percentage * 255);
        targetImageData[dataPosition + 3] = sourceImageData[dataPosition + 3];
    }

    private sRgbToLinearRgb(value: number): number {
        if (value < 0.04045) return value / 12.92;
        return Math.pow((value + 0.055) / 1.055, 2.4);
    }

    private linearRgbToSRgb(value: number): number {
        if (value <= 0) return 0;
        if (value >= 1) return 1;
        if (value < 0.0031308) return (value * 12.92);
        return (Math.pow(value, 1 / 2.4) * 1.055 - 0.055);
    }
}
