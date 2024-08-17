import type { WorkingFileLayerFilter } from '@/types';

export interface FilterBakeQueueItem {
    type: 'FILTER_BAKE';
    queueId: number;
    layerId: number;
    resolvePromise: (imageData: ImageData) => void;
    rejectPromise: (reason?: any) => void;
}

export interface FilterNewBakeRequest {
    type: 'NEW_FILTER_BAKE';
    queueId: number;
    layerId: number;
    imageData: ImageData;
    filterConfigurations: WorkingFileLayerFilter[];
}

export interface FilterCancelBakeRequest {
    type: 'CANCEL_FILTER_BAKE';
    queueId: number;
}

export interface FilterBakeResult {
    type: 'FILTER_BAKE_RESULT';
    queueId: number;
    layerId: number;
    imageData: ImageData;
}

export interface FilterBakeError {
    type: 'FILTER_BAKE_ERROR';
    queueId: number;
    layerId: number;
    message: string;
}

export interface LogResponse {
    type: 'LOG';
    message: string;
}
