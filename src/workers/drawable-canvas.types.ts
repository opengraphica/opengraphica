import type { DrawableUpdate } from '@/types';

export interface CreateCanvasRequest {
    type: 'CREATE_CANVAS';
    canvas: OffscreenCanvas;
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
    drawableUpdates: DrawableUpdate[],
}

export interface TerminateRequest {
    type: 'TERMINATE';
}

export type DrawQueueRequest = CreateCanvasRequest | AddDrawableRequest | RemoveDrawableRequest | DrawCanvasRequest | TerminateRequest;

export interface DrawCompleteResult {
    type: 'DRAW_COMPLETE_RESULT';
}

export type DrawQueueResult = DrawCompleteResult;

