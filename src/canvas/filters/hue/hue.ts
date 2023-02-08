import fragmentShader from './hue.frag';
import { transfer8BitImageDataToLinearSrgb, transferLinearSrgbTo8BitImageData } from '../color-space';
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

        let rgba = transfer8BitImageDataToLinearSrgb(sourceImageData, dataPosition);

        const hsla = colorToHsla(rgba, 'rgba');
        hsla.h += rotate;
        rgba = colorToRgba(hsla, 'hsla');

        transferLinearSrgbTo8BitImageData(rgba, targetImageData, dataPosition);
    }
}
