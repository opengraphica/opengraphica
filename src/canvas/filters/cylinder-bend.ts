import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

export interface CylinderBendCanvasFilterParams {
    rotation?: number;
    perspective?: never;
    viewPosition?: number;
}

export default class CylinderBendCanvasFilter implements CanvasFilter<CylinderBendCanvasFilterParams> {
    public name = 'cylinderBend';
    public params: CylinderBendCanvasFilterParams = {};

    public getEditConfig() {
        return {
            rotation: {
                type: 'percentage',
                default: 0,
                min: -1,
                max: 1
            },
            perspective: {
                type: 'percentage',
                default: 0,
                preview: 0.5,
                min: 0,
                max: 1
            },
            viewPosition: {
                type: 'percentage',
                default: 0,
                min: -1,
                max: 1
            },
        } as CanvasFilterEditConfig;
    }
}
