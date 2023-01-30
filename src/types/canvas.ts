export interface CanvasRenderingContext2DEnhanced extends CanvasRenderingContext2D {
    get2dTransformArray(): [number, number, number, number, number, number];
    transformedPoint(x: number, y: number): DOMPoint;
}

export interface CanvasViewResetOptions {
    margin?: number;
};

export interface CanvasFilterEditConfigFloat {
    type: 'float';
    default: number;
    preview?: number;
    min?: number;
    max?: number;
}

export interface CanvasFilterEditConfigPercentage {
    type: 'percentage';
    default: number;
    preview?: number;
    min?: number;
    max?: number;
}

export type CanvasFilterEditConfigField = CanvasFilterEditConfigFloat | CanvasFilterEditConfigPercentage;

export interface CanvasFilterEditConfig {
    [key: string]: CanvasFilterEditConfigField;
}

export interface CanvasFilter<T extends Object = Record<string, unknown>> {
    name: string;
    params: T;
    getEditConfig(): CanvasFilterEditConfig;
    getFragmentShader(): string | undefined;
    getVertexShader(): string | undefined;
    fragment(sourceImageData: Uint8ClampedArray, targetImageData: Uint8ClampedArray, dataPosition: number): void;
}
