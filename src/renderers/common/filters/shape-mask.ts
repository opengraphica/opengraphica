import type { CanvasFilter, CanvasFilterEditConfig } from '@/types';

export enum ShapeMaskType {
    CIRCLE = 0,
    EQUILATERAL_TRIANGLE = 1,
    RIGHT_ANGLE_TRIANGLE = 2,
    PARALLELOGRAM = 3,
    DIAMOND = 4,
    PENTAGON = 5,
    HEXAGON = 6,
    HEPTAGON = 7,
    OCTAGON = 8,
    DECAGON = 10,
    DODECAGON = 12,
    TRAPEZOID = 13,
    CROSS = 14,
    HEART = 15,
    MOON = 16,
}

export interface ShapeMaskCanvasFilterParams {
    type?: ShapeMaskType;
    squareAspect?: boolean;
    rotation?: number;
    adjustment?: number;
}

export default class ShapeMaskCanvasFilter implements CanvasFilter<ShapeMaskCanvasFilterParams> {
    public name = 'shapeMask';
    public params: ShapeMaskCanvasFilterParams = {};

    public getEditConfig() {
        return {
            type: {
                type: 'integer',
                constant: true,
                default: ShapeMaskType.CIRCLE,
                options: [
                    { key: 'circle', value: ShapeMaskType.CIRCLE },
                    { key: 'equilateralTriangle', value: ShapeMaskType.EQUILATERAL_TRIANGLE },
                    { key: 'rightAngleTriangle', value: ShapeMaskType.RIGHT_ANGLE_TRIANGLE },
                    { key: 'parallelogram', value: ShapeMaskType.PARALLELOGRAM },
                    { key: 'diamond', value: ShapeMaskType.DIAMOND },
                    // { key: 'trapezoid', value: ShapeMaskType.TRAPEZOID },
                    { key: 'pentagon', value: ShapeMaskType.PENTAGON },
                    { key: 'hexagon', value: ShapeMaskType.HEXAGON },
                    { key: 'heptagon', value: ShapeMaskType.HEPTAGON },
                    { key: 'octagon', value: ShapeMaskType.OCTAGON },
                    { key: 'decagon', value: ShapeMaskType.DECAGON },
                    { key: 'dodecagon', value: ShapeMaskType.DODECAGON },
                    { key: 'cross', value: ShapeMaskType.CROSS },
                    // { key: 'heart', value: ShapeMaskType.HEART },
                    { key: 'moon', value: ShapeMaskType.MOON },
                ]
            },
            squareAspect: {
                type: 'boolean',
                constant: true,
                default: true,
            },
            rotation: {
                type: 'percentage',
                default: 0,
                min: -1,
                max: 1,
            },
            adjustment: {
                type: 'percentage',
                default: 0,
                min: -1,
                max: 1,
            },
        } as CanvasFilterEditConfig;
    }
}
