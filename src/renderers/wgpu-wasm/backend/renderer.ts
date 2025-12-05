import initWasmModule, { initialize } from './build/renderer_wgpu_wasm';

import type {
    RendererBrushStrokeSettings, RendererBrushStrokePreviewsettings, RendererTextureTile,
    Webgl2RendererCanvasFilter, Webgl2RendererMeshController, WorkingFileLayer,
    WorkingFileGroupLayer, WorkingFileLayerFilter, WorkingFileLayerMask,
    RendererFrontendTakeSnapshotCropOptions, ClassType,
} from '@/types';

export type MeshControllerInterface = any & { dispose: () => void };

export interface WgpuWasmRendererApplySelectionMaskToAlphaChannelOptions {
    invert?: boolean;
}

export interface WgpuWasmRendererBackendTakeSnapshotOptions {
    cameraTransform?: Float64Array;
    layerIds?: Uint32Array;
    filters?: WorkingFileLayerFilter[];
    applySelectionMask?: boolean;
    disableScaleToSize?: boolean;
}

export interface WgpuWasmRendererBackendPublic {
    isOffscreen: boolean;
    onRequestFrontendSvg?: (request: { sourceUuid: string, width: number, height: number }) => void;
    onRequestFrontendTexture?: (sourceUuid: string) => void;
    initialize(canvas: HTMLCanvasElement | OffscreenCanvas, imageWidth: number, imageHeight: number, viewWidth: number, viewHeight: number): Promise<void>;
    resize(imageWidth: number, imageHeight: number, viewWidth: number, viewHeight: number): Promise<void>;
    enableImageBoundaryMask(enabled: boolean): Promise<void>;
    setBackgroundColor(r: number, g: number, b: number, alpha: number): Promise<void>;
    setMasks(masks: Record<number, WorkingFileLayerMask>): Promise<void>;
    setSelectionMask(image?: ImageBitmap, offset?: { x: number, y: number }): Promise<void>;
    setViewTransform(transform: Float64Array): Promise<void>;
    setLayerOrder(layerOrder: WorkingFileLayer[]): Promise<void>;
    queueCreateLayerPasses(): Promise<void>;
    applySelectionMaskToAlphaChannel(layerId: number, options?: WgpuWasmRendererApplySelectionMaskToAlphaChannelOptions): Promise<RendererTextureTile[]>;
    takeSnapshot(imageWidth: number, imageHeight: number, options?: WgpuWasmRendererBackendTakeSnapshotOptions): Promise<ImageBitmap>;
    startBrushStroke(settings: RendererBrushStrokeSettings): Promise<void>;
    moveBrushStroke(layerId: number, x: number, y: number, size: number, density: number, colorBlendingStrength: number, concentration: number): Promise<void>;
    stopBrushStroke(layerId: number): Promise<RendererTextureTile[]>;
    createBrushPreview(settings: RendererBrushStrokePreviewsettings): Promise<ImageBitmap>;
    createMeshController(type: string): Promise<MeshControllerInterface>;
    setDirty(): Promise<void>;
    dispose(): Promise<void>;
}

export class WgpuWasmRendererBackend implements WgpuWasmRendererBackendPublic {
    isOffscreen = false;
    dirty = false;
    async initialize(canvas: HTMLCanvasElement | OffscreenCanvas, imageWidth: number, imageHeight: number, viewWidth: number, viewHeight: number) {
        try {
            await initWasmModule();
            const result = await initialize(canvas, imageWidth, imageHeight, viewWidth, viewHeight);
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
    async resize(imageWidth: number, imageHeight: number, viewWidth: number, viewHeight: number) {

    }
    async enableImageBoundaryMask(enabled: boolean) {

    }
    async setBackgroundColor(r: number, g: number, b: number, alpha: number) {

    }
    async setMasks(masks: Record<number, WorkingFileLayerMask>) {

    }
    async setSelectionMask(image?: ImageBitmap, offset?: { x: number, y: number }) {

    }
    async setViewTransform(transform: Float64Array) {

    }
    async setLayerOrder(layerOrder: WorkingFileLayer[]) {

    }
    async queueCreateLayerPasses() {

    }
    async applySelectionMaskToAlphaChannel(layerId: number, options?: WgpuWasmRendererApplySelectionMaskToAlphaChannelOptions): Promise<RendererTextureTile[]> {
        return [];
    }
    async takeSnapshot(imageWidth: number, imageHeight: number, options?: WgpuWasmRendererBackendTakeSnapshotOptions): Promise<ImageBitmap> {
        return new ImageBitmap();
    }
    async startBrushStroke(settings: RendererBrushStrokeSettings) {

    }
    async moveBrushStroke(layerId: number, x: number, y: number, size: number, density: number, colorBlendingStrength: number, concentration: number) {

    }
    async stopBrushStroke(layerId: number): Promise<RendererTextureTile[]> {
        return [];
    }
    async createBrushPreview(settings: RendererBrushStrokePreviewsettings): Promise<ImageBitmap> {
        return new ImageBitmap();
    }
    async createMeshController(type: string): Promise<MeshControllerInterface> {
        return {
            dispose() {}
        };
    };
    async setDirty() {

    }
    async dispose() {
        
    }
}

let rendererBackendInstance: WgpuWasmRendererBackend | undefined;

export function getWgpuWasmRendererBackend(): WgpuWasmRendererBackend {
    if (!rendererBackendInstance) {
        rendererBackendInstance = new WgpuWasmRendererBackend();
    }
    return rendererBackendInstance;
}

export function disposeWgpuWasmRendererBackend() {
    if (rendererBackendInstance) {
        rendererBackendInstance.dispose();
    }
    rendererBackendInstance = undefined;
}
