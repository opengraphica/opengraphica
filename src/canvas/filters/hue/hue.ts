import fragmentShader from './hue.frag';
import { transfer8BitImageDataToLinearSrgb, transferLinearSrgbTo8BitImageData, transfer8BitImageDataToSrgb, transferSrgbTo8BitImageData } from '../color-space';
import { colorToRgba, colorToHsla, linearSrgbaToOklab, oklabToLinearSrgba, lchaToLaba, labaToLcha } from '@/lib/color';

import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

enum HueColorSpace {
    OKLAB = 0,
    PERCEPTUAL_RGB = 1,
    LINEAR_RGB = 2,
}

interface HueCanvasFilterParams {
    colorSpace?: HueColorSpace;
    rotate?: number;
}

export default class HueCanvasFilter implements CanvasFilter<HueCanvasFilterParams> {
    public name = 'hue';
    public params: HueCanvasFilterParams = {};

    public getEditConfig() {
        return {
            colorSpace: {
                type: 'integer',
                constant: true,
                default: HueColorSpace.OKLAB,
                options: [
                    { key: 'oklab', value: HueColorSpace.OKLAB },
                    { key: 'perceptualRgb', value: HueColorSpace.PERCEPTUAL_RGB },
                    { key: 'linearRgb', value: HueColorSpace.LINEAR_RGB }
                ]
            },
            rotate: {
                type: 'percentage',
                default: 0,
                preview: 0.3,
                min: -0.5,
                max: 0.5,
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

        let rgba = this.params.colorSpace === HueColorSpace.PERCEPTUAL_RGB
            ? transfer8BitImageDataToSrgb(sourceImageData, dataPosition)
            : transfer8BitImageDataToLinearSrgb(sourceImageData, dataPosition);

        if (this.params.colorSpace === HueColorSpace.OKLAB) {
            const lcha = labaToLcha(linearSrgbaToOklab(rgba));
            lcha.h += rotate * 360;
            rgba = oklabToLinearSrgba(lchaToLaba(lcha));
        } else {
            const hsla = colorToHsla(rgba, 'rgba');
            hsla.h += rotate;
            rgba = colorToRgba(hsla, 'hsla');
        }

        if (this.params.colorSpace === HueColorSpace.PERCEPTUAL_RGB) {
            return transferSrgbTo8BitImageData(rgba, targetImageData, dataPosition);
        } else {
            return transferLinearSrgbTo8BitImageData(rgba, targetImageData, dataPosition);
        }
    }
}
