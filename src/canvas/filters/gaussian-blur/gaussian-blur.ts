import fragmentShader from './gaussian-blur.frag';

import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

interface GaussianBlurCanvasFilterParams {
    size?: number;
    pixelSize?: number;
    xIntensity?: number;
    yIntensity?: number;
}

export default class GaussianBlurCanvasFilter implements CanvasFilter<GaussianBlurCanvasFilterParams> {
    public name = 'gaussianBlur';
    public params: GaussianBlurCanvasFilterParams = {};

    public getEditConfig() {
        return {
            size: {
                type: 'percentage',
                default: 0,
                preview: 0.1,
                min: 0,
                max: 1
            },
            pixelSize: {
                type: 'integer',
                default: 0,
                constant: true,
                hidden: true,
                computedValue(params: GaussianBlurCanvasFilterParams, info) {
                    return (Math.round((params?.size ?? 1) * Math.max(info.layerWidth, info.layerHeight))) || 100;
                }
            },
            xIntensity: {
                type: 'percentage',
                default: 1,
                min: 0,
                max: 1
            },
            yIntensity: {
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
        targetImageData[dataPosition + 0] = sourceImageData[dataPosition + 0];
        targetImageData[dataPosition + 1] = sourceImageData[dataPosition + 1];
        targetImageData[dataPosition + 2] = sourceImageData[dataPosition + 2];
        targetImageData[dataPosition + 3] = sourceImageData[dataPosition + 3];
    }

}
