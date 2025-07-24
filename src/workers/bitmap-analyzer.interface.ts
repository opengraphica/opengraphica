import { v4 as uuidv4 } from 'uuid';

import type { FindContrastLinesRequest, FindContrastLinesResponse } from './bitmap-analyzer.types';

interface WorkerInfoBitmapAnalyzeRequest {
    uuid: string;
    resolve: (result: any) => void;
}

interface WorkerInfo {
    worker: Worker;
    requestQueue: WorkerInfoBitmapAnalyzeRequest[];
}

const workerMap = new Map<string, WorkerInfo>();

export function createBitmapAnalyzer(): string {
    const uuid = uuidv4();

    const worker = new Worker(
        /* webpackChunkName: 'worker-bitmap-analyzer' */ new URL('./bitmap-analyzer.worker.ts', import.meta.url)
    );

    worker.onmessage = ({ data }) => {
        if (data.type === 'CONTRAST_LINES_RESULT') {
            const { uuid: requestUuid, verticalLines, horizontalLines } = data as FindContrastLinesResponse;
            const workerInfo = workerMap.get(uuid);
            if (!workerInfo) return;
            const { requestQueue } = workerInfo;
            const queueItemIndex = requestQueue.findIndex(item => item.uuid === requestUuid);
            if (queueItemIndex === -1) return;
            const [queueItem] = requestQueue.splice(queueItemIndex, 1);
            queueItem.resolve({ verticalLines, horizontalLines });
        }
    }

    worker.onmessageerror = (error) => {
        console.error('[src/workers/bitmap-analyzer.interface.ts] Error received from bitmapAnalyzerWorker', error);
    };

    workerMap.set(uuid, {
        worker,
        requestQueue: [],
    });

    return uuid;
}

export function getBitmapContrastLines(uuid: string, bitmap: ImageBitmap): Promise<{ verticalLines: number[], horizontalLines: number[] }> {
    const workerInfo = workerMap.get(uuid);
    if (!workerInfo) return Promise.resolve({ verticalLines: [], horizontalLines: [] });
    const queueUuid = uuidv4();
    let promiseResolve!: (lines: { verticalLines: number[], horizontalLines: number[] }) => void;
    const promise = new Promise<{ verticalLines: number[], horizontalLines: number[] }>((resolve) => {
        promiseResolve = resolve;
    });
    workerInfo.requestQueue.push({ uuid: queueUuid, resolve: promiseResolve });
    workerInfo.worker.postMessage({
        type: 'CONTRAST_LINES',
        uuid: queueUuid,
        bitmap,
    } as FindContrastLinesRequest, [bitmap]);
    return promise;
}

export function destroyBitmapAnalyzer(uuid: string) {
    const workerInfo = workerMap.get(uuid);
    if (!workerInfo) return;
    for (const request of workerInfo.requestQueue) {
        request.resolve(undefined);
    }
    workerInfo.worker.terminate();
    workerMap.delete(uuid);
}
