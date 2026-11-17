/**
 * Different types of vignettes are described here:
 * @website https://en.wikipedia.org/wiki/Vignetting
 */

import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

export enum NaturalVignetteMode {
    SIMULATE = 0,
    REMOVE = 1,
}

export interface NaturalVignetteCanvasFilterParams {
    mode?: NaturalVignetteMode;
    sensorWidth?: number;
    sensorHeight?: number;
    focalLength?: number;
}

export default class NaturalVignetteCanvasFilter implements CanvasFilter<NaturalVignetteCanvasFilterParams> {
    public name = 'naturalVignette';
    public params: NaturalVignetteCanvasFilterParams = {};

    public getEditConfig() {
        return {
            mode: {
                type: 'integer',
                constant: true,
                default: NaturalVignetteMode.SIMULATE,
                options: [
                    { key: 'simulate', value: NaturalVignetteMode.SIMULATE },
                    { key: 'remove', value: NaturalVignetteMode.REMOVE },
                ]
            },
            sensorWidth: {
                type: 'float',
                min: 0,
                max: 1000,
                step: 10,
                units: 'mm',
                default: 35,
            },
            sensorHeight: {
                type: 'float',
                min: 0,
                max: 1000,
                step: 10,
                units: 'mm',
                default: 35,
            },
            focalLength: {
                type: 'float',
                min: 0,
                max: 1000,
                step: 5,
                units: 'mm',
                default: 15,
            }
        } as CanvasFilterEditConfig;
    }
}
