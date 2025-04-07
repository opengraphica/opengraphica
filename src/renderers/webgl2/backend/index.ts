import { getWebgl2RendererBackend } from './renderer';

export function markRenderDirty() {
    getWebgl2RendererBackend().dirty = true;
}

export * from './image-transfer';
export * from './message-bus';
export * from './renderer';
