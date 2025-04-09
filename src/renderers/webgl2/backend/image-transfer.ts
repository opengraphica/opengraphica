
import { Texture } from 'three/src/textures/Texture';

import { messageBus } from './message-bus';

export async function requestFrontendTexture(requestSourceUuid?: string): Promise<Texture | undefined> {
    if (!requestSourceUuid) return;
    const promise = new Promise<Texture | undefined>((resolve) => {
        function handleResponse(options?: { sourceUuid: string, texture: ImageBitmap | undefined }) {
            if (!options) {
                return;
            }
            const { sourceUuid, texture } = options;
            if (sourceUuid === requestSourceUuid) {
                messageBus.off('frontend.replyFrontendTexture', handleResponse);
                resolve(new Texture(texture));
            }
        }
        messageBus.on('frontend.replyFrontendTexture', handleResponse);
    });
    messageBus.emit('backend.requestFrontendTexture', requestSourceUuid);
    return promise;
}
