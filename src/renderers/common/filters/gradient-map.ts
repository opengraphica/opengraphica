import type { CanvasFilter, CanvasFilterEditConfig, RGBAColor, WorkingFileGradientColorSpace, WorkingFileGradientColorStop } from '@/types';

export enum GradientMapColorSpace {
    OKLAB = 0,
    PERCEPTUAL_RGB = 1,
    LINEAR_RGB = 2,
}

export interface GradientMapCanvasFilterParams {
    gradient?: Array<WorkingFileGradientColorStop<RGBAColor>>,
    colorSpace?: GradientMapColorSpace,
    mix?: number;
}

export default class GradientMapCanvasFilter implements CanvasFilter<GradientMapCanvasFilterParams> {
    public name = 'gradientMap';
    public params: GradientMapCanvasFilterParams = {};

    public getEditConfig() {
        return {
            gradient: {
                type: 'gradient',
                colorSpaceFieldName: 'colorSpace',
                default: [
                    {
                        offset: 0,
                        color: { is: 'color', r: 0, g: 0, b: 0, alpha: 1, style: '#000000' },                        
                    },
                    {
                        offset: 1,
                        color: { is: 'color', r: 1, g: 1, b: 1, alpha: 1, style: '#ffffff' },
                    },
                ],
                preview: [
                    {
                        offset: 0,
                        color: { is: 'color', r: 0, g: 0, b: 1, alpha: 1, style: '#0000ff' },
                    },
                    {
                        offset: 1,
                        color: { is: 'color', r: 1, g: 1, b: 0, alpha: 1, style: '#ffff00' },
                    },
                ],
            },
            colorSpace: {
                type: 'integer',
                constant: true,
                default: GradientMapColorSpace.OKLAB,
                options: [
                    { key: 'oklab', value: GradientMapColorSpace.OKLAB },
                    { key: 'perceptualRgb', value: GradientMapColorSpace.PERCEPTUAL_RGB },
                    { key: 'linearRgb', value: GradientMapColorSpace.LINEAR_RGB }
                ]
            },
            mix: {
                type: 'percentage',
                default: 1,
                min: 0,
                max: 1
            }
        } as CanvasFilterEditConfig;
    }
}
