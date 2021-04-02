export type ColorModelName = 'rgba' | 'cmyka' | 'hsla' | 'hsva';

export interface RGBAColor {
    r: number;
    g: number;
    b: number;
    a: number;
}

export interface CMYKAColor {
    c: number;
    m: number;
    y: number;
    k: number;
    a: number;
}

export interface HSLAColor {
    h: number;
    s: number;
    l: number;
    a: number;
}

export interface HSVAColor {
    h: number;
    s: number;
    v: number;
    a: number;
}

export type ColorModel = RGBAColor | CMYKAColor | HSLAColor | HSVAColor;

export interface GradientStop<T extends ColorModel> {
    percent: number;
    color: T;
}

export interface Gradient<T extends ColorModel> {
    stops: GradientStop<T>[];
    type: 'linear' | 'radial';
}

export interface LinearGradient<T extends ColorModel> extends Gradient<T> {
    angle: number; // Radians
    type: 'linear';
}

export interface RadialGradient<T extends ColorModel> extends Gradient<T> {
    shape: 'circle' | 'ellipse';
    type: 'radial';
}

export type ColorOrGradient<T extends ColorModel> = T | LinearGradient<T> | RadialGradient<T>;
