import fragmentShader from './hue.frag';

import { colorToRgba, colorToHsla } from '@/lib/color';
import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

interface HueCanvasFilterParams {
    rotate?: number;
}

export default class HueCanvasFilter implements CanvasFilter<HueCanvasFilterParams> {
    public name = 'hue';
    public params: HueCanvasFilterParams = {};

    public getEditConfig() {
        return {
            rotate: {
                type: 'percentage',
                default: 0,
                preview: 0.3,
                min: -0.5,
                max: 0.5
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
        const rotate = this.params.rotate ?? 0;
        const hsla = colorToHsla({
            is: 'color',
            style: '',
            r: sourceImageData[dataPosition + 0] / 255,
            g: sourceImageData[dataPosition + 1] / 255,
            b: sourceImageData[dataPosition + 2] / 255,
            a: 1.0
        }, 'rgba');
        hsla.h += rotate;
        const rgba = colorToRgba(hsla, 'hsla');

        targetImageData[dataPosition + 0] = rgba.r * 255;
        targetImageData[dataPosition + 1] = rgba.g * 255;
        targetImageData[dataPosition + 2] = rgba.b * 255;
        targetImageData[dataPosition + 3] = sourceImageData[dataPosition + 3];
    }
}
