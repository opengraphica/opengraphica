import { getWgpuWasmRendererBackend } from './renderer';

export function markRenderDirty() {
    getWgpuWasmRendererBackend().dirty = true;
}

export * from './renderer';