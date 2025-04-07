import type { RendererFrontend } from '@/types';

type RendererEngine = 'webgl2';

export async function useRenderer(engine: RendererEngine): Promise<RendererFrontend> {
    return {
        'webgl2': new (await import('@/renderers/webgl2/frontend')).Webgl2RenderFrontend(),
    }[engine];
}
