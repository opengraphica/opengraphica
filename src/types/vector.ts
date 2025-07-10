import { ColorOrGradient, ColorModel } from './color';

export enum VectorPathCommandType {
    MOVE = 'M',
    LINE = 'L',
    HORIZONTAL_LINE = 'H',
    VERTICAL_LINE = 'V',
    CUBIC_BEZIER_CURVE = 'C',
    SMOOTH_CUBIC_BEZIER_CURVE = 'S',
    QUADRATIC_BEZIER_CURVE = 'Q',
    SMOOTH_QUADRATIC_BEZIER_CURVE = 'T',
    ELLIPTICAL_ARC = 'A',
    CLOSE = 'Z',
}

export enum CompressedVectorPathCommandType {
    MOVE = 0,
    LINE = 1,
    HORIZONTAL_LINE = 2,
    VERTICAL_LINE = 3,
    CUBIC_BEZIER_CURVE = 4,
    SMOOTH_CUBIC_BEZIER_CURVE = 5,
    QUADRATIC_BEZIER_CURVE = 6,
    SMOOTH_QUADRATIC_BEZIER_CURVE = 7,
    ELLIPTICAL_ARC = 8,
    CLOSE = 9,
}

export interface VectorPathCommandMove {
    type: VectorPathCommandType.MOVE,
    x: number;
    y: number;
}

export interface VectorPathCommandLine {
    type: VectorPathCommandType.LINE,
    x: number;
    y: number;
}

export interface VectorPathCommandHorizontalLine {
    type: VectorPathCommandType.HORIZONTAL_LINE,
    x: number;
}

export interface VectorPathCommandVerticalLine {
    type: VectorPathCommandType.VERTICAL_LINE,
    y: number;
}

export interface VectorPathCommandCubicBezierCurve {
    type: VectorPathCommandType.CUBIC_BEZIER_CURVE,
    x: number;
    y: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

export interface VectorPathCommandSmoothCubicBezierCurve {
    type: VectorPathCommandType.SMOOTH_CUBIC_BEZIER_CURVE,
    x: number;
    y: number;
    x2: number;
    y2: number;
}

export interface VectorPathCommandQuadraticBezierCurve {
    type: VectorPathCommandType.QUADRATIC_BEZIER_CURVE,
    x: number;
    y: number;
    x1: number;
    y1: number;
}

export interface VectorPathCommandSmoothQuadraticBezierCurve {
    type: VectorPathCommandType.SMOOTH_QUADRATIC_BEZIER_CURVE,
    x: number;
    y: number;
}

export interface VectorPathCommandArc {
    type: VectorPathCommandType.ELLIPTICAL_ARC,
    rx: number;
    ry: number;
    xAxisRotation: number;
    largeArcFlag: number;
    sweepFlag: number;
    x: number;
    y: number;
}

export type VectorPathCommand = VectorPathCommandMove | VectorPathCommandLine | VectorPathCommandHorizontalLine
    | VectorPathCommandCubicBezierCurve | VectorPathCommandSmoothCubicBezierCurve | VectorPathCommandQuadraticBezierCurve
    | VectorPathCommandSmoothQuadraticBezierCurve | VectorPathCommandArc;

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
    commands: VectorPathCommand[];
    stroke: ColorOrGradient<T>;
    strokeWidth: number;
    shapeHint?: string;
}

export type VectorShape<T extends ColorModel> = VectorRectangleShape<T> | VectorCircleShape<T> | VectorEllipseShape<T> | VectorLineShape<T> | VectorPolygonShape<T> | VectorPolylineShape<T> | VectorPathShape<T>;