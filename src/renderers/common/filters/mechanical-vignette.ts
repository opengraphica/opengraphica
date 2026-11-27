/**
 * Different types of vignettes are described here:
 * @website https://en.wikipedia.org/wiki/Vignetting
 */

import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

export enum MechanicalVignetteMode {
    SIMULATE = 0,
    REMOVE = 1,
}

export interface MechanicalVignetteCanvasFilterParams {
    mode?: MechanicalVignetteMode;
    sensorWidth?: number;
    sensorHeight?: number;
    exitPupilDistance?: number;
    exitPupilRadius?: number;
    barrelOpeningDistance?: number;
    barrelOpeningRadius?: number;
}

export default class MechanicalVignetteCanvasFilter implements CanvasFilter<MechanicalVignetteCanvasFilterParams> {
    public name = 'mechanicalVignette';
    public params: MechanicalVignetteCanvasFilterParams = {};

    public getEditConfig() {
        return {
            mode: {
                type: 'integer',
                constant: true,
                default: MechanicalVignetteMode.SIMULATE,
                options: [
                    { key: 'simulate', value: MechanicalVignetteMode.SIMULATE },
                    { key: 'remove', value: MechanicalVignetteMode.REMOVE },
                ],
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
            exitPupilDistance: {
                type: 'float',
                min: 0,
                max: 1000,
                step: 5,
                units: 'mm',
                default: 35,
            },
            exitPupilRadius: {
                type: 'float',
                min: 0,
                max: 1000,
                step: 5,
                units: 'mm',
                default: 20,
            },
            barrelOpeningDistance: {
                type: 'float',
                min: 0,
                max: 1000,
                step: 5,
                units: 'mm',
                default: 10,
            },
            barrelOpeningRadius: {
                type: 'float',
                min: 0,
                max: 1000,
                step: 5,
                units: 'mm',
                default: 10,
            },
        } as CanvasFilterEditConfig;
    }
}
