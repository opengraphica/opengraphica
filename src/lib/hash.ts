import { createImageFromBlob } from './image';

type HashAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';
type HashEncoding = 'base64' | 'hex';

let temporaryCanvas: HTMLCanvasElement;
let imageComparisonResolution: number = 32;
let imageComparisonDctSize: number = 8;

export async function generateArrayBufferHash(
    arrayBuffer: ArrayBuffer,
    algorithm: HashAlgorithm = 'SHA-1',
    encoding: HashEncoding = 'hex'
): Promise<string> {
    const buffer = await crypto.subtle.digest(algorithm, arrayBuffer)
    const typedArray = new Uint8Array(buffer)
    if (encoding === 'hex') {
        return Array.prototype.map.call(
            typedArray,
            (x: number) => ('00' + x.toString(16)).slice(-2)
        ).join('');
    } else { // encoding === 'base64'
        return btoa(String.fromCharCode.apply(null, typedArray as unknown as number[]));
    }
}

export async function generateImageBlobHash(blob: Blob): Promise<string> {
    const image = await createImageFromBlob(blob);
    return generateImageHash(image);
}

function hammingDistance(a: bigint, b: bigint): number {
    let value = a ^ b;
    let distance = 0;

    while (value !== 0n) {
        distance++;
        value &= value - 1n;
    }

    return distance;
}

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
}


function dctCoefficient(
    pixels: Float64Array,
    width: number,
    u: number,
    v: number
): number {
    let sum = 0;
    for (let y = 0; y < width; y++) {
        for (let x = 0; x < width; x++) {
        const pixel = pixels[y * width + x];
        sum +=
            pixel *
            Math.cos(((2 * x + 1) * u * Math.PI) / (2 * width)) *
            Math.cos(((2 * y + 1) * v * Math.PI) / (2 * width));
        }
    }
    return sum;
}

export async function generateImageHash(image: HTMLCanvasElement | HTMLImageElement | ImageBitmap): Promise<string> {
    const canvas = document.createElement('canvas');
    canvas.width = imageComparisonResolution;
    canvas.height = imageComparisonResolution;

    const ctx = canvas.getContext('2d', { colorSpace: 'srgb' });
    if (!ctx) return '';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, imageComparisonResolution, imageComparisonResolution);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const sourceWidth = image.width;
    const sourceHeight = image.height;
    const scale = Math.min(
        imageComparisonResolution / sourceWidth,
        imageComparisonResolution / sourceHeight
    );
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;
    const x = (imageComparisonResolution - width) / 2;
    const y = (imageComparisonResolution - height) / 2;

    ctx.drawImage(image, x, y, width, height);
    const imageData = ctx.getImageData(
        0,
        0,
        imageComparisonResolution,
        imageComparisonResolution
    ).data;

    const grayscale = new Float64Array(imageComparisonResolution * imageComparisonResolution);
    for (let i = 0, pixel = 0; i < imageData.length; i += 4, pixel++) {
        const red = imageData[i];
        const green = imageData[i + 1];
        const blue = imageData[i + 2];

        // Perceptual luminance.
        grayscale[pixel] = 0.299 * red + 0.587 * green + 0.114 * blue;
    }

    const coefficients: number[] = [];
    for (let v = 0; v < imageComparisonDctSize; v++) {
        for (let u = 0; u < imageComparisonDctSize; u++) {
            if (u === 0 && v === 0) {
                continue;
            }
            coefficients.push(
                dctCoefficient(grayscale, imageComparisonResolution, u, v)
            );
        }
    }

    const threshold = median(coefficients);
    let hash = 0n;
    for (const coefficient of coefficients) {
        hash <<= 1n;
        if (coefficient > threshold) {
            hash |= 1n;
        }
    }

    return `${sourceWidth}${sourceHeight}${hash}`;
}

/**
 * A fast and simple 53-bit string hash function with decent collision resistance.
 * @author bryc https://github.com/bryc/code/blob/master/jshash/experimental/cyrb53.js
 */
export function generateStringHash(str: string, seed = 0) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for(let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1  = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2  = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * Memory efficient object serialization method, only for the purpose of hashing.
 */
function serializeObject(obj: Record<any, any>) {
    const stack: Array<Record<any, any>> = [{ parent: null, key: null, value: obj }];
    let result = '';
    while (stack.length > 0) {
        const { parent, key, value } = stack.pop()!;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            const keys = Object.keys(value).sort();
            for (let i = keys.length - 1; i >= 0; i--) {
                stack.push({ parent: value, key: keys[i], value: value[keys[i]] });
            }
            if (key !== null) {
                result += `${key}{`;
            }
        } else if (Array.isArray(value)) {
            for (let i = value.length - 1; i >= 0; i--) {
                stack.push({ parent: value, key: i, value: value[i] });
            }
            result += `${key}[`;
        } else {
            if (parent !== null && key !== null) {
                result += `${key}:${JSON.stringify(value)},`;
            }
        }
    }
    return result;
}

export function generateObjectHash(object: Record<any, any>) {
    return generateStringHash(serializeObject(object));
}
