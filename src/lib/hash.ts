import { createImageFromBlob } from './image';
import { getCanvasRenderingContext2DSettings } from '@/store/working-file';

type HashAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';
type HashEncoding = 'base64' | 'hex';

let temporaryCanvas: HTMLCanvasElement;
let imageComparisonResolution: number = 20;

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
    let hash = '';
    const image = await createImageFromBlob(blob);
    if (!temporaryCanvas) {
        temporaryCanvas = document.createElement('canvas');
    }
    temporaryCanvas.width = imageComparisonResolution;
    temporaryCanvas.height = imageComparisonResolution / image.width * image.height;
    const ctx = temporaryCanvas.getContext('2d', getCanvasRenderingContext2DSettings());
    if (ctx) {
        ctx.clearRect(0, 0, temporaryCanvas.width, temporaryCanvas.height);
        ctx.scale(imageComparisonResolution / image.width, imageComparisonResolution / image.width);
        ctx.drawImage(image, 0, 0);
        const buffer = await crypto.subtle.digest('SHA-1', ctx.getImageData(0, 0, temporaryCanvas.width, temporaryCanvas.height).data);
        const typedArray = new Uint8Array(buffer)
        hash = temporaryCanvas.width + 'x' + temporaryCanvas.height + 'x' + Array.prototype.map.call(
            typedArray,
            (x: number) => ('00' + x.toString(16)).slice(-2)
        ).join('');
    }
    return hash;
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
