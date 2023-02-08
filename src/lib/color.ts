/**
 * Parts of this file were adapted from miniPaint
 * @license MIT https://github.com/viliusle/miniPaint/blob/master/MIT-LICENSE.txt
 * 
 * Also mjackson's diff
 * @website https://gist.github.com/mjackson/5311256
 * @license CC BY-SA 3.0 https://creativecommons.org/licenses/by-sa/3.0/deed.en 
 */

import { ColorModelName, ColorModel, RGBAColor, CMYKAColor, HSLAColor, HSVAColor, LABAColor, LCHAColor } from '@/types';

export function getColorModelName(color: ColorModel): ColorModelName {
    if ((color as RGBAColor).r != null) {
        return 'rgba';
    } else if ((color as CMYKAColor).c != null) {
        return 'cmyka';
    } else if ((color as HSVAColor).v != null) {
        return 'hsva';
    } else if ((color as HSLAColor).l != null) {
        return 'hsla';
    }
    return 'rgba';
}

function componentToHex(c: number) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

export function generateColorStyle(color: ColorModel, colorModelName: ColorModelName, colorSpace: string): string {
    // TODO - This is a temporary implementation that only works for sRGB.
    // Need to factor in color space mapping. Currently only sRGB available.
    color.style = colorToHex(color, colorModelName);
    return color.style;
}

export function colorToHex(color: ColorModel, colorModelName: ColorModelName): string {
    let rgbaColor: RGBAColor = color as RGBAColor;
    if (colorModelName !== 'rgba') {
        rgbaColor = colorToRgba(color, colorModelName);
    }
    return ('#' + componentToHex(Math.round(rgbaColor.r * 255)) + componentToHex(Math.round(rgbaColor.g * 255)) + componentToHex(Math.round(rgbaColor.b * 255)) + (rgbaColor.alpha < 1 ? componentToHex(Math.round(rgbaColor.alpha * 255)) : '')).toUpperCase();
}

export function hexToColor(hex: string, colorModelName: 'rgba'): RGBAColor;
export function hexToColor(hex: string, colorModelName: 'hsva'): HSVAColor;
export function hexToColor(hex: string, colorModelName: 'hsla'): HSLAColor;
export function hexToColor(hex: string, colorModelName: 'cmyka'): CMYKAColor;
export function hexToColor(hex: string, colorModelName: ColorModelName): ColorModel;
export function hexToColor(hex: string, colorModelName: ColorModelName): ColorModel {
    hex = hex.replace('#', '');
    let redHex = hex.length < 6 ? hex.substring(0, 1) + hex.substring(0, 1) : hex.substring(0, 2);
    let greenHex = hex.length < 6 ? hex.substring(1, 2) + hex.substring(1, 2) : hex.substring(2, 4);
    let blueHex = hex.length < 6 ? hex.substring(2, 3) + hex.substring(2, 3) : hex.substring(4, 6);
    let alphaHex = hex.length < 6 ? hex.substring(3, 4) + hex.substring(3, 4) : hex.substring(6, 8);
    let rgbaColor = createColor('rgba', {
        r: parseInt(redHex, 16) / 255,
        g: parseInt(greenHex, 16) / 255,
        b: parseInt(blueHex, 16) / 255,
        alpha: parseInt(alphaHex, 16) / 255
    }, 'sRGB');
    if (isNaN(rgbaColor.r)) {
        rgbaColor.r = 0;
    }
    if (isNaN(rgbaColor.g)) {
        rgbaColor.g = 0;
    }
    if (isNaN(rgbaColor.b)) {
        rgbaColor.b = 0;
    }
    if (isNaN(rgbaColor.alpha)) {
        rgbaColor.alpha = 1;
    }
    return convertColorModel(rgbaColor, colorModelName);
}

function hueToRgb(p: number, q: number, t: number) {
    if (t < 0)
        t += 1;
    if (t > 1)
        t -= 1;
    if (t < 1 / 6)
        return p + (q - p) * 6 * t;
    if (t < 1 / 2)
        return q;
    if (t < 2 / 3)
        return p + (q - p) * (2 / 3 - t) * 6;
    return p;
}

