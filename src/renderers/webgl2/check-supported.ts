import { isOffscreenCanvasSupported } from '@/lib/feature-detection/offscreen-canvas';
import { isWorkerSupported } from '@/lib/feature-detection/worker';

export async function isRendererSupported() {
    return (
        await isWorkerSupported() &&
        await isOffscreenCanvasSupported()
    );
}