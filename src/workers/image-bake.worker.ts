import filterClassesByName from '@/canvas/filters/filter-classes-by-name';

import type { FilterBakeResult, FilterBakeError, FilterNewBakeRequest, FilterCancelBakeRequest } from './image-bake.types';

const instructionQueue: Array<FilterNewBakeRequest | FilterCancelBakeRequest> = [];
let isWorkingQueue: boolean = false;

self.onmessage = ({ data }: { data: FilterNewBakeRequest | FilterCancelBakeRequest }) => {
    if (data.type === 'NEW_FILTER_BAKE') {
        const queueIndex = instructionQueue.findIndex((queueItem) => {
            return (
                (queueItem.type === 'CANCEL_FILTER_BAKE' && queueItem.queueId === data.queueId) ||
                (queueItem.type === 'NEW_FILTER_BAKE' && queueItem.layerId === data.layerId)
            )
        });
        if (queueIndex > -1) {
            instructionQueue.splice(queueIndex, 1);
        }
        instructionQueue.push(data);
    }
    else if (data.type === 'CANCEL_FILTER_BAKE') {
        const queueIndex = instructionQueue.findIndex((queueItem) => queueItem.queueId === data.queueId);
        if (queueIndex > -1) {
            instructionQueue.splice(queueIndex, 1);
        } else {
            instructionQueue.push(data);
        }
    }
    workQueue();
};

function log(message: any) {
    self.postMessage({
        type: 'LOG',
        message: `${message}`,
    });
}

async function workQueue() {
    if (!isWorkingQueue) {
        const queueItem = instructionQueue.shift();
        if (queueItem) {
            isWorkingQueue = true;
            if (queueItem.type === 'NEW_FILTER_BAKE') {
                await workNewFilterBake(queueItem);
            }
            isWorkingQueue = false;
            setTimeout(() => {
                workQueue();
            }, 0);
        }
    }
}

async function workNewFilterBake(queueItem: FilterNewBakeRequest) {
    try {
        // Manipulate the imageData.
        const appliedImageData = queueItem.imageData;
        const imageDataSize = appliedImageData.width * appliedImageData.height * 4;

        for (const filterConfiguration of queueItem.filterConfigurations) {
            const filterName = filterConfiguration.name;
            if (filterName in filterClassesByName && !filterConfiguration.disabled) {
                const filter = new filterClassesByName[filterName as keyof typeof filterClassesByName]();
                filter.params = filterConfiguration.params;

                const appliedData = appliedImageData.data;
                for (let i = 0; i < imageDataSize; i += 4) {
                    filter.fragment(appliedData, appliedData, i);
                }

                // Wait for new messages to come in.
                await new Promise((resolve) => {
                    setTimeout(resolve, 0);
                });

                // Check if this was canceled already, don't send it back if so.
                const cancelRequestIndex = instructionQueue.findIndex((queueItem) => 
                    (queueItem.type === 'CANCEL_FILTER_BAKE' && queueItem.queueId === queueItem.queueId)
                );
                if (cancelRequestIndex > -1) {
                    instructionQueue.splice(cancelRequestIndex, 1);
                    return;
                }
            }
        }

        // Wait for new messages to come in.
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
        
        // Check if this was canceled already, don't send it back if so.
        const cancelRequestIndex = instructionQueue.findIndex((queueItem) => 
            (queueItem.type === 'CANCEL_FILTER_BAKE' && queueItem.queueId === queueItem.queueId)
        );
        if (cancelRequestIndex > -1) {
            instructionQueue.splice(cancelRequestIndex, 1);
        } else {
            // Send response.
            self.postMessage({
                type: 'FILTER_BAKE_RESULT',
                queueId: queueItem.queueId,
                layerId: queueItem.layerId,
                imageData: appliedImageData
            } as FilterBakeResult);
        }
    } catch (error) {
        // Send response.
        self.postMessage({
            type: 'FILTER_BAKE_ERROR',
            queueId: queueItem.queueId,
            layerId: queueItem.layerId,
            message: `${error}`
        } as FilterBakeError);
    }
}
