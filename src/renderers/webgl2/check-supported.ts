import { isWorkerSupported } from '@/lib/feature-detection/worker';

export async function isRendererSupported() {
    return (
        await isWorkerSupported()
    );
}