import fragmentShader from './grayscale.frag';
import { transfer8BitImageDataToLinearSrgb, transfer8BitImageDataToSrgb, transferSrgbTo8BitImageData, linearSrgbChannelToSrgbChannel } from '../color-space';

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
                constant: true,
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

        let rgba: { r: number, g: number, b: number, alpha: number };

        var intensity = 0;
        if (mode === GrayscaleDesaturationMode.LUMINANCE) {
            rgba = transfer8BitImageDataToLinearSrgb(sourceImageData, dataPosition);
            intensity = linearSrgbChannelToSrgbChannel(rgba.r * 0.22 + rgba.g * 0.72 + rgba.b * 0.06);
        } else {
            rgba = transfer8BitImageDataToSrgb(sourceImageData, dataPosition);
            if (mode === GrayscaleDesaturationMode.LUMA) {
                intensity = rgba.r * 0.22 + rgba.g * 0.72 + rgba.b * 0.06;
            } else if (mode === GrayscaleDesaturationMode.LIGHTNESS) {
                intensity = 0.5 * (Math.max(rgba.r, rgba.g, rgba.b) + Math.min(rgba.r, rgba.g, rgba.b));
            } else if (mode === GrayscaleDesaturationMode.AVERAGE) {
                intensity = (rgba.r + rgba.g + rgba.b) / 3.0;
            } else if (mode === GrayscaleDesaturationMode.VALUE) {
                intensity = Math.max(rgba.r, rgba.g, rgba.b);
            }
        }

        rgba.r = (rgba.r * (1 - percentage)) + (intensity * percentage);
        rgba.g = (rgba.g * (1 - percentage)) + (intensity * percentage);
        rgba.b = (rgba.b * (1 - percentage)) + (intensity * percentage);

        return transferSrgbTo8BitImageData(rgba, targetImageData, dataPosition);
    }
}
