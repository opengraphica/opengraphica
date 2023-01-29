import fragmentShader from './hue-rotate.frag';

import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

interface HueRotateCanvasFilterParams {
}

export default class HueRotateCanvasFilter implements CanvasFilter<HueRotateCanvasFilterParams> {
    public name = 'hueRotate';
    public params: HueRotateCanvasFilterParams = {};

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
