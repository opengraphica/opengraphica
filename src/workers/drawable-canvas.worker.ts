import drawableClassMap from '@/canvas/drawables';

import type { Drawable, DrawableRenderMode } from '@/types';
import type {
    CreateCanvasRequest, AddDrawableRequest, RemoveDrawableRequest, DrawCanvasRequest, DrawQueueRequest, DrawCompleteResult,
} from './drawable-canvas.types';

interface DrawableInfo {
    drawable: Drawable;
}

let renderMode: DrawableRenderMode = '2d'; // TODO - webgl
let canvas: OffscreenCanvas;
let canvas2dCtx: OffscreenCanvasRenderingContext2D;
const drawableMap = new Map<string, DrawableInfo>();

self.onmessage = ({ data }: { data: DrawQueueRequest }) => {
    if (data.type === 'CREATE_CANVAS') {
        createCanvas(data);
    } else if (data.type === 'ADD_DRAWABLE') {
        addDrawable(data);
    } else if (data.type === 'REMOVE_DRAWABLE') {
        removeDrawable(data);
    } else if (data.type === 'DRAW_CANVAS') {
        drawCanvas(data);
    } else if (data.type === 'TERMINATE') {
        cleanup();
        self.close();
    }
};

function createCanvas(request: CreateCanvasRequest) {
    canvas = request.canvas;
    if (renderMode === '2d') {
        canvas2dCtx = canvas.getContext('2d')!;
    }
}

function addDrawable(request: AddDrawableRequest) {
    const { uuid, name, data } = request;
    const DrawableClass = drawableClassMap[name];
    drawableMap.set(uuid, {
        drawable: new DrawableClass({
            renderMode,
            scene: {} as any,
            data,
        }),
    });
}

function removeDrawable(request: RemoveDrawableRequest) {
    const drawableInfo = drawableMap.get(request.uuid);
    if (!drawableInfo) return;
    drawableInfo.drawable.dispose();
    drawableMap.delete(request.uuid);
}

function drawCanvas(request: DrawCanvasRequest) {
    for (const drawableUpdate of request.drawableUpdates) {
        const drawableInfo = drawableMap.get(drawableUpdate.uuid);
        drawableInfo?.drawable.update(drawableUpdate.data);
    }

    if (renderMode === '2d') {
        draw2d();
    }

    self.postMessage({
        type: 'DRAW_COMPLETE_RESULT',
    } as DrawCompleteResult);
}

function draw2d() {
    canvas2dCtx.clearRect(0, 0, canvas.width, canvas.height);
    for (const [key, value] of drawableMap.entries()) {
        value.drawable.draw2d(canvas2dCtx);
    }
}

function cleanup() {
    for (const [key, value] of drawableMap.entries()) {
        value.drawable.dispose();
    }
    drawableMap.clear();
}
