import type { RendererFrontend } from '@/types';

type RendererEngine = 'webgl2';

let rendererFrontend: RendererFrontend | undefined = undefined;

export async function useRenderer(engine?: RendererEngine): Promise<RendererFrontend> {
    if (!engine && rendererFrontend) {
        return rendererFrontend;
    }
    rendererFrontend = {
        'webgl2': new (await import('@/renderers/webgl2/frontend')).Webgl2RenderFrontend(),
    }[engine ?? 'webgl2'];
    return rendererFrontend;
}

export * from './common/tiles';