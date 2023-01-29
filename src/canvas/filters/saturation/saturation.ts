import fragmentShader from './saturation.frag';

import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

interface SaturationCanvasFilterParams {
}

export default class SaturationCanvasFilter implements CanvasFilter<SaturationCanvasFilterParams> {
    public name = 'saturation';
    public params: SaturationCanvasFilterParams = {};

    public getEditConfig() {
        return {
        } as CanvasFilterEditConfig;
    }

    public getFragmentShader() {
        return fragmentShader;
    }

    public getVertexShader(){
        return undefined;
    }

    public fragment(sourceImageData: Uint8ClampedArray, targetImageData: Uint8ClampedArray, dataPosition: number) {
        targetImageData[dataPosition] = sourceImageData[dataPosition];
        targetImageData[dataPosition + 1] = sourceImageData[dataPosition + 1];
        targetImageData[dataPosition + 2] = sourceImageData[dataPosition + 2];
        targetImageData[dataPosition + 3] = sourceImageData[dataPosition + 3];
    }
}
