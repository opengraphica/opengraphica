import { messageBus } from './message-bus';

import type { WasmImageData } from '@/types';

export async function requestFrontendTextureImageData(requestSourceUuid?: string): Promise<WasmImageData | undefined> {
    if (!requestSourceUuid) return;
    const promise = new Promise<WasmImageData | undefined>((resolve) => {
        function handleResponse(options?: { sourceUuid: string, imageData: WasmImageData | undefined }) {
            if (!options) return;
            const { sourceUuid, imageData } = options;
            if (sourceUuid === requestSourceUuid) {
                messageBus.off('frontend.replyFrontendTexture', handleResponse);
                resolve(imageData);
            }
        }
        messageBus.on('frontend.replyFrontendTexture', handleResponse);
    });
    messageBus.emit('backend.requestFrontendTexture', requestSourceUuid);
    return promise;
}
