export interface TextureCompositeQueueItem {
    type: 'COMPOSITE_TEXTURE';
    queueId: number;
    resolvePromise: (bitmap: ImageBitmap) => void;
    rejectPromise: (reason?: any) => void;
}

export interface TextureCompositeResult {
    type: 'TEXTURE_COMPOSITE_RESULT';
    queueId: number;
    bitmap: ImageBitmap | null;
}

export interface TextureCompositeRequest {
    type: 'NEW_TEXTURE_COMPOSITE';
    queueId: number;
    baseBitmap: ImageBitmap;
    overlayBitmap: ImageBitmap;
    overlayOffsetX: number;
    overlayOffsetY: number;
    blendMode: string;
}

export interface PrepareThreejsTextureRequest {
    type: 'NEW_PREPARE_THREEJS_TEXTURE';
    queueId: number;
    bitmap: ImageBitmap;
}

export interface TerminateRequest {
    type: 'TERMINATE';
}
