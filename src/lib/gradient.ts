import { linearSrgbaToOklab, srgbaToLinearSrgba, linearSrgbaToSrgba, oklabToLinearSrgba } from './color';
import { lerp } from './math';

import type { RGBAColor, WorkingFileGradientColorStop, WorkingFileGradientColorSpace } from "@/types";

export function sampleGradient(stops: WorkingFileGradientColorStop<RGBAColor>[], colorSpace: WorkingFileGradientColorSpace, sampleOffset: number): RGBAColor {
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

    for (const [stopIndex, stop] of sortedStops.entries()) {
        const nextStopIndex = Math.min(stopIndex + 1, sortedStops.length - 1);
        const nextStop = sortedStops[nextStopIndex];
        if ((sampleOffset >= stop.offset && sampleOffset < nextStop.offset) || stopIndex === sortedStops.length - 1) {
            leftOffset = stop.offset;
            leftColor = stop.color;
            rightOffset = sortedStops[nextStopIndex].offset;
            rightColor = sortedStops[nextStopIndex].color;
            break;
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
    }
    return interpolatedColor;
}
