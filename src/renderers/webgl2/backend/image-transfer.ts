
import { Texture } from 'three/src/textures/Texture';

import { messageBus } from './message-bus';

export async function requestFrontendTexture(requestSourceUuid?: string): Promise<Texture | undefined> {
    if (!requestSourceUuid) return;
    const promise = new Promise<Texture | undefined>((resolve) => {
        function handleResponse(options?: { sourceUuid: string, texture: ImageBitmap | undefined }) {
            messageBus.off('frontend.replyFrontendTexture', handleResponse);
            if (!options) {
                return;
            }
            const { sourceUuid, texture } = options;
            if (sourceUuid === requestSourceUuid) {
                resolve(new Texture(texture));
            }
        }
        messageBus.on('frontend.replyFrontendTexture', handleResponse);
    });
    messageBus.emit('backend.requestFrontendTexture', requestSourceUuid);
    return promise;
}
