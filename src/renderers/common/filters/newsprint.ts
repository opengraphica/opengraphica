import type { CanvasFilter, CanvasFilterEditConfig, RGBAColor } from '@/types';

export enum NewsprintColorModel {
    CMYK = 0,
    BLACK_ON_WHITE = 1,
}

export interface NewsprintCanvasFilterParams {
    colorModel?: NewsprintColorModel;
    density?: number;
}

export default class NewsprintCanvasFilter implements CanvasFilter<NewsprintCanvasFilterParams> {
    public name = 'newsprint';
    public params: NewsprintCanvasFilterParams = {};

    public getEditConfig() {
        return {
            colorModel: {
                type: 'integer',
                constant: true,
                default: NewsprintColorModel.CMYK,
                options: [
                    { key: 'cmyk', value: NewsprintColorModel.CMYK },
                    { key: 'blackOnWhite', value: NewsprintColorModel.BLACK_ON_WHITE },
                ],
            },
            density: {
                type: 'percentage',
                default: 0.25,
                min: 0,
                max: 1,
            },
        } as CanvasFilterEditConfig;
    }
}