export function colorToRgba(color: Partial<ColorModel>, colorModelName: ColorModelName): RGBAColor {
    if (colorModelName === 'hsla') {
        const { h, s, l, alpha, style } = color as HSLAColor;
        let r, g, b;
        if (s == 0) {
            r = g = b = l; // achromatic
        }
        else {
            let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            let p = 2 * l - q;
            r = hueToRgb(p, q, h + 1 / 3);
            g = hueToRgb(p, q, h);
            b = hueToRgb(p, q, h - 1 / 3);
        }

        return { is: 'color', r, g, b, alpha, style };
    } else if (colorModelName === 'hsva') {
        const { h, s, v, alpha, style } = color as HSVAColor;
        let r = 0, g = 0, b = 0;
    
        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);
    
        switch (i % 6) {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
        }
    
        return { is: 'color', r, g, b, alpha, style };
    } else {
        return color as RGBAColor;
    }
}

export function colorToHsla(color: Partial<ColorModel>, colorModelName: ColorModelName): HSLAColor {
    if (colorModelName === 'hsva') {
        const { h, s, v, alpha, style } = color as HSVAColor;
        let h2;
        return {
            is: 'color',
            h,
            s: s * v / Math.max(0.00000001, ((h2 = (2 - s) * v) < 1 ? h2 : 2 - h2)), 
            l: h / 2,
            alpha,
            style
        };
    } else if (colorModelName === 'rgba') {
        const { r, g, b, alpha, style } = color as RGBAColor;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;

        if (max == min) {
            h = s = 0; // achromatic
        }
        else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { is: 'color', h, s, l, alpha, style };
    } else {
        return color as HSLAColor;
    }
}

