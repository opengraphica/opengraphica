import { markRaw, nextTick } from 'vue';

import type { RendererFrontend } from '@/types';

type RendererEngine = 'canvas2d' | 'webgl2' | 'webgl2-offscreen' | 'wgpu-wasm';

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
    const { isRendererSupported: isWgpuWasmRendererSupported } = await import('@/renderers/wgpu-wasm/check-supported');
    const supportedRenderers: string[] = [];
    await Promise.allSettled([
        isWebgl2RendererSupported().then((supported) => supported && supportedRenderers.push('webgl2')),
        isWebgl2OffscreenRendererSupported().then((supported) => supported && supportedRenderers.push('webgl2-offscreen')),
        isWgpuWasmRendererSupported().then((supported) => supported && supportedRenderers.push('wgpu-wasm')),
    ]);
    if (!supportedRenderers.includes(engine)) {
        engine = 'webgl2';
    }
    rendererFrontend = markRaw(await ({
        'webgl2': async () => {
            const { getWebgl2RendererBackend } = await import('@/renderers/webgl2/backend');
            return new (await import('@/renderers/webgl2/frontend')).Webgl2RendererFrontend(getWebgl2RendererBackend());
        },
        'webgl2-offscreen': async () => {
            const { Webgl2RendererBackendInterface } = await import('@/renderers/webgl2-offscreen/frontend/backend.interface');
            return new (await import('@/renderers/webgl2/frontend')).Webgl2RendererFrontend(new Webgl2RendererBackendInterface());
        },
        'wgpu-wasm': async () => {
            const { getWgpuWasmRendererBackend } = await import('@/renderers/wgpu-wasm/backend');
            return new (await import('@/renderers/wgpu-wasm/frontend')).WgpuWasmRendererFrontend(getWgpuWasmRendererBackend());
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