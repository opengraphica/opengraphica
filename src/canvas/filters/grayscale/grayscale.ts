import fragmentShader from './grayscale.frag';

import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

interface GrayscaleCanvasFilterParams {
    percentage?: number;
}

export default class GrayscaleCanvasFilter implements CanvasFilter<GrayscaleCanvasFilterParams> {
    public name = 'grayscale';
    public params: GrayscaleCanvasFilterParams = {};

    public getEditConfig() {
        return {
            percentage: {
                type: 'percentage',
                default: 1,
                preview: 1,
                min: 0,
                max: 0
            }
            /*
                Luminance

                    The shades of gray will be calculated using linearized sRGB as
                    Luminance = (0.22 × R) + (0.72 × G) + (0.06 × B)
                Luma

                    The shades of gray will be calculated using non-linearized sRGB
                    Luma = (0.22 × R) + (0.72 × G) + (0.06 × B)
                Lightness (HSL)

                    The shades of gray will be calculated as
                    Lightness (HSL) = ½ × (max(R,G,B) + min(R,G,B))
                Average (HSI Intensity)

                    The shades of gray will be calculated as
                    Average (HSI Intensity) = (R + G + B) ÷ 3
                Value (HSV)

                    The shades of gray will be calculated as
                    Value (HSV) = max(R,G,B)
            */
        } as CanvasFilterEditConfig;
    }

    public getFragmentShader() {
        return fragmentShader;
    }

    public getVertexShader(){
        return undefined;
    }

    public fragment(sourceImageData: Uint8ClampedArray, targetImageData: Uint8ClampedArray, dataPosition: number) {
        const percentage = this.params.percentage ?? 0;
        var intensity = percentage * ((sourceImageData[dataPosition] * 19595 + sourceImageData[dataPosition + 1] * 38470 + sourceImageData[dataPosition + 2] * 7471) >> 16);
        targetImageData[dataPosition] = intensity;
        targetImageData[dataPosition + 1] = intensity;
        targetImageData[dataPosition + 2] = intensity;
        targetImageData[dataPosition + 3] = sourceImageData[dataPosition + 3];
    }
}
