import { ColorModelName, ColorModel, RGBAColor, CMYKAColor, HSLAColor, HSVAColor } from '@/types';

function componentToHex(c: number) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

export function colorToScreenRgbaHex(color: ColorModel, colorModelName: ColorModelName, colorSpace: string): string {
    if (colorModelName === 'rgba') {
        const rgbaColor = color as RGBAColor;
        return '#' + componentToHex(rgbaColor.r * 255) + componentToHex(rgbaColor.g * 255) + componentToHex(rgbaColor.b * 255) + componentToHex(rgbaColor.a * 255);
    } else {
        // TODO
        return '#000000FF';
    }
}


