import { markRaw, nextTick } from 'vue';

import type { RendererFrontend } from '@/types';

type RendererEngine = 'webgl2' | 'webgl2-offscreen';

let rendererFrontend: RendererFrontend | undefined = undefined;

let initializeRendererWaitCallbacks: Array<(value: RendererFrontend) => void> = [];

export async function useRenderer(engine?: RendererEngine): Promise<RendererFrontend> {
    if (!engine) {
        if (rendererFrontend) return rendererFrontend;
        return new Promise<RendererFrontend>((resolve) => {
            initializeRendererWaitCallbacks.push(resolve);
        });
    }
    rendererFrontend = markRaw(await ({
        'webgl2': async () => {
            const { getWebgl2RendererBackend } = await import('@/renderers/webgl2/backend');
            return new (await import('@/renderers/webgl2/frontend')).Webgl2RenderFrontend(getWebgl2RendererBackend())
        },
        'webgl2-offscreen': async () => {
            const { Webgl2RendererBackendInterface } = await import('@/renderers/webgl2-offscreen/frontend/backend.interface');
            return new (await import('@/renderers/webgl2/frontend')).Webgl2RenderFrontend(new Webgl2RendererBackendInterface())
        },
    }[engine])()) as RendererFrontend;
    if (initializeRendererWaitCallbacks.length > 0) {
        nextTick(() => {
            for (const callback of initializeRendererWaitCallbacks) {
                callback(rendererFrontend!);
            }
            initializeRendererWaitCallbacks = [];
        });
    }
    return markRaw(rendererFrontend);
}

export * from './common/tiles';