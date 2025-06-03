import { colorToHex, linearSrgbaToOklab, srgbaToLinearSrgba, linearSrgbaToSrgba, oklabToLinearSrgba } from './color';
import { lerp } from './math';

import type { RGBAColor, WorkingFileGradientColorStop, WorkingFileGradientColorSpace } from "@/types";

/**
 * Gives the color at the specified offset in a gradient.
 * @function sampleGradient
 * @param {WorkingFileGradientColorStop<RGBAColor>[]} stops - The list of gradient color stops
 * @param {WorkingFileGradientColorSpace} colorSpace - The color space to use to interpolate between colors
 * @param {number} sampleOffset - The offset to sample the gradient at
 * @returns {RGBAColor} - The sampled color
 */

export function sampleGradient(
    stops: WorkingFileGradientColorStop<RGBAColor>[],
    colorSpace: WorkingFileGradientColorSpace,
    sampleOffset: number,
): RGBAColor {
    const sortedStops = [...stops].sort((a, b) => a.offset < b.offset ? -1 : 1);

    if (sortedStops.length === 0) return {
        is: 'color',
        r: 0, g: 0, b: 0, alpha: 1,
        style: '#000000',
    } as RGBAColor;

    let leftOffset = 0;
    let leftColor = sortedStops[0].color;
    let rightOffset = 1;
    let rightColor = sortedStops[0].color;

    if (sampleOffset >= sortedStops[0].offset) {
        for (const [stopIndex, stop] of sortedStops.entries()) {
            const nextStopIndex = Math.min(stopIndex + 1, sortedStops.length - 1);
            const nextStop = sortedStops[nextStopIndex];
            if (
                (sampleOffset >= stop.offset && sampleOffset < nextStop.offset) ||
                stopIndex === sortedStops.length - 1
            ) {
                leftOffset = stop.offset;
                leftColor = stop.color;
                rightOffset = sortedStops[nextStopIndex].offset;
                rightColor = sortedStops[nextStopIndex].color;
                break;
            }
        }
    }

    const interpolateOffset = (rightOffset - leftOffset > 0) ? (sampleOffset - leftOffset) / (rightOffset - leftOffset) : 0;
    let interpolatedColor = leftColor;
    if (colorSpace === 'oklab') {
        const leftColorTransfer = linearSrgbaToOklab(srgbaToLinearSrgba(leftColor));
        const rightColorTransfer = linearSrgbaToOklab(srgbaToLinearSrgba(rightColor));
        interpolatedColor = linearSrgbaToSrgba(oklabToLinearSrgba({
            l: lerp(leftColorTransfer.l, rightColorTransfer.l, interpolateOffset),
            a: lerp(leftColorTransfer.a, rightColorTransfer.a, interpolateOffset),
            b: lerp(leftColorTransfer.b, rightColorTransfer.b, interpolateOffset),
            alpha: lerp(leftColorTransfer.alpha, rightColorTransfer.alpha, interpolateOffset),
        }));
    } else if (colorSpace === 'linearSrgb') {
        const leftColorTransfer = srgbaToLinearSrgba(leftColor);
        const rightColorTransfer = srgbaToLinearSrgba(rightColor);
        interpolatedColor = linearSrgbaToSrgba({
            r: lerp(leftColorTransfer.r, rightColorTransfer.r, interpolateOffset),
            g: lerp(leftColorTransfer.g, rightColorTransfer.g, interpolateOffset),
            b: lerp(leftColorTransfer.b, rightColorTransfer.b, interpolateOffset),
            alpha: lerp(leftColorTransfer.alpha, rightColorTransfer.alpha, interpolateOffset),
        });
    } else {
        interpolatedColor = {
            is: 'color',
            r: lerp(leftColor.r, rightColor.r, interpolateOffset),
            g: lerp(leftColor.g, rightColor.g, interpolateOffset),
            b: lerp(leftColor.b, rightColor.b, interpolateOffset),
            alpha: lerp(leftColor.alpha, rightColor.alpha, interpolateOffset),
            style: leftColor.style,
        }
        interpolatedColor.style = colorToHex(interpolatedColor, 'rgba');
    }
    return interpolatedColor;
}

/**
 * Generates the styles for a CSS gradient with the given color stops.
 * @function generateCssGradient
 * @param {WorkingFileGradientColorStop<RGBAColor>[]} colorStops - The color stops that define the gradient
 * @param {WorkingFileGradientColorSpace | number} blendColorSpace - The color space to use to interpolate between colors
 * @returns {string} - The CSS string as a linear-gradient() command
 */

export function generateCssGradient(
    colorStops: WorkingFileGradientColorStop<RGBAColor>[],
    blendColorSpace: WorkingFileGradientColorSpace | number
): string {
    if (blendColorSpace === 0) {
        blendColorSpace = 'oklab';
    } else if (blendColorSpace === 1) {
        blendColorSpace = 'srgb';
    } else if (blendColorSpace === 2) {
        blendColorSpace = 'linearSrgb';
    }

    let previewGradient = '';
    let handledOffsets = new Set<number>();
    let sampledColorStops: WorkingFileGradientColorStop<RGBAColor>[] = [];
    for (const stop of colorStops) {
        sampledColorStops.push(stop);
        handledOffsets.add(stop.offset);
    }
    for (let i = 0; i <= 100; i += 10) {
        const sampleOffset = i / 100;
        if (handledOffsets.has(sampleOffset)) continue;
        sampledColorStops.push({
            offset: sampleOffset,
            color: sampleGradient(colorStops, blendColorSpace as WorkingFileGradientColorSpace, sampleOffset),
        });
    }
    sampledColorStops.sort((a, b) => a.offset < b.offset ? -1 : 1);

    if (blendColorSpace === 'oklab') {
        previewGradient = 'linear-gradient(in oklab 90deg, ' + sampledColorStops.map((colorStop) => {
            const { l, a, b, alpha } = linearSrgbaToOklab(srgbaToLinearSrgba(colorStop.color));
            return `oklab(${l * 100}% ${a} ${b} / ${alpha}) ${colorStop.offset * 100}%`
        }).join(', ') + ')';
    } else if (blendColorSpace === 'linearSrgb') { 
        previewGradient = 'linear-gradient(in srgb-linear 90deg, ' + sampledColorStops.map((colorStop) => {
            return `${colorStop.color.style} ${colorStop.offset * 100}%`
        }).join(', ') + ')';
    }
    if (!window?.CSS?.supports || !window.CSS.supports('background-image', previewGradient)) {
        previewGradient = 'linear-gradient(90deg, ' + sampledColorStops.map((colorStop) => {
            return `${colorStop.color.style} ${colorStop.offset * 100}%`
        }).join(', ') + ')';
    }
    return previewGradient;
}

