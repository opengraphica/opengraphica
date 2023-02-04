import fragmentShader from './brightness.frag';
import { transfer8BitImageDataToLinearSrgb, transferLinearSrgbTo8BitImageData } from '../color-space';

import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

interface BrightnessCanvasFilterParams {
    brightness?: number;
}

export default class BrightnessCanvasFilter implements CanvasFilter<BrightnessCanvasFilterParams> {
    public name = 'brightness';
    public params: BrightnessCanvasFilterParams = {};

    public getEditConfig() {
        return {
            brightness: {
                type: 'percentage',
                default: 0,
                preview: 0.4,
                min: -1,
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
        const brightness = (this.params.brightness ?? 0);
        const rgb = [sourceImageData[dataPosition + 0] / 255, sourceImageData[dataPosition + 1] / 255, sourceImageData[dataPosition + 2] / 255];
        if (brightness < 0) {
            const darknessMultiplier = Math.abs(brightness);
            rgb[0] -= rgb[0] * darknessMultiplier;
            rgb[1] -= rgb[1] * darknessMultiplier;
            rgb[2] -= rgb[2] * darknessMultiplier;
        }
        else {
            rgb[0] += ((1.0 - rgb[0]) * brightness);
            rgb[1] += ((1.0 - rgb[1]) * brightness);
            rgb[2] += ((1.0 - rgb[2]) * brightness);
        }
        targetImageData[dataPosition] = rgb[0] * 255;
        targetImageData[dataPosition + 1] = rgb[1] * 255;
        targetImageData[dataPosition + 2] = rgb[2] * 255;
        targetImageData[dataPosition + 3] = sourceImageData[dataPosition + 3];
    }
}
