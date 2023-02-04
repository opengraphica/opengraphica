/**
 * This code was adapted libDaltonLens
 * @website https://github.com/DaltonLens/libDaltonLens/blob/master/libDaltonLens.c
 * @license Unlicense https://unlicense.org
 */

import fragmentShader from './color-blindness.frag';
import { transfer8BitImageDataToLinearSrgb, transferLinearSrgbTo8BitImageData, transfer8BitImageDataToSrgb, transferSrgbTo8BitImageData } from '../color-space';

import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

enum ColorBlindnessSimulationMethod {
    BRETTEL = 0,
    VIENOT = 1
}

enum ColorBlindnessType {
    PROTAN = 0,
    DEUTERAN = 1,
    TRITAN = 2,
    ACHROMA = 3
}

interface ColorBlindnessCanvasFilterParams {
    method?: number;
    type?: ColorBlindnessType;
    severity?: number;
}

const brettelParams: Record<ColorBlindnessType, { rgbCvdFromRgb1: number[], rgbCvdFromRgb2: number[], separationPlaneNormalInRgb: number[] }> = {
    [ColorBlindnessType.PROTAN]: {
        rgbCvdFromRgb1: [
            0.14980, 1.19548, -0.34528,
            0.10764, 0.84864, 0.04372,
            0.00384, -0.00540, 1.00156
        ],
        rgbCvdFromRgb2: [
            0.14570, 1.16172, -0.30742,
            0.10816, 0.85291, 0.03892,
            0.00386, -0.00524, 1.00139
        ],
        separationPlaneNormalInRgb: [ 0.00048, 0.00393, -0.00441 ]
    },
    [ColorBlindnessType.DEUTERAN]: {
        rgbCvdFromRgb1: [
            0.36477, 0.86381, -0.22858,
            0.26294, 0.64245, 0.09462,
            -0.02006, 0.02728, 0.99278
        ],
        rgbCvdFromRgb2: [
            0.37298, 0.88166, -0.25464,
            0.25954, 0.63506, 0.10540,
            -0.01980, 0.02784, 0.99196
        ],
        separationPlaneNormalInRgb: [ -0.00281, -0.00611, 0.00892 ]
    },
    [ColorBlindnessType.TRITAN]: {
        rgbCvdFromRgb1: [
            1.01277, 0.13548, -0.14826,
            -0.01243, 0.86812, 0.14431,
            0.07589, 0.80500, 0.11911
        ],
        rgbCvdFromRgb2: [
            0.93678, 0.18979, -0.12657,
            0.06154, 0.81526, 0.12320,
            -0.37562, 1.12767, 0.24796
        ],
        separationPlaneNormalInRgb: [ 0.03901, -0.02788, -0.01113 ]
    },
    [ColorBlindnessType.ACHROMA]: {
        rgbCvdFromRgb1: [],
        rgbCvdFromRgb2: [],
        separationPlaneNormalInRgb: []
    }
};

const vienotParams: Record<ColorBlindnessType, number[]> = {
    [ColorBlindnessType.PROTAN]: [
        0.11238, 0.88762, 0.00000,
        0.11238, 0.88762, -0.00000,
        0.00401, -0.00401, 1.00000
    ],
    [ColorBlindnessType.DEUTERAN]: [
        0.29275, 0.70725, 0.00000,
        0.29275, 0.70725, -0.00000,
        -0.02234, 0.02234, 1.00000
    ],
    [ColorBlindnessType.TRITAN]: [
        1.00000, 0.14461, -0.14461,
        0.00000, 0.85924, 0.14076,
        -0.00000, 0.85924, 0.14076
    ],
    [ColorBlindnessType.ACHROMA]: []
};

export default class ColorBlindnessCanvasFilter implements CanvasFilter<ColorBlindnessCanvasFilterParams> {
    public name = 'colorBlindness';
    public params: ColorBlindnessCanvasFilterParams = {};

