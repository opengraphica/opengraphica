import fragmentShader from './gradient-map.frag';
import { transfer8BitImageDataToLinearSrgb, transfer8BitImageDataToSrgb, transferSrgbTo8BitImageData, transferLinearSrgbTo8BitImageData } from '../color-space';

import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

enum GradientMapColorSpace {
    OKLAB = 0,
    PERCEPTUAL_RGB = 1,
    LINEAR_RGB = 2,
}

interface GradientMapCanvasFilterParams {
    colorSpace?: GradientMapColorSpace,
    mix?: number;
}

export default class GradientMapCanvasFilter implements CanvasFilter<GradientMapCanvasFilterParams> {
    public name = 'gradientMap';
    public params: GradientMapCanvasFilterParams = {};

    public getEditConfig() {
        return {
            gradient: {
                type: 'gradient',
                default: [
                    {
                        offset: 0,
                        color: { is: 'color', r: 0, g: 0, b: 0, alpha: 1, style: '' },                        
                    },
                    {
                        offset: 1,
                        color: { is: 'color', r: 1, g: 1, b: 1, alpha: 1, style: '' },
                    },
                ],
                preview: [
                    {
                        offset: 0,
                        color: { is: 'color', r: 0, g: 0, b: 1, alpha: 1, style: '' },
                    },
                    {
                        offset: 1,
                        color: { is: 'color', r: 1, g: 1, b: 0, alpha: 1, style: '' },
                    },
                ],
            },
            colorSpace: {
                type: 'integer',
                constant: true,
                default: GradientMapColorSpace.OKLAB,
                options: [
                    { key: 'oklab', value: GradientMapColorSpace.OKLAB },
                    { key: 'perceptualRgb', value: GradientMapColorSpace.PERCEPTUAL_RGB },
                    { key: 'linearRgb', value: GradientMapColorSpace.LINEAR_RGB }
                ]
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
        const percentage = this.params.mix ?? 0;

        let rgba = this.params.colorSpace === GradientMapColorSpace.PERCEPTUAL_RGB
            ? transfer8BitImageDataToSrgb(sourceImageData, dataPosition)
            : transfer8BitImageDataToLinearSrgb(sourceImageData, dataPosition);

        var newRgba = rgba;

        rgba.r = (rgba.r * (1 - percentage)) + (newRgba.r * percentage);
        rgba.g = (rgba.g * (1 - percentage)) + (newRgba.g * percentage);
        rgba.b = (rgba.b * (1 - percentage)) + (newRgba.b * percentage);

        if (this.params.colorSpace === GradientMapColorSpace.PERCEPTUAL_RGB) {
            return transferSrgbTo8BitImageData(rgba, targetImageData, dataPosition);
        } else {
            return transferLinearSrgbTo8BitImageData(rgba, targetImageData, dataPosition);
        }
    }
}
