export type ColorModelName = 'rgba' | 'cmyka' | 'hsla' | 'hsva' | 'laba' | 'lcha';
export type ColorConversionSpace = 'srgb' | 'oklab';

export interface GenericColor {
    is: 'color';
    style: string; // CSS or canvas style statement that takes the conversion of image color space to the screen color space into account.
    conversionSpace?: ColorConversionSpace;
}

export interface RGBAColor extends GenericColor {
    r: number;
    g: number;
    b: number;
    alpha: number;
}

export interface CMYKAColor extends GenericColor {
    c: number;
    m: number;
    y: number;
    k: number;
    alpha: number;
}

export interface HSLAColor extends GenericColor {
    h: number;
    s: number;
    l: number;
    alpha: number;
}

export interface HSVAColor extends GenericColor {
    h: number;
    s: number;
    v: number;
    alpha: number;
}

export interface LABAColor extends GenericColor {
    l: number;
    a: number;
    b: number;
    alpha: number;
}

export interface LCHAColor extends GenericColor {
    l: number;
    c: number;
    h: number;
    alpha: number;
}

export type ColorModel = RGBAColor | CMYKAColor | HSLAColor | HSVAColor | LABAColor | LCHAColor;

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


