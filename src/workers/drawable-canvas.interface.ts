import { v4 as uuidv4 } from 'uuid';
import type {
    CreateCanvasRequest, AddDrawableRequest, RemoveDrawableRequest, DrawCanvasRequest,
    TerminateRequest, DrawQueueResult, SetCanvasRenderScaleRequest, DrawCompleteAcknowledgedRequest
} from './drawable-canvas.types';
import type { DrawableUpdate } from '@/types';

interface CanvasWorkerInfo {
    worker: Worker;
    onscreenBuffer1: HTMLCanvasElement;
    onscreenBuffer2: HTMLCanvasElement;
    offscreenCanvas1: OffscreenCanvas;
    offscreenCanvas2: OffscreenCanvas;
}

interface DrawnCallbackEvent {
    canvas: HTMLCanvasElement;
    sourceX: number;
    sourceY: number;
}

interface CreateDrawableCanvasOptions {
    renderScale?: number;
    onDrawn: (event: DrawnCallbackEvent) => void;
}

const canvasWorkerMap = new Map<string, CanvasWorkerInfo>();

export function createDrawableCanvas(options: CreateDrawableCanvasOptions): string {
    const { renderScale, onDrawn } = options;
    const uuid = uuidv4();

    const worker = new Worker(
        /* webpackChunkName: 'worker-drawable-canvas' */ new URL('./drawable-canvas.worker.ts', import.meta.url)
    );
    const onscreenBuffer1: HTMLCanvasElement = document.createElement('canvas');
    onscreenBuffer1.width = 64;
    onscreenBuffer1.height = 64;
    const onscreenBuffer2: HTMLCanvasElement = document.createElement('canvas');
    onscreenBuffer2.width = 64;
    onscreenBuffer2.height = 64;
    const offscreenCanvas1 = onscreenBuffer1.transferControlToOffscreen();
    const offscreenCanvas2 = onscreenBuffer2.transferControlToOffscreen();

    worker.onmessage = ({ data }: { data: DrawQueueResult }) => {
        const workerInfo = canvasWorkerMap.get(uuid);
        if (!workerInfo) return;
        if (data.type === 'DRAW_COMPLETE_RESULT') {
            const { buffer, sourceX, sourceY } = data;
            const canvas = buffer === 1 ? onscreenBuffer1 : onscreenBuffer2;
            onDrawn({
                canvas,
                sourceX,
                sourceY,
            });
        } else if (data.type === 'LOG') {
            console.log((data as any).message);
        }
    };
    worker.onmessageerror = (error) => {
        console.error('Error received from drawableCanvasWorker', error);
    };

    canvasWorkerMap.set(uuid, {
        worker,
        onscreenBuffer1,
        onscreenBuffer2,
        offscreenCanvas1,
        offscreenCanvas2,
    });

    worker.postMessage({
        type: 'CREATE_CANVAS',
        canvas1: offscreenCanvas1,
        canvas2: offscreenCanvas2,
        renderScale: renderScale ?? 1,
    } as CreateCanvasRequest, [offscreenCanvas1, offscreenCanvas2]);

    return uuid;
}

export function setDrawableCanvasScale(workerUuid: string, newScale: number) {
    const workerInfo = canvasWorkerMap.get(workerUuid);
    if (!workerInfo) return;
    const { worker } = workerInfo;
    worker.postMessage({
        type: 'SET_CANVAS_RENDER_SCALE',
        renderScale: newScale,
    } as SetCanvasRenderScaleRequest);
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
