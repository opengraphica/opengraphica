import { markRaw, nextTick } from 'vue';

import type { RendererFrontend } from '@/types';

type RendererEngine = 'webgl2';

let rendererFrontend: RendererFrontend | undefined = undefined;

let initializeRendererWaitCallbacks: Array<(value: RendererFrontend) => void> = [];

export async function useRenderer(engine?: RendererEngine): Promise<RendererFrontend> {
    if (!engine) {
        if (rendererFrontend) return rendererFrontend;
        return new Promise<RendererFrontend>((resolve) => {
            initializeRendererWaitCallbacks.push(resolve);
        });
    }
    rendererFrontend = markRaw({
        'webgl2': new (await import('@/renderers/webgl2/frontend')).Webgl2RenderFrontend(),
    }[engine ?? 'webgl2']);
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