export function colorToHsva(color: Partial<ColorModel>, colorModelName: ColorModelName): HSVAColor {
    if (colorModelName === 'hsla') {
        const { h, s, l, alpha, style } = color as HSLAColor;
        let s2 = s * (l < .5 ? l : 1 - l);
        return {
            is: 'color',
            h,
            s: 2 * s2 / Math.max(0.00000001, (l + s2)),
            v: l + s2,
            alpha,
            style
        };
    } else if (colorModelName === 'rgba') {
        const { r, g, b, alpha, style } = color as RGBAColor;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0, v = max;
        const d = max - min;
        s = max == 0 ? 0 : d / max;
        if (max == min) {
            h = 0; // achromatic
        } else {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { is: 'color', h, s, v, alpha, style };
    } else {
        return color as HSVAColor;
    }
}

/**
 * Adapted from https://github.com/Evercoder/culori/blob/main/src/oklab/convertLrgbToOklab.js
 * @license MIT https://github.com/Evercoder/culori/blob/main/LICENSE
 */
export function linearRgbaToOklab(color: Partial<RGBAColor>): LABAColor {
    const { r, g, b, alpha, style } = color as RGBAColor;
    const L = Math.cbrt(
        0.41222147079999993 * r + 0.5363325363 * g + 0.0514459929 * b
    );
    const M = Math.cbrt(
        0.2119034981999999 * r + 0.6806995450999999 * g + 0.1073969566 * b
    );
    const S = Math.cbrt(
        0.08830246189999998 * r + 0.2817188376 * g + 0.6299787005000002 * b
    );
    return {
        is: 'color',
        l: 0.2104542553 * L + 0.793617785 * M - 0.0040720468 * S,
        a: 1.9779984951 * L - 2.428592205 * M + 0.4505937099 * S,
        b: 0.0259040371 * L + 0.7827717662 * M - 0.808675766 * S,
        alpha,
        style
    };
}

/**
 * Adapted from https://github.com/Evercoder/culori/blob/main/src/oklab/convertOklabToLrgb.js
 * @license MIT https://github.com/Evercoder/culori/blob/main/LICENSE
 */
export function oklabToLinearRgba(color: Partial<LABAColor>): RGBAColor {
    const { l, a, b, alpha, style } = color as LABAColor;
    let L = Math.pow(
        l * 0.99999999845051981432 +
            0.39633779217376785678 * a +
            0.21580375806075880339 * b,
        3
    );
    let M = Math.pow(
        l * 1.0000000088817607767 -
            0.1055613423236563494 * a -
            0.063854174771705903402 * b,
        3
    );
    let S = Math.pow(
        l * 1.0000000546724109177 -
            0.089484182094965759684 * a -
            1.2914855378640917399 * b,
        3
    );

    return {
        is: 'color',
        r:
            +4.076741661347994 * L -
            3.307711590408193 * M +
            0.230969928729428 * S,
        g:
            -1.2684380040921763 * L +
            2.6097574006633715 * M -
            0.3413193963102197 * S,
        b:
            -0.004196086541837188 * L -
            0.7034186144594493 * M +
            1.7076147009309444 * S,
        alpha,
        style
    };
}

/**
 * Adapted from https://github.com/Evercoder/culori/blob/main/src/lch/convertLchToLab.js
 * @license MIT https://github.com/Evercoder/culori/blob/main/LICENSE
 */
export function lchaToLaba(color: Partial<LCHAColor>): LABAColor {
    const { l, c, h, alpha, style } = color as LCHAColor;
    return {
        is: 'color',
        l,
        a: c ? c * Math.cos((h / 180) * Math.PI) : 0,
        b: c ? c * Math.sin((h / 180) * Math.PI) : 0,
        alpha,
        style
    };
}

/**
 * Adapted from https://github.com/Evercoder/culori/blob/main/src/lch/convertLabToLch.js
 * @license MIT https://github.com/Evercoder/culori/blob/main/LICENSE
 */
function normalizeHue(hue: number) { return ((hue = hue % 360) < 0 ? hue + 360 : hue) }
export function labaToLcha(color: Partial<LABAColor>): LCHAColor {
    const { l, a, b, alpha, style } = color as LABAColor;
    let c = Math.sqrt(a * a + b * b) ?? 0;
    return {
        is: 'color',
        l,
        c: (isNaN(c)) ? 0 : c,
        h: (isNaN(c)) ? 0 : normalizeHue((Math.atan2(b, a) * 180) / Math.PI),
        alpha,
        style
    }
};

export function createColor(colorModelName: 'rgba', definition: { r: number, g: number, b: number, alpha: number }, colorSpace: string): RGBAColor;
export function createColor(colorModelName: 'hsva', definition: { h: number, s: number, v: number, alpha: number }, colorSpace: string): HSVAColor;
export function createColor(colorModelName: 'hsla', definition: { h: number, s: number, l: number, alpha: number }, colorSpace: string): HSLAColor;
export function createColor(colorModelName: 'cmyka', definition: { c: number, m: number, y: number, k: number, alpha: number }, colorSpace: string): CMYKAColor;
export function createColor(colorModelName: 'laba', definition: { l: number, a: number, b: number, alpha: number }, colorSpace: string): LABAColor;
export function createColor(colorModelName: 'lcha', definition: { l: number, c: number, h: number, alpha: number }, colorSpace: string): LCHAColor;
export function createColor(colorModelName: ColorModelName, definition: any, colorSpace: string): ColorModel {
    const color: ColorModel = {
        is: 'color',
        ...definition
    };
    generateColorStyle(color, colorModelName, colorSpace);
    return color;
}

export function convertColorModel(color: ColorModel, targetColorModelName: 'rgba'): RGBAColor;
export function convertColorModel(color: ColorModel, targetColorModelName: 'hsva'): HSVAColor;
export function convertColorModel(color: ColorModel, targetColorModelName: 'hsla'): HSLAColor;
export function convertColorModel(color: ColorModel, targetColorModelName: 'cmyka'): CMYKAColor;
export function convertColorModel(color: ColorModel, targetColorModelName: ColorModelName): ColorModel;
export function convertColorModel(color: ColorModel, targetColorModelName: ColorModelName): any {
    const currentColorModel = getColorModelName(color);
    if (targetColorModelName === 'hsla') {
        return colorToHsla(color, currentColorModel);
    } else if (targetColorModelName === 'hsva') {
        return colorToHsva(color, currentColorModel);
    } else if (targetColorModelName === 'rgba') {
        return colorToRgba(color, currentColorModel);
    }
    return color;
}
