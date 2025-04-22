import { LinearMipMapLinearFilter, NearestFilter, SRGBColorSpace } from 'three/src/constants';
import { Texture } from 'three/src/textures/Texture';

import { messageBus } from './message-bus';

export async function requestFrontendTexture(requestSourceUuid?: string): Promise<Texture | undefined> {
    if (!requestSourceUuid) return;
    const promise = new Promise<Texture | undefined>((resolve) => {
        function handleResponse(options?: { sourceUuid: string, bitmap: ImageBitmap | undefined }) {
            if (!options) {
                return;
            }
            const { sourceUuid, bitmap } = options;
            if (sourceUuid === requestSourceUuid) {
                messageBus.off('frontend.replyFrontendTexture', handleResponse);
                const texture = new Texture(bitmap);
                texture.premultiplyAlpha = false;
                texture.generateMipmaps = true;
                texture.colorSpace = SRGBColorSpace;
                texture.minFilter = LinearMipMapLinearFilter;
                texture.magFilter = NearestFilter;
                texture.userData = {
                    shouldDisposeBitmap: true,
                };
                resolve(texture);
            }
        }
        messageBus.on('frontend.replyFrontendTexture', handleResponse);
    });
    messageBus.emit('backend.requestFrontendTexture', requestSourceUuid);
    return promise;
}
