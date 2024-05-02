import { v4 as uuidv4 } from 'uuid';
import type {
    CreateCanvasRequest, AddDrawableRequest, RemoveDrawableRequest, DrawCanvasRequest,
    TerminateRequest, DrawQueueResult
} from './drawable-canvas.types';
import type { DrawableUpdate } from '@/types';

interface CanvasWorkerInfo {
    worker: Worker;
    onscreenCanvas: HTMLCanvasElement;
    offscreenCanvas: OffscreenCanvas;
}

interface DrawnCallbackEvent {
    sourceX: number;
    sourceY: number;
}

interface CreateDrawableCanvasOptions {
    onscreenCanvas: HTMLCanvasElement;
    onDrawn: (event: DrawnCallbackEvent) => void;
}

const canvasWorkerMap = new Map<string, CanvasWorkerInfo>();

export function createDrawableCanvas(options: CreateDrawableCanvasOptions): string {
    const { onscreenCanvas, onDrawn } = options;
    const uuid = uuidv4();

    const worker = new Worker(
        /* webpackChunkName: 'worker-drawable-canvas' */ new URL('./drawable-canvas.worker.ts', import.meta.url)
    );
    const offscreenCanvas = onscreenCanvas.transferControlToOffscreen();

    worker.onmessage = ({ data }: { data: DrawQueueResult }) => {
        const workerInfo = canvasWorkerMap.get(uuid);
        if (!workerInfo) return;
        if (data.type === 'DRAW_COMPLETE_RESULT') {
            onDrawn({
                sourceX: 0, // TODO - calculate based on drawables
                sourceY: 0,
            });
        }
    };
    worker.onmessageerror = (error) => {
        console.error('Error received from drawableCanvasWorker', error);
    };

    canvasWorkerMap.set(uuid, {
        worker,
        onscreenCanvas,
        offscreenCanvas,
    });

    worker.postMessage({
        type: 'CREATE_CANVAS',
        canvas: offscreenCanvas,
    } as CreateCanvasRequest, [offscreenCanvas]);

    return uuid;
}

export function addDrawable(workerUuid: string, drawableUuid: string, name: string, data: any) {
    const workerInfo = canvasWorkerMap.get(workerUuid);
    if (!workerInfo) return;
    const { worker } = workerInfo;
    worker.postMessage({
        type: 'ADD_DRAWABLE',
        uuid: drawableUuid,
        name,
        data,
    } as AddDrawableRequest);
}

export function removeDrawable(workerUuid: string, drawableUuid: string) {
    const workerInfo = canvasWorkerMap.get(workerUuid);
    if (!workerInfo) return;
    const { worker } = workerInfo;
    worker.postMessage({
        type: 'REMOVE_DRAWABLE',
        uuid: drawableUuid,
    } as RemoveDrawableRequest);
}

export function renderDrawableCanvas(uuid: string, drawableUpdates: DrawableUpdate[]) {
    const workerInfo = canvasWorkerMap.get(uuid);
    if (!workerInfo) return;
    const { worker } = workerInfo;
    worker.postMessage({
        type: 'DRAW_CANVAS',
        drawableUpdates,
    } as DrawCanvasRequest);
}

export function destroyDrawableCanvas(uuid: string) {
    const workerInfo = canvasWorkerMap.get(uuid);
    if (!workerInfo) return;
    workerInfo.worker.postMessage({
        type: 'TERMINATE',
    } as TerminateRequest);
    canvasWorkerMap.delete(uuid);
}
