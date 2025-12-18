import { getWgpuWasmRendererBackend } from './renderer';

export function markRenderDirty() {
    getWgpuWasmRendererBackend().dirty = true;
}

export * from './image-transfer';
export * from './message-bus';
export * from './renderer';