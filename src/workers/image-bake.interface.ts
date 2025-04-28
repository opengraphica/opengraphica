import { toRaw } from 'vue';

import { getImageDataFromImage, getImageDataFromImageBitmap, getImageDataFromCanvas } from '@/lib/image';
import { deepToRaw } from '@/lib/vue';

import workingFileStore from '@/store/working-file';
import canvasStore from '@/store/canvas';
import { getStoredImageOrCanvas } from '@/store/image';

import type { WorkingFileLayerFilter } from '@/types';
import type {
    FilterBakeQueueItem, FilterNewBakeRequest, FilterCancelBakeRequest,
    FilterBakeResult, FilterBakeError, LogResponse
} from './image-bake.types';

// export const imageBakeWorker = new Worker(
//     /* webpackChunkName: 'worker-image-bake' */ new URL('./image-bake.worker.ts', import.meta.url)
// );

let queueIdCounter = 0;
const instructionQueue: FilterBakeQueueItem[] = [];

// imageBakeWorker.onmessage = ({ data }: { data: FilterBakeResult | FilterBakeError | LogResponse }) => {
//     if (data.type === 'FILTER_BAKE_RESULT') {
//         const queueIndex = instructionQueue.findIndex((queueItem) => queueItem.queueId === data.queueId);
//         if (queueIndex > -1) {
//             instructionQueue[queueIndex].resolvePromise(data.imageData);
//             instructionQueue.splice(queueIndex, 1);
//             // TODO - get layer, set baked image in store
//         } else {
//             // If not found in the queue, the request was canceled. So ignore.
//         }
//     } else if (data.type === 'FILTER_BAKE_ERROR') {
//         const queueIndex = instructionQueue.findIndex((queueItem) => queueItem.queueId === data.queueId);
//         if (queueIndex > -1) {
//             instructionQueue[queueIndex].rejectPromise(new Error(data.message));
//             instructionQueue.splice(queueIndex, 1);
//         } else {
//             // If not found in the queue, the request was canceled. So ignore.
//         }
//     } else if (data.type === 'LOG') {
//         console.info(data.message);
//     }
// };
// imageBakeWorker.onmessageerror = (error) => {
//     console.error('[src/workers/image-bake.interface.ts] Error received from imageBakeWorker', error);
// };

export function cancelBakeCanvasFilters(layerId: number) {
    const existingQueueIndex = instructionQueue.findIndex((queueItem) => queueItem.type === 'FILTER_BAKE' && queueItem.layerId === layerId);
    if (existingQueueIndex > -1) {
        // imageBakeWorker.postMessage({
        //     type: 'CANCEL_FILTER_BAKE',
        //     queueId: instructionQueue[existingQueueIndex].queueId
        // } as FilterCancelBakeRequest);
        instructionQueue[existingQueueIndex].rejectPromise();
        instructionQueue.splice(existingQueueIndex, 1);
    }
}

export function bakeCanvasFilters(imageData: ImageData, layerId: number, filterConfigurations: WorkingFileLayerFilter[]): Promise<ImageData> {
    // Remove existing request for this layer.
    cancelBakeCanvasFilters(layerId);

    return new Promise<ImageData>((resolve, reject) => {
        try {
            // Create new request for this layer.
            const queueId = queueIdCounter++;
            instructionQueue.push({
                type: 'FILTER_BAKE',
                queueId,
                layerId,
                resolvePromise: resolve,
                rejectPromise: reject
            });
            const masks: Record<number, ImageData> = {};
            for (const filter of filterConfigurations) {
                if (filter.maskId != null) {
                    const mask = workingFileStore.get('masks')[filter.maskId];
                    const sourceImage = getStoredImageOrCanvas(mask.sourceUuid ?? '');
                    if (!sourceImage) continue;
                    const sourceImageData = (sourceImage instanceof HTMLImageElement)
                        ? getImageDataFromImage(sourceImage)
                        : (sourceImage instanceof ImageBitmap)
                            ? getImageDataFromImageBitmap(sourceImage, { imageOrientation: canvasStore.state.renderer === 'webgl' ? 'flipY' : 'none' })
                            : getImageDataFromCanvas(sourceImage);
                    masks[filter.maskId] = sourceImageData;
                }
            }

            // imageBakeWorker.postMessage({
            //     type: 'NEW_FILTER_BAKE',
            //     queueId,
            //     layerId,
            //     imageData: toRaw(imageData),
            //     filterConfigurations: deepToRaw(filterConfigurations),
            //     masks,
            // } as FilterNewBakeRequest);
        } catch (error) {
            console.error('[src/workers/image-bake.interface.ts] Error sending message. ', error);
        }
    });
}
