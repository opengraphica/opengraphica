import { LinearMipMapLinearFilter, NearestFilter, RGBAFormat, SRGBColorSpace, UnsignedByteType } from 'three/src/constants';
import { CanvasTexture } from 'three/src/textures/CanvasTexture';
import { Texture } from 'three/src/textures/Texture';

import { messageBus } from './message-bus';

export function createTexture(bitmap?: ImageBitmap) {
    if (!bitmap) return;
    const texture = new Texture(bitmap);
    texture.format = RGBAFormat;
    texture.type = UnsignedByteType;
    texture.premultiplyAlpha = false;
    texture.generateMipmaps = true;
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearMipMapLinearFilter;
    texture.magFilter = NearestFilter; // Alpha channel in texture copies are corrupted if this isn't nearest. Anti-aliasing should happen in the shader.
    texture.userData = {
        shouldDisposeBitmap: bitmap instanceof ImageBitmap,
    };
    texture.needsUpdate = true;
    return texture;
}

export function createCanvasTexture(canvas: HTMLCanvasElement | OffscreenCanvas) {
    const texture = new CanvasTexture(canvas);
    texture.format = RGBAFormat;
    texture.type = UnsignedByteType;
    texture.premultiplyAlpha = false;
    texture.generateMipmaps = true;
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearMipMapLinearFilter;
    texture.magFilter = NearestFilter; // Alpha channel in texture copies are corrupted if this isn't nearest. Anti-aliasing should happen in the shader.
    texture.userData = {
        shouldDisposeBitmap: false,
    };
    texture.needsUpdate = true;
    return texture;
}

export async function requestFrontendBitmap(requestSourceUuid?: string): Promise<ImageBitmap | undefined> {
    if (!requestSourceUuid) return;
    const promise = new Promise<ImageBitmap | undefined>((resolve) => {
        function handleResponse(options?: { sourceUuid: string, bitmap: ImageBitmap | undefined }) {
            if (!options) return;
            const { sourceUuid, bitmap } = options;
            if (sourceUuid === requestSourceUuid) {
                messageBus.off('frontend.replyFrontendTexture', handleResponse);
                resolve(bitmap);
            }
        }
        messageBus.on('frontend.replyFrontendTexture', handleResponse);
    });
    messageBus.emit('backend.requestFrontendTexture', requestSourceUuid);
    return promise;
}

export async function requestFrontendTexture(requestSourceUuid?: string): Promise<Texture | undefined> {
    const bitmap = await requestFrontendBitmap(requestSourceUuid);
    return createTexture(bitmap);
}

export async function requestFrontendSvg(
    requestSourceUuid: string | undefined,
    width: number,
    height: number
): Promise<Texture | undefined> {
    if (!requestSourceUuid) return;
    const promise = new Promise<Texture | undefined>((resolve) => {
        function handleResponse(options?: { sourceUuid: string, bitmap: ImageBitmap | undefined }) {
            if (!options) return;
            const { sourceUuid, bitmap } = options;
            if (sourceUuid === requestSourceUuid) {
                messageBus.off('frontend.replyFrontendTexture', handleResponse);
                resolve(createTexture(bitmap));
            }
        }
        messageBus.on('frontend.replyFrontendSvg', handleResponse);
    });
    messageBus.emit('backend.requestFrontendSvg', { sourceUuid: requestSourceUuid, width, height });
    return promise;
}

export async function requestFrontendVideoFrame(
    requestSourceUuid: string | undefined,
): Promise<ImageBitmap | undefined> {
    if (!requestSourceUuid) return;
    const promise = new Promise<ImageBitmap | undefined>((resolve) => {
        function handleResponse(options?: { sourceUuid: string, bitmap: ImageBitmap | undefined }) {
            if (!options) return;
            const { sourceUuid, bitmap } = options;
            if (sourceUuid === requestSourceUuid) {
                messageBus.off('frontend.replyFrontendVideoFrame', handleResponse);
                resolve(bitmap);
            }
        }
        messageBus.on('frontend.replyFrontendVideoFrame', handleResponse);
    });
    messageBus.emit('backend.requestFrontendVideoFrame', requestSourceUuid);
    return promise;
}
