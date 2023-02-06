import fragmentShader from './negative.frag';
import { transfer8BitImageDataToLinearSrgb, transferLinearSrgbTo8BitImageData, transfer8BitImageDataToSrgb, transferSrgbTo8BitImageData } from '../color-space';
import { colorToHsva, colorToRgba } from '@/lib/color';

import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

enum NegativeInvertColorSpace {
    PERCEPTUAL_RGB = 0,
    LINEAR_RGB = 1
}

interface NegativeCanvasFilterParams {
    colorSpace?: NegativeInvertColorSpace;
    invertRed?: boolean;
    invertGreen?: boolean;
    invertBlue?: boolean;
    invertValue?: boolean;
}

export default class NegativeCanvasFilter implements CanvasFilter<NegativeCanvasFilterParams> {
    public name = 'negative';
    public params: NegativeCanvasFilterParams = {};

    public getEditConfig() {
        return {
            colorSpace: {
                type: 'integer',
                constant: true,
                default: NegativeInvertColorSpace.PERCEPTUAL_RGB,
                options: [
                    { key: 'perceptualRgb', value: NegativeInvertColorSpace.PERCEPTUAL_RGB },
                    { key: 'linearRgb', value: NegativeInvertColorSpace.LINEAR_RGB }
                ]
            },
            invertRed: {
                type: 'boolean',
                constant: true,
                default: true
            },
            invertGreen: {
                type: 'boolean',
                constant: true,
                default: true
            },
            invertBlue: {
                type: 'boolean',
                constant: true,
                default: true
            },
            invertValue: {
                type: 'boolean',
                constant: true,
                default: false
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
        const colorSpace = this.params.colorSpace ?? 0;
        const invertRed = this.params.invertRed ?? false;
        const invertGreen = this.params.invertGreen ?? false;
        const invertBlue = this.params.invertBlue ?? false;
        const invertValue = this.params.invertValue ?? false;

        let rgba = (colorSpace === NegativeInvertColorSpace.PERCEPTUAL_RGB)
            ? transfer8BitImageDataToSrgb(sourceImageData, dataPosition)
            : transfer8BitImageDataToLinearSrgb(sourceImageData, dataPosition);
        
        if (invertRed) {
            rgba.r = 1.0 - rgba.r;
        }
        if (invertGreen) {
            rgba.g = 1.0 - rgba.g;
        }
        if (invertBlue) {
            rgba.b = 1.0 - rgba.b;
        }
        if (invertValue) {
            const hsva = colorToHsva(rgba, 'rgba');
            hsva.v = 1.0 - hsva.v;
            rgba = colorToRgba(hsva, 'hsva');
        }
        
        return (colorSpace === NegativeInvertColorSpace.PERCEPTUAL_RGB)
            ? transferSrgbTo8BitImageData(rgba, targetImageData, dataPosition)
            : transferLinearSrgbTo8BitImageData(rgba, targetImageData, dataPosition);
    }
}
