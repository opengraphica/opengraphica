/**
 * Parts of this file were adapted from miniPaint
 * @license MIT https://github.com/viliusle/miniPaint/blob/master/MIT-LICENSE.txt
 * 
 * Also mjackson's diff
 * @website https://gist.github.com/mjackson/5311256
 * @license CC BY-SA 3.0 https://creativecommons.org/licenses/by-sa/3.0/deed.en 
 */

import { ColorModelName, ColorModel, RGBAColor, CMYKAColor, HSLAColor, HSVAColor, LABAColor, LCHAColor, ColorConversionSpace } from '@/types';

interface ST {
    s: number;
    t: number;
}

interface LC {
    l: number;
    c: number;
}

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
        rgbaColor = colorToRgba(color, colorModelName, color.conversionSpace);
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

export function colorToRgba(color: Partial<ColorModel>, colorModelName: ColorModelName, colorConversionSpace?: ColorConversionSpace): RGBAColor {
    const conversionSpace = colorConversionSpace ?? color.conversionSpace ?? 'srgb';
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

        return { is: 'color', r, g, b, alpha, style, conversionSpace };
    } else if (colorModelName === 'hsva') {
        if (conversionSpace === 'srgb') {
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
        
            return { is: 'color', r, g, b, alpha, style, conversionSpace };
        } else if (conversionSpace === 'oklab') {
            const newColor = okhsvToRgba(color as HSVAColor);
            newColor.conversionSpace = conversionSpace;
            return newColor;
        }
        return color as RGBAColor;
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

export function colorToHsva(color: Partial<ColorModel>, colorModelName: ColorModelName, colorConversionSpace?: ColorConversionSpace): HSVAColor {
    const conversionSpace = colorConversionSpace ?? color.conversionSpace ?? 'srgb';
    if (colorModelName === 'hsla') {
        const { h, s, l, alpha, style } = color as HSLAColor;
        let s2 = s * (l < .5 ? l : 1 - l);
        return {
            is: 'color',
            h,
            s: 2 * s2 / Math.max(0.00000001, (l + s2)),
            v: l + s2,
            alpha,
            style,
            conversionSpace,
        };
    } else if (colorModelName === 'rgba') {
        if (conversionSpace === 'srgb') {
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
            return { is: 'color', h, s, v, alpha, style, conversionSpace };
        } else if (conversionSpace === 'oklab') {
            const newColor = rgbaToOkhsv(color as RGBAColor);
            newColor.conversionSpace = conversionSpace;
            return newColor;
        }
        return color as HSVAColor;
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

// Toe function for L_r
function toe(x: number) {
	const k1 = 0.206;
	const k2 = 0.03;
	const k3 = (1 + k1) / (1 + k2);
	return 0.5 * (k3 * x - k1 + Math.sqrt((k3 * x - k1) * (k3 * x - k1) + 4 * k2 * k3 * x));
}
// Inverse toe function for L_r
function toeInv(x: number) {
	const k1 = 0.206;
	const k2 = 0.03;
	const k3 = (1 + k1) / (1 + k2);
	return (x * x + k1 * x) / (k3 * (x + k2));
}
function toST(cusp: LC): ST {
    const { l, c } = cusp;
	return { s: c / l, t: c / (1 - l) };
}
// Finds the maximum saturation possible for a given hue that fits in sRGB
// Saturation here is defined as S = C/L
// a and b must be normalized so a^2 + b^2 == 1
function computeMaxSaturation(a: number, b: number): number {
    // Max saturation will be when one of r, g or b goes below zero.

    // Select different coefficients depending on which component goes below zero first
    let k0, k1, k2, k3, k4, wl, wm, ws;

    if (-1.88170328 * a - 0.80936493 * b > 1) {
        // Red component
        k0 = +1.19086277; k1 = +1.76576728; k2 = +0.59662641; k3 = +0.75515197; k4 = +0.56771245;
        wl = +4.0767416621; wm = -3.3077115913; ws = +0.2309699292;
    } else if (1.81444104 * a - 1.19445276 * b > 1) {
        // Green component
        k0 = +0.73956515; k1 = -0.45954404; k2 = +0.08285427; k3 = +0.12541070; k4 = +0.14503204;
        wl = -1.2684380046; wm = +2.6097574011; ws = -0.3413193965;
    } else {
        // Blue component
        k0 = +1.35733652; k1 = -0.00915799; k2 = -1.15130210; k3 = -0.50559606; k4 = +0.00692167;
        wl = -0.0041960863; wm = -0.7034186147; ws = +1.7076147010;
    }

    // Approximate max saturation using a polynomial:
    let S = k0 + k1 * a + k2 * b + k3 * a * a + k4 * a * b;

    // Do one step Halley's method to get closer
    // this gives an error less than 10e6, except for some blue hues where the dS/dh is close to infinite
    // this should be sufficient for most applications, otherwise do two/three steps 

    const k_l = +0.3963377774 * a + 0.2158037573 * b;
    const k_m = -0.1055613458 * a - 0.0638541728 * b;
    const k_s = -0.0894841775 * a - 1.2914855480 * b;

    const l_ = 1 + S * k_l;
    const m_ = 1 + S * k_m;
    const s_ = 1 + S * k_s;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    const l_dS = 3 * k_l * l_ * l_;
    const m_dS = 3 * k_m * m_ * m_;
    const s_dS = 3 * k_s * s_ * s_;

    const l_dS2 = 6 * k_l * k_l * l_;
    const m_dS2 = 6 * k_m * k_m * m_;
    const s_dS2 = 6 * k_s * k_s * s_;

    const f  = wl * l     + wm * m     + ws * s;
    const f1 = wl * l_dS  + wm * m_dS  + ws * s_dS;
    const f2 = wl * l_dS2 + wm * m_dS2 + ws * s_dS2;

    S = S - f * f1 / (f1*f1 - 0.5 * f * f2);

    return S;
}
// Finds L_cusp and C_cusp for a given hue
// a and b must be normalized so a^2 + b^2 == 1
function findCusp(a: number, b: number): LC {
	// First, find the maximum saturation (saturation S = C/L)
	const sCusp = computeMaxSaturation(a, b);

	// Convert to linear sRGB to find the first point where at least one of r,g or b >= 1:
	const rgbAtMmax = oklabToLinearRgba({ l: 1, a: sCusp * a, b: sCusp * b });
	const lCusp = Math.cbrt(1 / Math.max(Math.max(rgbAtMmax.r, rgbAtMmax.g), rgbAtMmax.b));
	const cCusp = lCusp * sCusp;

	return { l: lCusp , c: cCusp };
}

export function srgbChannelToLinearSrgbChannel(value: number): number {
    if (value < 0.04045) return value / 12.92;
    return Math.pow((value + 0.055) / 1.055, 2.4);
}

export function linearSrgbChannelToSrgbChannel(value: number): number {
    if (value <= 0) return 0;
    if (value >= 1) return 1;
    if (value < 0.0031308) return (value * 12.92);
    return (Math.pow(value, 1 / 2.4) * 1.055 - 0.055);
}

/**
 * Convert oklab hsv color to perceptual RGB
 * @website https://bottosson.github.io/posts/colorpicker/
 */
export function okhsvToRgba(hsva: HSVAColor): RGBAColor {
    const { h, s, v, alpha, style } = hsva;

	const a_ = Math.cos(2 * Math.PI * h);
	const b_ = Math.sin(2 * Math.PI * h);
	
	const cusp: LC = findCusp(a_, b_);
	const stMax = toST(cusp);
	const sMax = stMax.s;
	const tMax = stMax.t;
	const s0 = 0.5;
	const k = 1 - s0 / sMax;

	// first we compute L and V as if the gamut is a perfect triangle:

	// L, C when v==1:
	const lV = 1 - s * s0 / (s0 + tMax - tMax * k * s);
	const cV = s * tMax * s0 / (s0 + tMax - tMax * k * s);

	let L = v * lV;
	let C = v * cV;

	// then we compensate for both toe and the curved top part of the triangle:
	const lVt = toeInv(lV);
	const cVt = cV * lVt / lV;

	const L_new = toeInv(L);
	C = C * L_new / L;
	L = L_new;

	const rgbScale = oklabToLinearRgba({ l: lVt, a: a_ * cVt, b: b_ * cVt });
	const scale_L = Math.cbrt(1 / Math.max(Math.max(rgbScale.r, rgbScale.g), Math.max(rgbScale.b, 0)));

	L = L * scale_L;
	C = C * scale_L;

	const rgb = oklabToLinearRgba({ l: L, a: C * a_, b: C * b_ });
	return {
        is: 'color',
		r: linearSrgbChannelToSrgbChannel(rgb.r) || 0,
		g: linearSrgbChannelToSrgbChannel(rgb.g) || 0,
		b: linearSrgbChannelToSrgbChannel(rgb.b) || 0,
        alpha,
        style,
	};
}

export function rgbaToOkhsv(rgba: RGBAColor): HSVAColor {
    const { r, g, b, alpha, style } = rgba;

	const lab = linearRgbaToOklab({
		r: srgbChannelToLinearSrgbChannel(r),
		g: srgbChannelToLinearSrgbChannel(g),
		b: srgbChannelToLinearSrgbChannel(b),
        alpha,
	});

	let C = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
	const a_ = lab.a / C;
	const b_ = lab.b / C;

	let L = lab.l;
	const h = 0.5 + 0.5 * Math.atan2(-lab.b, -lab.a) / Math.PI;

	const cusp = findCusp(a_, b_);
	const stMax = toST(cusp);
	const sMax = stMax.s;
	const tMax = stMax.t;
	const s0 = 0.5;
	const k = 1 - s0 / sMax;

	// first we find L_v, C_v, L_vt and C_vt

	const t = tMax / (C + L * tMax);
	const lV = t * L;
	const cV = t * C;

	const lVt = toeInv(lV);
	const cVt = cV * lVt / lV;

	// we can then use these to invert the step that compensates for the toe and the curved top part of the triangle:
	const rgbScale = oklabToLinearRgba({ l: lVt, a: a_ * cVt, b: b_ * cVt });
	const scaleL = Math.cbrt(1 / Math.max(Math.max(rgbScale.r, rgbScale.g), Math.max(rgbScale.b, 0)));

	L = L / scaleL;
	C = C / scaleL;

	C = C * toe(L) / L;
	L = toe(L);

	// we can now compute v and s:

	const v = L / lV;
	const s = (s0 + tMax) * cV / ((tMax * s0) + tMax * k * cV);

	return {
        is: 'color',
        h: h || 0,
        s: s || 0,
        v: v || 0,
        alpha,
        style,
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

export function createColor(colorModelName: 'rgba', definition: { r: number, g: number, b: number, alpha: number }, colorSpace: string, colorConversionSpace?: ColorConversionSpace): RGBAColor;
export function createColor(colorModelName: 'hsva', definition: { h: number, s: number, v: number, alpha: number }, colorSpace: string, colorConversionSpace?: ColorConversionSpace): HSVAColor;
export function createColor(colorModelName: 'hsla', definition: { h: number, s: number, l: number, alpha: number }, colorSpace: string, colorConversionSpace?: ColorConversionSpace): HSLAColor;
export function createColor(colorModelName: 'cmyka', definition: { c: number, m: number, y: number, k: number, alpha: number }, colorSpace: string, colorConversionSpace?: ColorConversionSpace): CMYKAColor;
export function createColor(colorModelName: 'laba', definition: { l: number, a: number, b: number, alpha: number }, colorSpace: string, colorConversionSpace?: ColorConversionSpace): LABAColor;
export function createColor(colorModelName: 'lcha', definition: { l: number, c: number, h: number, alpha: number }, colorSpace: string, colorConversionSpace?: ColorConversionSpace): LCHAColor;
export function createColor(colorModelName: ColorModelName, definition: any, colorSpace: string, colorConversionSpace: ColorConversionSpace = 'srgb'): ColorModel {
    const color: ColorModel = {
        is: 'color',
        ...definition,
        conversionSpace: colorConversionSpace
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