/**
 * Generates a canvas that contains a 1-dimensional sampling of a gradient. For use in shaders.
 * @function generateGradientImage
 * @param {WorkingFileGradientColorStop<RGBAColor>[]} stops - The list of gradient color stops
 * @param {WorkingFileGradientColorSpace} colorSpace - The color space to use to interpolate between colors
 * @param {number} textureSize - How wide the resulting texture will be
 * @returns {HTMLCanvasElement | OffscreenCanvas} A canvas that contains the gradient texture
 */

export function generateGradientImage(
    stops: WorkingFileGradientColorStop<RGBAColor>[],
    colorSpace: WorkingFileGradientColorSpace,
    textureSize: number = 64
): HTMLCanvasElement | OffscreenCanvas {
    const gradientImageData = new ImageData(textureSize, 1);
    stops.sort((a, b) => a.offset < b.offset ? -1 : 1);
    let leftStopIndex = stops[0].offset > 0 ? -1 : 0;
    let leftOffset = 0;
    let leftColor = stops[0].color as RGBAColor;
    const rightStopIndex = Math.min(leftStopIndex + 1, stops.length - 1);
    let rightOffset = stops[rightStopIndex].offset;
    let rightColor = (stops[rightStopIndex].color) as RGBAColor;
    for (let i = 0; i < textureSize; i++) {
        const currentStopOffset = i / (textureSize - 1);
        if (currentStopOffset > rightOffset) {
            leftStopIndex += 1;
            const leftStop = stops[Math.min(leftStopIndex, stops.length - 1)];
            const rightStop = stops[Math.min(leftStopIndex + 1, stops.length - 1)];
            leftOffset = leftStop.offset;
            leftColor = leftStop.color as RGBAColor;
            rightOffset = leftStopIndex + 1 > stops.length - 1 ? 1 : rightStop.offset;
            rightColor = rightStop.color as RGBAColor;
        }
        const interpolateOffset = (rightOffset - leftOffset > 0) ? (currentStopOffset - leftOffset) / (rightOffset - leftOffset) : 0;
        let interpolatedColor = leftColor;
        if (colorSpace === 'oklab') {
            const leftColorTransfer = linearSrgbaToOklab(srgbaToLinearSrgba(leftColor));
            const rightColorTransfer = linearSrgbaToOklab(srgbaToLinearSrgba(rightColor));
            interpolatedColor = linearSrgbaToSrgba(oklabToLinearSrgba({
                l: lerp(leftColorTransfer.l, rightColorTransfer.l, interpolateOffset),
                a: lerp(leftColorTransfer.a, rightColorTransfer.a, interpolateOffset),
                b: lerp(leftColorTransfer.b, rightColorTransfer.b, interpolateOffset),
                alpha: lerp(leftColorTransfer.alpha, rightColorTransfer.alpha, interpolateOffset),
            }));
        } else if (colorSpace === 'linearSrgb') {
            const leftColorTransfer = srgbaToLinearSrgba(leftColor);
            const rightColorTransfer = srgbaToLinearSrgba(rightColor);
            interpolatedColor = linearSrgbaToSrgba({
                r: lerp(leftColorTransfer.r, rightColorTransfer.r, interpolateOffset),
                g: lerp(leftColorTransfer.g, rightColorTransfer.g, interpolateOffset),
                b: lerp(leftColorTransfer.b, rightColorTransfer.b, interpolateOffset),
                alpha: lerp(leftColorTransfer.alpha, rightColorTransfer.alpha, interpolateOffset),
            });
        } else {
            interpolatedColor = {
                is: 'color',
                r: lerp(leftColor.r, rightColor.r, interpolateOffset),
                g: lerp(leftColor.g, rightColor.g, interpolateOffset),
                b: lerp(leftColor.b, rightColor.b, interpolateOffset),
                alpha: lerp(leftColor.alpha, rightColor.alpha, interpolateOffset),
                style: leftColor.style,
            }
        }
        gradientImageData.data[(i * 4)] = Math.round(255 * interpolatedColor.r);
        gradientImageData.data[(i * 4) + 1] = Math.round(255 * interpolatedColor.g);
        gradientImageData.data[(i * 4) + 2] = Math.round(255 * interpolatedColor.b);
        gradientImageData.data[(i * 4) + 3] = Math.round(255 * interpolatedColor.alpha);
    }
    let canvas: HTMLCanvasElement | OffscreenCanvas;
    if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
        canvas = new OffscreenCanvas(gradientImageData.width, gradientImageData.height);
    } else {
        canvas = document.createElement('canvas');
        canvas.width = gradientImageData.width;
        canvas.height = gradientImageData.height;
    }
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
    if (ctx) {
        ctx.putImageData(gradientImageData, 0, 0);
    }
    return canvas;
}
