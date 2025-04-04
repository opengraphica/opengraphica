import fragmentShader from './gradient-map.frag';
import { transfer8BitImageDataToLinearSrgb, transfer8BitImageDataToSrgb, transferSrgbTo8BitImageData, transferLinearSrgbTo8BitImageData } from '../color-space';
import { linearSrgbaToOklab, labaToLcha } from '@/lib/color';

import { sampleGradient } from '@/lib/gradient';

import type { CanvasFilter, CanvasFilterEditConfig, RGBAColor, WorkingFileGradientColorSpace, WorkingFileGradientColorStop } from '@/types';

enum GradientMapColorSpace {
    OKLAB = 0,
    PERCEPTUAL_RGB = 1,
    LINEAR_RGB = 2,
}

interface GradientMapCanvasFilterParams {
    gradient?: Array<WorkingFileGradientColorStop<RGBAColor>>,
    colorSpace?: GradientMapColorSpace,
    mix?: number;
}

const colorSpaceMap: Record<GradientMapColorSpace, WorkingFileGradientColorSpace> = {
    [GradientMapColorSpace.OKLAB]: 'oklab',
    [GradientMapColorSpace.PERCEPTUAL_RGB]: 'srgb',
    [GradientMapColorSpace.LINEAR_RGB]: 'linearSrgb',
};

export default class GradientMapCanvasFilter implements CanvasFilter<GradientMapCanvasFilterParams> {
    public name = 'gradientMap';
    public params: GradientMapCanvasFilterParams = {};

    public getEditConfig() {
        return {
            gradient: {
                type: 'gradient',
                colorSpaceFieldName: 'colorSpace',
                default: [
                    {
                        offset: 0,
                        color: { is: 'color', r: 0, g: 0, b: 0, alpha: 1, style: '#000000' },                        
                    },
                    {
                        offset: 1,
                        color: { is: 'color', r: 1, g: 1, b: 1, alpha: 1, style: '#ffffff' },
                    },
                ],
                preview: [
                    {
                        offset: 0,
                        color: { is: 'color', r: 0, g: 0, b: 1, alpha: 1, style: '#0000ff' },
                    },
                    {
                        offset: 1,
                        color: { is: 'color', r: 1, g: 1, b: 0, alpha: 1, style: '#ffff00' },
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

        let rgba = transfer8BitImageDataToLinearSrgb(sourceImageData, dataPosition);
        
        const lcha = labaToLcha(linearSrgbaToOklab(rgba));

        var newRgba = sampleGradient(this.params.gradient!, colorSpaceMap[this.params.colorSpace!], lcha.l);

        rgba.r = (rgba.r * (1 - percentage)) + (newRgba.r * percentage);
        rgba.g = (rgba.g * (1 - percentage)) + (newRgba.g * percentage);
        rgba.b = (rgba.b * (1 - percentage)) + (newRgba.b * percentage);

        return transferSrgbTo8BitImageData(rgba, targetImageData, dataPosition);
    }
}
