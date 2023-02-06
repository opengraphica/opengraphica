import fragmentShader from './contrast.frag';

import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

interface ContrastCanvasFilterParams {
    contrast?: number;
    middleGray?: number;
}

export default class ContrastCanvasFilter implements CanvasFilter<ContrastCanvasFilterParams> {
    public name = 'contrast';
    public params: ContrastCanvasFilterParams = {};

    public getEditConfig() {
        return {
            contrast: {
                type: 'percentage',
                default: 0,
                preview: 0.3,
                min: -1,
                max: 1
            },
            middleGray: {
                type: 'percentage',
                default: 0.5,
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
        const contrast = -1.0 + Math.tan((Math.min(0.9999, this.params.contrast ?? 0) + 1.0) * Math.PI / 4.0);
        const middleGray = (this.params.middleGray ?? 0.5);

        const rgb = [sourceImageData[dataPosition + 0] / 255, sourceImageData[dataPosition + 1] / 255, sourceImageData[dataPosition + 2] / 255];

        targetImageData[dataPosition + 0] = (rgb[0] + (rgb[0] - middleGray) * contrast) * 255;
        targetImageData[dataPosition + 1] = (rgb[1] + (rgb[1] - middleGray) * contrast) * 255;
        targetImageData[dataPosition + 2] = (rgb[2] + (rgb[2] - middleGray) * contrast) * 255;
        targetImageData[dataPosition + 3] = sourceImageData[dataPosition + 3];
    }
}
