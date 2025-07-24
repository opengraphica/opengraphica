
import type { FindContrastLinesRequest, FindContrastLinesResponse } from './bitmap-analyzer.types';

self.onmessage = ({ data }) => {
    if (data.type === 'CONTRAST_LINES') {
        findContrastLines(data);
    }
}

function getImageDataLuminance(data: Uint8ClampedArray, i: number) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function findContrastLines(request: FindContrastLinesRequest) {
    const horizontalLines: number[] = [];
    const verticalLines: number[] = [];

    try {

        const canvas = new OffscreenCanvas(request.bitmap.width, request.bitmap.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('[src/lib/image.ts] Could not create canvas context.');
        ctx.drawImage(request.bitmap, 0, 0);
        const imageData = ctx.getImageData(0, 0, request.bitmap.width, request.bitmap.height);
        request.bitmap.close();

        const { data, width, height } = imageData;
        const horizontalContrast = new Float32Array(height - 1);
        const verticalContrast = new Float32Array(width - 1);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                const lum = getImageDataLuminance(data, i);
            
                // Check vertical contrast (compare with right neighbor)
                if (x < width - 1) {
                    const iRight = i + 4;
                    const lumRight = getImageDataLuminance(data, iRight);
                    verticalContrast[x] += Math.abs(lum - lumRight);
                }
            
                // Check horizontal contrast (compare with bottom neighbor)
                if (y < height - 1) {
                    const iBelow = i + width * 4;
                    const lumBelow = getImageDataLuminance(data, iBelow);
                    horizontalContrast[y] += Math.abs(lum - lumBelow);
                }
            }
        }

        const horizontalContrastBreakpoint = height * 50;
        const verticalContrastBreakpoint = width * 50;

        for (let [i, contrast] of horizontalContrast.entries()) {
            if (contrast > horizontalContrastBreakpoint) {
                horizontalLines.push(i + 1);
            }
        }

        for (let [i, contrast] of verticalContrast.entries()) {
            if (contrast > verticalContrastBreakpoint) {
                verticalLines.push(i + 1);
            }
        }

    } catch (error) {
        // Ignore
    }

    self.postMessage({
        type: 'CONTRAST_LINES_RESULT',
        uuid: request.uuid,
        verticalLines,
        horizontalLines,
    } as FindContrastLinesResponse);
}
