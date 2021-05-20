export interface CanvasRenderingContext2DEnhanced extends CanvasRenderingContext2D {
    get2dTransformArray(): [number, number, number, number, number, number];
    transformedPoint(x: number, y: number): DOMPoint;
}

export interface CanvasViewResetOptions {
    margin?: number;
};
