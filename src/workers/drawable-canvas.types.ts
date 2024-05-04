import type { DrawableDrawOptions } from '@/types';

export interface CreateCanvasRequest {
    type: 'CREATE_CANVAS';
    canvas1: OffscreenCanvas;
    canvas2: OffscreenCanvas;
    renderScale: number;
}

export interface SetCanvasRenderScaleRequest {
    type: 'SET_CANVAS_RENDER_SCALE',
    renderScale: number;
}

export interface AddDrawableRequest {
    type: 'ADD_DRAWABLE';
    uuid: string;
    name: string;
    data: any;
}

export interface RemoveDrawableRequest {
    type: 'REMOVE_DRAWABLE';
    uuid: string;
}

export interface DrawCanvasRequest {
    type: 'DRAW_CANVAS',
    options: DrawableDrawOptions,
}

export interface DrawCompleteAcknowledgedRequest {
    type: 'DRAW_COMPLETE_ACKNOWLEDGED'
}

export interface TerminateRequest {
    type: 'TERMINATE';
}

export type DrawQueueRequest = CreateCanvasRequest | SetCanvasRenderScaleRequest | AddDrawableRequest | RemoveDrawableRequest | DrawCanvasRequest | TerminateRequest | DrawCompleteAcknowledgedRequest;

export interface InitializedResult {
    type: 'INITIALIZED'
}

export interface DrawCompleteResult {
    type: 'DRAW_COMPLETE_RESULT';
    buffer: number;
    sourceX: number;
    sourceY: number;
}

export type DrawQueueResult = InitializedResult | DrawCompleteResult;

