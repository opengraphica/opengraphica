export type ColorModelName = 'rgba' | 'cmyka' | 'hsla' | 'hsva';

export interface GenericColor {
    is: 'color';
    style: string; // CSS or canvas style statement that takes the conversion of image color space to the screen color space into account.
}

export interface RGBAColor extends GenericColor {
    r: number;
    g: number;
    b: number;
    a: number;
}

export interface CMYKAColor extends GenericColor {
    c: number;
    m: number;
    y: number;
    k: number;
    a: number;
}

export interface HSLAColor extends GenericColor {
    h: number;
    s: number;
    l: number;
    a: number;
}

export interface HSVAColor extends GenericColor {
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
    is: 'gradient';
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


