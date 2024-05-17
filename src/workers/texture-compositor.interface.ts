import { toRaw } from 'vue';
import type { PrepareThreejsTextureRequest, TextureCompositeQueueItem, TextureCompositeResult, TextureCompositeRequest, TerminateRequest } from './texture-compositor.types';

let textureCompositorWorker: Worker | null = null;
let terminateWorkerCheckInterval: number | undefined = undefined;
const instructionQueue: TextureCompositeQueueItem[] = [];
let queueIdCounter = 0;

export function prepareTextureCompositor() {
    if (textureCompositorWorker == null) {
        textureCompositorWorker = new Worker(
            /* webpackChunkName: 'worker-texture-compositor' */ new URL('./texture-compositor.worker.ts', import.meta.url)
        );
        textureCompositorWorker.onmessage = ({ data }: { data: TextureCompositeResult }) => {
            if (data.type === 'TEXTURE_COMPOSITE_RESULT') {
                const queueIndex = instructionQueue.findIndex((queueItem) => queueItem.queueId === data.queueId);
                if (queueIndex > -1) {
                    try {
                        if (data.bitmap) {
                            instructionQueue[queueIndex].resolvePromise(data.bitmap);
                        } else {
                            instructionQueue[queueIndex].rejectPromise();
                        }
                    } catch (error) { /* Ignore */ }
                    instructionQueue.splice(queueIndex, 1);
                }
            }
        };
        textureCompositorWorker.onmessageerror = (error) => {
            console.error('[src/workers/image-bake.interface.ts] Error received from imageBakeWorker', error);
        };
    }
    clearInterval(terminateWorkerCheckInterval);
    terminateWorkerCheckInterval = window.setInterval(() => {
        if (instructionQueue.length === 0) {
            textureCompositorWorker?.postMessage({
                type: 'TERMINATE'
            } as TerminateRequest);
            textureCompositorWorker = null;
        }
    }, 120000);
}

export async function createCompositeTexture2d(
    baseImage: HTMLCanvasElement | ImageBitmap,
    overlayImage: HTMLCanvasElement | ImageBitmap,
    overlayOffsetX: number,
    overlayOffsetY: number,
    blendMode: string = 'source-over'
): Promise<ImageBitmap> {
    prepareTextureCompositor();

    let isCreatedBaseImage = false;
    let isCreatedOverlayImage = false;

    const [baseImageBitmap, overlayImageBitmap] = await Promise.all([
        (baseImage instanceof ImageBitmap)
            ? toRaw(baseImage)
            : await createImageBitmap(baseImage, 0, 0, baseImage.width, baseImage.height, {
                imageOrientation: 'flipY',
                premultiplyAlpha: 'none',
            }).then((result) => {
                isCreatedBaseImage = true;
                return result;
            }),
        (overlayImage instanceof ImageBitmap)
            ? toRaw(overlayImage)
            : await createImageBitmap(overlayImage, 0, 0, overlayImage.width, overlayImage.height, {
                imageOrientation: 'flipY',
                premultiplyAlpha: 'none',
            }).then((result) => {
                isCreatedOverlayImage = true;
                return result;
            })
    ]);

    const resultBitmap = await new Promise<ImageBitmap>((resolve, reject) => {
        const queueId = queueIdCounter++;
        instructionQueue.push({
            type: 'COMPOSITE_TEXTURE',
            queueId,
            resolvePromise: resolve,
            rejectPromise: reject,
        });
        textureCompositorWorker?.postMessage({
            type: 'NEW_TEXTURE_COMPOSITE',
            queueId,
            baseBitmap: baseImageBitmap,
            overlayBitmap: overlayImageBitmap,
            overlayOffsetX,
            overlayOffsetY,
            blendMode,
        } as TextureCompositeRequest);
    });

    if (isCreatedBaseImage) {
        baseImageBitmap.close();
    }
    if (isCreatedOverlayImage) {
        overlayImageBitmap.close();
    }

    return resultBitmap;
}

export async function prepareThreejsTexture(
    image: HTMLCanvasElement | ImageBitmap,
): Promise<ImageBitmap> {
    prepareTextureCompositor();

    let isCreatedImage = false;

    const imageBitmap = (image instanceof ImageBitmap)
        ? toRaw(image)
        : await createImageBitmap(image, 0, 0, image.width, image.height, {
            imageOrientation: 'flipY',
            premultiplyAlpha: 'none',
        }).then((result) => {
            isCreatedImage = true;
            return result;
        });

    const resultBitmap = await new Promise<ImageBitmap>((resolve, reject) => {
        const queueId = queueIdCounter++;
        instructionQueue.push({
            type: 'COMPOSITE_TEXTURE',
            queueId,
            resolvePromise: resolve,
            rejectPromise: reject,
        });
        textureCompositorWorker?.postMessage({
            type: 'NEW_PREPARE_THREEJS_TEXTURE',
            queueId,
            bitmap: imageBitmap,
        } as PrepareThreejsTextureRequest);
    });

    if (isCreatedImage) {
        imageBitmap.close();
    }

    return resultBitmap;
}
