export function transfer8BitImageDataToSrgb(imageData: Uint8ClampedArray, dataPosition: number): { r: number, g: number, b: number, a: number } {
    return {
        r: imageData[dataPosition + 0] / 255,
        g: imageData[dataPosition + 1] / 255,
        b: imageData[dataPosition + 2] / 255,
        a: imageData[dataPosition + 3] / 255
    }
}

export function transfer8BitImageDataToLinearSrgb(imageData: Uint8ClampedArray, dataPosition: number): { r: number, g: number, b: number, a: number } {
    return {
        r: srgbChannelToLinearSrgbChannel(imageData[dataPosition + 0] / 255),
        g: srgbChannelToLinearSrgbChannel(imageData[dataPosition + 1] / 255),
        b: srgbChannelToLinearSrgbChannel(imageData[dataPosition + 2] / 255),
        a: imageData[dataPosition + 3] / 255
    }
}

export function transferSrgbTo8BitImageData(rgba: { r: number, g: number, b: number, a: number }, imageData: Uint8ClampedArray, dataPosition: number) {
    imageData[dataPosition + 0] = rgba.r * 255;
    imageData[dataPosition + 1] = rgba.g * 255;
    imageData[dataPosition + 2] = rgba.b * 255;
    imageData[dataPosition + 3] = rgba.a * 255;
}

export function transferLinearSrgbTo8BitImageData(rgba: { r: number, g: number, b: number, a: number }, imageData: Uint8ClampedArray, dataPosition: number) {
    imageData[dataPosition + 0] = linearSrgbChannelToSrgbChannel(rgba.r) * 255;
    imageData[dataPosition + 1] = linearSrgbChannelToSrgbChannel(rgba.g) * 255;
    imageData[dataPosition + 2] = linearSrgbChannelToSrgbChannel(rgba.b) * 255;
    imageData[dataPosition + 3] = rgba.a * 255;
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

