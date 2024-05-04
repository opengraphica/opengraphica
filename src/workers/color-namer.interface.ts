import { v4 as uuidv4 } from 'uuid';

import type { ColorNameRequest, ColorNameResponse } from './color-namer.types';

interface WorkerInfoColorNameRequest {
    uuid: string;
    resolve: (name: string) => void;
}

interface WorkerInfo {
    worker: Worker;
    requestQueue: WorkerInfoColorNameRequest[];
}

const workerMap = new Map<string, WorkerInfo>();

export function createColorNamer(): string {
    const uuid = uuidv4();

    const worker = new Worker(
        /* webpackChunkName: 'worker-color-namer' */ new URL('./color-namer.worker.ts', import.meta.url)
    );

    worker.onmessage = ({ data }) => {
        if (data.type === 'COLOR_NAME_RESULT') {
            const { uuid: requestUuid, name } = data as ColorNameResponse;
            const workerInfo = workerMap.get(uuid);
            if (!workerInfo) return;
            const { requestQueue } = workerInfo;
            const queueItemIndex = requestQueue.findIndex(item => item.uuid === requestUuid);
            if (queueItemIndex === -1) return;
            const [queueItem] = requestQueue.splice(queueItemIndex, 1);
            queueItem.resolve(name);
        }
    }

    worker.onmessageerror = (error) => {
        console.error('[src/workers/color-name.interface.ts] Error received from colorNamerWorker', error);
    };

    workerMap.set(uuid, {
        worker,
        requestQueue: [],
    });

    return uuid;
}

export function getColorName(uuid: string, hexColor: string): Promise<string> {
    const workerInfo = workerMap.get(uuid);
    if (!workerInfo) return Promise.resolve('');
    const queueUuid = uuidv4();
    let promiseResolve!: (name: string) => void;
    const promise = new Promise<string>((resolve) => {
        promiseResolve = resolve;
    });
    workerInfo.requestQueue.push({ uuid: queueUuid, resolve: promiseResolve });
    workerInfo.worker.postMessage({
        type: 'COLOR_NAME',
        uuid: queueUuid,
        hexColor,
    } as ColorNameRequest);
    return promise;
}

export function destroyColorNamer(uuid: string) {
    const workerInfo = workerMap.get(uuid);
    if (!workerInfo) return;
    for (const request of workerInfo.requestQueue) {
        request.resolve('');
    }
    workerInfo.worker.terminate();
    workerMap.delete(uuid);
}
