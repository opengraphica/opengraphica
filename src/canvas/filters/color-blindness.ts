import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

export enum ColorBlindnessSimulationMethod {
    BRETTEL = 0,
    VIENOT = 1
}

export enum ColorBlindnessType {
    PROTAN = 0,
    DEUTERAN = 1,
    TRITAN = 2,
    ACHROMA = 3
}

export interface ColorBlindnessCanvasFilterParams {
    method?: number;
    type?: ColorBlindnessType;
    severity?: number;
}

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
}
