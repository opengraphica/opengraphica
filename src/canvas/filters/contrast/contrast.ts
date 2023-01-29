import fragmentShader from './contrast.frag';

import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

interface ContrastCanvasFilterParams {
    contrast?: number;
}

export default class ContrastCanvasFilter implements CanvasFilter<ContrastCanvasFilterParams> {
    public name = 'contrast';
    public params: ContrastCanvasFilterParams = {};

    public getEditConfig() {
        return {
            contrast: {
                type: 'percentage',
                default: 0,
                preview: 0.5,
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
        const contrast = (this.params.contrast ?? 0) + 1.0;
        targetImageData[dataPosition] = ((sourceImageData[dataPosition] - 127.5) * contrast + 127.5) + 0.5 | 0;
        targetImageData[dataPosition + 1] = ((sourceImageData[dataPosition + 1] - 127.5) * contrast + 127.5) + 0.5 | 0;
        targetImageData[dataPosition + 2] = ((sourceImageData[dataPosition + 2] - 127.5) * contrast + 127.5) + 0.5 | 0;
        targetImageData[dataPosition + 3] = sourceImageData[dataPosition + 3];
    }
}
