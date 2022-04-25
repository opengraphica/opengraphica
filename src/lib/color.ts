/**
 * Parts of this file were adapted from miniPaint
 * @license MIT https://github.com/viliusle/miniPaint/blob/master/MIT-LICENSE.txt
 * 
 * Also mjackson's diff
 * @website https://gist.github.com/mjackson/5311256
 * @license CC BY-SA 3.0 https://creativecommons.org/licenses/by-sa/3.0/deed.en 
 */

import { ColorModelName, ColorModel, RGBAColor, CMYKAColor, HSLAColor, HSVAColor } from '@/types';

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
    return ('#' + componentToHex(Math.round(rgbaColor.r * 255)) + componentToHex(Math.round(rgbaColor.g * 255)) + componentToHex(Math.round(rgbaColor.b * 255)) + (rgbaColor.a < 1 ? componentToHex(Math.round(rgbaColor.a * 255)) : '')).toUpperCase();
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
        a: parseInt(alphaHex, 16) / 255
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
    if (isNaN(rgbaColor.a)) {
        rgbaColor.a = 1;
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

export function colorToRgba(color: ColorModel, colorModelName: ColorModelName): RGBAColor {
    if (colorModelName === 'hsla') {
        const { h, s, l, a, style } = color as HSLAColor;
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

		return { is: 'color', r, g, b, a, style };
    } else if (colorModelName === 'hsva') {
        const { h, s, v, a, style } = color as HSVAColor;
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
	
		return { is: 'color', r, g, b, a, style };
    } else {
        return color as RGBAColor;
    }
}

export function colorToHsla(color: ColorModel, colorModelName: ColorModelName): HSLAColor {
    if (colorModelName === 'hsva') {
        const { h, s, v, a, style } = color as HSVAColor;
        let h2;
        return {
            is: 'color',
			h,
			s: s * v / Math.max(0.00000001, ((h2 = (2 - s) * v) < 1 ? h2 : 2 - h2)), 
			l: h / 2,
            a,
            style
		};
    } else if (colorModelName === 'rgba') {
        const { r, g, b, a, style } = color as RGBAColor;
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
		return { is: 'color', h, s, l, a, style };
    } else {
        return color as HSLAColor;
    }
}

export function colorToHsva(color: ColorModel, colorModelName: ColorModelName): HSVAColor {
    if (colorModelName === 'hsla') {
        const { h, s, l, a, style } = color as HSLAColor;
        let s2 = s * (l < .5 ? l : 1 - l);
		return {
            is: 'color',
			h,
			s: 2 * s2 / Math.max(0.00000001, (l + s2)),
			v: l + s2,
            a,
            style
		};
    } else if (colorModelName === 'rgba') {
        const { r, g, b, a, style } = color as RGBAColor;
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
		return { is: 'color', h, s, v, a, style };
    } else {
        return color as HSVAColor;
    }
}

export function createColor(colorModelName: 'rgba', definition: { r: number, g: number, b: number, a: number }, colorSpace: string): RGBAColor;
export function createColor(colorModelName: 'hsva', definition: { h: number, s: number, v: number, a: number }, colorSpace: string): HSVAColor;
export function createColor(colorModelName: 'hsla', definition: { h: number, s: number, l: number, a: number }, colorSpace: string): HSLAColor;
export function createColor(colorModelName: 'cmyka', definition: { c: number, m: number, y: number, k: number, a: number }, colorSpace: string): CMYKAColor;
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
