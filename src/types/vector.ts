import { ColorOrGradient, ColorModel } from './color';

export interface VectorRectangleShape<T extends ColorModel> {
    type: 'rectangle';
    height: number;
    fill: ColorOrGradient<T>;
    stroke: ColorOrGradient<T>;
    strokeWidth: number;
    width: number;
    x: number;
    y: number;
}

export interface VectorCircleShape<T extends ColorModel> {
    type: 'circle';
    fill: ColorOrGradient<T>;
    radius: number;
    stroke: ColorOrGradient<T>;
    strokeWidth: number;
    x: number;
    y: number;
}

export interface VectorEllipseShape<T extends ColorModel> {
    type: 'ellipse';
    fill: ColorOrGradient<T>;
    radiusX: number;
    radiusY: number;
    stroke: ColorOrGradient<T>;
    strokeWidth: number;
    x: number;
    y: number;
}

export interface VectorLineShape<T extends ColorModel> {
    type: 'line';
    stroke: ColorOrGradient<T>;
    strokeWidth: number;
    x1: number;
    x2: number;
    y1: number;
    y2: number;
}

export interface VectorPolygonShape<T extends ColorModel> {
    type: 'polygon';
    fill: ColorOrGradient<T>;
    points: { x: number; y: number; }[];
    stroke: ColorOrGradient<T>;
    strokeWidth: number;
}

export interface VectorPolylineShape<T extends ColorModel> {
    type: 'polyline';
    fill: ColorOrGradient<T>;
    points: { x: number; y: number; }[];
    stroke: ColorOrGradient<T>;
    strokeWidth: number;
}

export interface VectorPathShape<T extends ColorModel> {
    type: 'path';
    fill: ColorOrGradient<T>;
    points: {
        action: 'move' | 'line' | 'horizontalLine' | 'verticalLine' | 'curve' | 'smoothCurve' | 'quadraticBezierCurve' | 'smoothQuadraticBezierCurve' | 'ellipticalArc' | 'close';
        x: number;
        y: number;
    }[];
    stroke: ColorOrGradient<T>;
    strokeWidth: number;
}

export type VectorShape<T extends ColorModel> = VectorRectangleShape<T> | VectorCircleShape<T> | VectorEllipseShape<T> | VectorLineShape<T> | VectorPolygonShape<T> | VectorPolylineShape<T> | VectorPathShape<T>;