    public getEditConfig() {
        return {
            method: {
                type: 'integer',
                constant: true,
                default: ColorBlindnessSimulationMethod.BRETTEL,
                options: [
                    { key: 'brettel', value: ColorBlindnessSimulationMethod.BRETTEL },
                    { key: 'vienot', value: ColorBlindnessSimulationMethod.VIENOT }
                ]
            },
            type: {
                type: 'integer',
                constant: true,
                default: ColorBlindnessType.PROTAN,
                options: [
                    { key: 'protan', value: ColorBlindnessType.PROTAN },
                    { key: 'deuteran', value: ColorBlindnessType.DEUTERAN },
                    { key: 'tritan', value: ColorBlindnessType.TRITAN },
                    { key: 'achroma', value: ColorBlindnessType.ACHROMA },
                ]
            },
            severity: {
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
        const type = this.params.type ?? 0;
        const method = this.params.method ?? 0;
        const severity = this.params.severity ?? 1;

        let rgbCvd!: { r: number, g: number, b: number, a: number };

        if (type === ColorBlindnessType.ACHROMA) {
            const rgba = transfer8BitImageDataToSrgb(sourceImageData, dataPosition);
            const intensity = rgba.r * 0.212656 + rgba.g * 0.715158 + rgba.b * 0.072186;
            rgba.r = (rgba.r * (1 - severity)) + (intensity * severity);
            rgba.g = (rgba.g * (1 - severity)) + (intensity * severity);
            rgba.b = (rgba.b * (1 - severity)) + (intensity * severity);
            transferSrgbTo8BitImageData(rgba, targetImageData, dataPosition);
            return;
        }

        const rgba = transfer8BitImageDataToLinearSrgb(sourceImageData, dataPosition);

        if (method === ColorBlindnessSimulationMethod.BRETTEL) {
            const deficiencyParams = brettelParams[type];
            
            const n = deficiencyParams.separationPlaneNormalInRgb;
            const dotWithSepPlane = rgba.r * n[0] + rgba.g * n[1] + rgba.b * n[2];
            const rgbCvdFromRgb = (dotWithSepPlane >= 0 ? deficiencyParams.rgbCvdFromRgb1 : deficiencyParams.rgbCvdFromRgb2);
            rgbCvd = {
                r: rgbCvdFromRgb[0] * rgba.r + rgbCvdFromRgb[1] * rgba.g + rgbCvdFromRgb[2] * rgba.b,
                g: rgbCvdFromRgb[3] * rgba.r + rgbCvdFromRgb[4] * rgba.g + rgbCvdFromRgb[5] * rgba.b,
                b: rgbCvdFromRgb[6] * rgba.r + rgbCvdFromRgb[7] * rgba.g + rgbCvdFromRgb[8] * rgba.b,
                a: rgba.a
            };
            rgbCvd.r = rgbCvd.r * severity + rgba.r * (1 - severity);
            rgbCvd.g = rgbCvd.g * severity + rgba.g * (1 - severity);
            rgbCvd.b = rgbCvd.b * severity + rgba.b * (1 - severity);
        }

        if (method === ColorBlindnessSimulationMethod.VIENOT) {
            const rgbCvdFromRgb = vienotParams[type];

            rgbCvd = {
                r: rgbCvdFromRgb[0] * rgba.r + rgbCvdFromRgb[1] * rgba.g + rgbCvdFromRgb[2] * rgba.b,
                g: rgbCvdFromRgb[3] * rgba.r + rgbCvdFromRgb[4] * rgba.g + rgbCvdFromRgb[5] * rgba.b,
                b: rgbCvdFromRgb[6] * rgba.r + rgbCvdFromRgb[7] * rgba.g + rgbCvdFromRgb[8] * rgba.b,
                a: rgba.a
            };

            if (severity < 0.999) {
                rgbCvd.r = severity * rgbCvd.r + (1 - severity) * rgba.r;
                rgbCvd.g = severity * rgbCvd.g + (1 - severity) * rgba.g;
                rgbCvd.b = severity * rgbCvd.b + (1 - severity) * rgba.b;
            }
        }

        transferLinearSrgbTo8BitImageData(rgbCvd, targetImageData, dataPosition);
    }
}
