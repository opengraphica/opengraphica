import fragmentShader from './instagram-aden.frag';
import { transfer8BitImageDataToSrgb, transferSrgbTo8BitImageData, srgbChannelToLinearSrgbChannel, linearSrgbChannelToSrgbChannel } from '../color-space';
import { linearSrgbaToOklab, oklabToLinearSrgba, lchaToLaba, labaToLcha, srgbaToLinearSrgba, linearSrgbaToSrgba } from '@/lib/color';

import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

interface InstagramAdenCanvasFilterParams {
    mix?: number;
}

const overlayFill = { r: 0.25882, g: 0.03921, b: 0.05490, a: 0.2 };

export default class InstagramAdenCanvasFilter implements CanvasFilter<InstagramAdenCanvasFilterParams> {
    public name = 'instagramAden';
    public params: InstagramAdenCanvasFilterParams = {};

    public getEditConfig() {
        return {
            mix: {
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
        const mix = this.params.mix ?? 0;

        let rgba = transfer8BitImageDataToSrgb(sourceImageData, dataPosition);
        const sourceR = rgba.r;
        const sourceG = rgba.g;
        const sourceB = rgba.b;

        rgba.r = (rgba.r * (1.0 - overlayFill.a))
            + Math.min(rgba.r, overlayFill.r) * overlayFill.a;
        rgba.g = (rgba.g * (1.0 - overlayFill.a))
            + Math.min(rgba.g, overlayFill.g) * overlayFill.a;
        rgba.b = (rgba.b * (1.0 - overlayFill.a))
            + Math.min(rgba.b, overlayFill.b) * overlayFill.a;

        const lcha = labaToLcha(linearSrgbaToOklab(rgba));
        lcha.h += -20;
        rgba = oklabToLinearSrgba(lchaToLaba(lcha));

        const contrast = -1.0 + Math.tan((Math.min(0.9999, -0.1) + 1.0) * Math.PI / 4.0);
        rgba.r += (rgba.r - 0.5) * contrast;
        rgba.g += (rgba.g - 0.5) * contrast;
        rgba.b += (rgba.b - 0.5) * contrast;
    
        const chroma = Math.tan((Math.min(0.9999, -0.15) + 1.0) * Math.PI / 4.0);
        const lab = linearSrgbaToOklab(linearSrgbaToSrgba(rgba));
        const lch = labaToLcha(lab);
        let c = lch.c * chroma;
        c = Math.min(Math.max(c, 0.0), 1.0);
        lch.c = c;
        rgba = srgbaToLinearSrgba(oklabToLinearSrgba(lchaToLaba(lch)));

        const brightness = 1.2;
        rgba.r = Math.min(Math.max(rgba.r * brightness, 0.0), 1.0);
        rgba.g = Math.min(Math.max(rgba.g * brightness, 0.0), 1.0);
        rgba.b = Math.min(Math.max(rgba.b * brightness, 0.0), 1.0);

        rgba.r = (sourceR * (1 - mix)) + (rgba.r * mix);
        rgba.g = (sourceG * (1 - mix)) + (rgba.g * mix);
        rgba.b = (sourceB * (1 - mix)) + (rgba.b * mix);

        return transferSrgbTo8BitImageData(rgba, targetImageData, dataPosition);
    }
}
