import { v4 as uuidv4 } from 'uuid';
import type {
    CreateCanvasRequest, AddDrawableRequest, RemoveDrawableRequest, DrawCanvasRequest,
    TerminateRequest, DrawQueueResult, SetCanvasRenderScaleRequest, SetCanvasGlobalAlphaRequest, DrawCompleteAcknowledgedRequest
} from './drawable-canvas.types';
import type { DrawableDrawOptions } from '@/types';
import { getCanvasRenderingContext2DSettings } from '@/store/working-file';

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
    updateInfo: Record<string, any>;
}

interface CreateDrawableCanvasOptions {
    renderScale?: number;
    onDrawn: (event: DrawnCallbackEvent) => void;
}

const canvasWorkerMap = new Map<string, CanvasWorkerInfo>();

export async function createDrawableCanvas(options: CreateDrawableCanvasOptions): Promise<string> {
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

    let initializeResolve!: (uuid: string) => void;
    let initializeReject!: () => void;
    const initializedPromise = new Promise<string>((resolve, reject) => {
        initializeResolve = resolve;
        initializeReject = reject;
    });

    // Cache canvas callback instances to avoid garbage collection jank.
    const drawCompleteCanvases: HTMLCanvasElement[] = [
        document.createElement('canvas'),
        document.createElement('canvas'),
        document.createElement('canvas'),
        document.createElement('canvas'),
        document.createElement('canvas'),
        document.createElement('canvas'),
    ];
    let drawCompleteCanvasIndex = 0;

    worker.onmessage = ({ data }: { data: DrawQueueResult }) => {
        const workerInfo = canvasWorkerMap.get(uuid);
        if (!workerInfo) return;
        if (data.type === 'DRAW_COMPLETE_RESULT') {
            const { bitmap, sourceX, sourceY, updateInfo } = data;
            const canvas = drawCompleteCanvases[drawCompleteCanvasIndex++];
            if (drawCompleteCanvasIndex >= drawCompleteCanvases.length) {
                drawCompleteCanvasIndex = 0;
            }
            if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
            }
            const ctx = canvas.getContext('bitmaprenderer');
            if (!ctx) return;
            ctx.transferFromImageBitmap(bitmap);
            // TODO - maybe keep bitmap references and delay closing until there's a pause
            // in draw calls, in order to avoid garbage collection jank.
            bitmap.close();
            onDrawn({
                canvas,
                sourceX,
                sourceY,
                updateInfo,
            });
        } else if (data.type === 'INITIALIZED') {
            initializeResolve(uuid);
        } else if (data.type === 'LOG') {
            console['log'](data.value);
        }
    };
    worker.onmessageerror = (error) => {
        console.error('[src/workers/drawable-canvas.interface.ts] Error received from drawableCanvasWorker', error);
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

    return initializedPromise;
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

export function setDrawableCanvasGlobalAlpha(workerUuid: string, newGlobalAlpha: number) {
    const workerInfo = canvasWorkerMap.get(workerUuid);
    if (!workerInfo) return;
    const { worker } = workerInfo;
    worker.postMessage({
        type: 'SET_CANVAS_GLOBAL_ALPHA',
        globalAlpha: newGlobalAlpha,
    } as SetCanvasGlobalAlphaRequest);
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

export async function renderDrawableCanvas(uuid: string, options: DrawableDrawOptions) {
    const workerInfo = canvasWorkerMap.get(uuid);
    if (!workerInfo) return;
    const { worker } = workerInfo;
    if (options.destinationCanvas) {
        options.destinationCanvas = await createImageBitmap(
            options.destinationCanvas
        );
    };
    worker.postMessage({
        type: 'DRAW_CANVAS',
        options,
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
