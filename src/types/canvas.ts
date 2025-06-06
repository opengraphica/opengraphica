import type { RGBAColor } from './color';
import type { WorkingFileGradientColorStop } from './working-file';

export interface CanvasRenderingContext2DEnhanced extends CanvasRenderingContext2D {
    get2dTransformArray(): [number, number, number, number, number, number];
    transformedPoint(x: number, y: number): DOMPoint;
}

export interface CanvasViewResetOptions {
    margin?: number;
};

export interface CanvasFilterLayerInfo {
    width: number;
    height: number;
}

export interface CanvasFilterEditConfigFieldCommon {
    constant?: boolean;
    hidden?: boolean;
    min?: number;
    max?: number;
    computedValue?: (params: Record<string, unknown>, info: { layerWidth: number; layerHeight: number; }) => unknown;
}

export interface CanvasFilterEditConfigIntegerOption {
    key: string;
    value: number;
}

export interface CanvasFilterEditConfigBoolean extends CanvasFilterEditConfigFieldCommon {
    type: 'boolean';
    default: boolean;
    preview?: boolean;
}

export interface CanvasFilterEditConfigInteger extends CanvasFilterEditConfigFieldCommon {
    type: 'integer';
    default: number;
    preview?: number;
    options?: CanvasFilterEditConfigIntegerOption[];
    optionsHaveDescriptions?: boolean;
}

export interface CanvasFilterEditConfigFloat extends CanvasFilterEditConfigFieldCommon {
    type: 'float';
    default: number;
    preview?: number;
}

export interface CanvasFilterEditConfigComputedFloat extends CanvasFilterEditConfigFieldCommon {
    type: 'computedFloat';
    default: number;
    preview?: number;
    valueMap: {
        referenceParam: string;
        map: { [key: number]: number };
    }
}

export interface CanvasFilterEditConfigPercentage extends CanvasFilterEditConfigFieldCommon {
    type: 'percentage';
    default: number;
    preview?: number;
}

export interface CanvasFilterEditConfigPercentageRange extends CanvasFilterEditConfigFieldCommon {
    type: 'percentageRange';
    default: number[];
    preview?: number[];
}

export interface CanvasFilterEditConfigColor extends CanvasFilterEditConfigFieldCommon {
    type: 'color';
    default: RGBAColor;
    preview?: RGBAColor;
}

export interface CanvasFilterEditConfigGradient extends CanvasFilterEditConfigFieldCommon {
    type: 'gradient';
    default: WorkingFileGradientColorStop<RGBAColor>[];
    colorSpaceFieldName: string;
    preview?: WorkingFileGradientColorStop<RGBAColor>[];
}

export type CanvasFilterEditConfigField = CanvasFilterEditConfigBoolean | CanvasFilterEditConfigInteger | CanvasFilterEditConfigFloat | CanvasFilterEditConfigPercentage | CanvasFilterEditConfigPercentageRange | CanvasFilterEditConfigComputedFloat | CanvasFilterEditConfigColor | CanvasFilterEditConfigGradient;

export interface CanvasFilterEditConfig {
    [key: string]: CanvasFilterEditConfigField;
}

export interface CanvasFilter<T extends Object = Record<string, unknown>> {
    name: string;
    params: T;
    maskId?: number;
    getEditConfig(): CanvasFilterEditConfig;
}

export interface Webgl2RendererCanvasFilter<T extends Object = Record<string, unknown>> extends CanvasFilter<T> {
    fragmentShader: string;
}
