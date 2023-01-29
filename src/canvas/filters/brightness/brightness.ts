import fragmentShader from './brightness.frag';

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
        const brightness = (this.params.brightness ?? 0) * 255;
        targetImageData[dataPosition] = sourceImageData[dataPosition] + brightness;
        targetImageData[dataPosition + 1] = sourceImageData[dataPosition + 1] + brightness;
        targetImageData[dataPosition + 2] = sourceImageData[dataPosition + 2] + brightness;
        targetImageData[dataPosition + 3] = sourceImageData[dataPosition + 3];
    }
}
