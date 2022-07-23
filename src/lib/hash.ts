import { createImageFromBlob } from './image';

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
    const ctx = temporaryCanvas.getContext('2d');
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
