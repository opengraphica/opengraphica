import { markRaw, nextTick } from 'vue';

import type { RendererFrontend } from '@/types';

type RendererEngine = 'canvas2d' | 'webgl2' | 'webgl2-offscreen';

let rendererFrontend: RendererFrontend | undefined = undefined;

let initializeRendererWaitCallbacks: Array<(value: RendererFrontend) => void> = [];

export async function useRenderer(engine?: RendererEngine): Promise<RendererFrontend> {
    if (!engine) {
        if (rendererFrontend) return rendererFrontend;
        return new Promise<RendererFrontend>((resolve) => {
            initializeRendererWaitCallbacks.push(resolve);
        });
    }
    const { isRendererSupported: isWebgl2RendererSupported } = await import('@/renderers/webgl2/check-supported');
    const { isRendererSupported: isWebgl2OffscreenRendererSupported } = await import('@/renderers/webgl2-offscreen/check-supported');
    const supportedRenderers: string[] = [];
    if (await isWebgl2RendererSupported()) {
        supportedRenderers.push('webgl2');
    }
    if (await isWebgl2OffscreenRendererSupported()) {
        supportedRenderers.push('webgl2-offscreen');
    }
    if (!supportedRenderers.includes(engine)) {
        engine = 'webgl2';
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