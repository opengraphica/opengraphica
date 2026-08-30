import wasmLoadModule, {
    initialize as wasmInitializeRenderer,
    render as wasmRender,
    resize as wasmResize,
    enable_image_boundary_mask as wasmEnableImageBoundaryMask,
    set_background_color as wasmSetBackgroundColor,
    set_view_transform as wasmSetViewTransform,
    set_layer_order as wasmSetLayerOrder,
    take_snapshot as wasmTakeSnapshot,
    create_brush_preview as wasmCreateBrushPreview,
    add_mesh_controller as wasmAddMeshController,
    update_mesh_controller_name as wasmUpdateMeshControllerName,
    update_mesh_controller_size as wasmUpdateMeshControllerSize,
    update_mesh_controller_transform as wasmUpdateMeshControllerTransform,
    update_mesh_controller_visible as wasmUpdateMeshControllerVisible,
    update_mesh_controller_source_image_data as wasmUpdateMeshControllerSourceImageData,
    reorder_mesh_controller as wasmReorderMeshController,
    remove_mesh_controller as wasmRemoveMeshController,
} from './build/renderer_wgpu_wasm';

import { messageBus } from './message-bus';

import type {
    RendererBrushStrokeSettings, RendererBrushStrokePreviewSettings, RendererTextureTile,
    Webgl2RendererCanvasFilter, WgpuWasmRendererMeshController, WorkingFileLayer,
    WorkingFileGroupLayer, WorkingFileLayerFilter, WorkingFileLayerMask,
    RendererFrontendTakeSnapshotCropOptions, ClassType,
    WasmImageData, WasmRendererMeshControllerType,
} from '@/types';

export type MeshControllerInterface = any & { dispose: () => void };

export interface WgpuWasmRendererApplySelectionMaskToAlphaChannelOptions {
    invert?: boolean;
}

export interface WgpuWasmRendererBackendTakeSnapshotOptions {
    cameraTransform?: Float32Array;
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
    setViewTransform(transform: Float32Array): Promise<void>;
    setLayerOrder(layerOrder: WorkingFileLayer[]): Promise<void>;
    queueCreateLayerPasses(): Promise<void>;
    applySelectionMaskToAlphaChannel(layerId: number, options?: WgpuWasmRendererApplySelectionMaskToAlphaChannelOptions): Promise<RendererTextureTile[]>;
    takeSnapshot(imageWidth: number, imageHeight: number, options?: WgpuWasmRendererBackendTakeSnapshotOptions): Promise<ImageBitmap>;
    startBrushStroke(settings: RendererBrushStrokeSettings): Promise<void>;
    moveBrushStroke(layerId: number, x: number, y: number, size: number, density: number, colorBlendingStrength: number, concentration: number): Promise<void>;
    stopBrushStroke(layerId: number): Promise<RendererTextureTile[]>;
    createBrushPreview(settings: RendererBrushStrokePreviewSettings): Promise<ImageBitmap>;
    createMeshController(type: string): Promise<MeshControllerInterface>;
    setDirty(): Promise<void>;
    dispose(): Promise<void>;
}

export class WgpuWasmRendererBackend implements WgpuWasmRendererBackendPublic {
    isOffscreen = false;
    dirty = false;
    rendererBusy: boolean = false; // Renderer is being used for other operations and shouldn't be used to draw right now

    beforeRenderCallbacks: Array<(timelineCursor: number) => void> = [];

    meshControllersByType: Record<string, ClassType<WgpuWasmRendererMeshController>> = {};

    async initialize(canvas: HTMLCanvasElement | OffscreenCanvas, imageWidth: number, imageHeight: number, viewWidth: number, viewHeight: number) {
        try {
            await wasmLoadModule();

            if (!this.isOffscreen) {
                this.meshControllersByType = {
                    // gradient: (await import('@/renderers/webgl2/layers/gradient/mesh-controller')).GradientLayerMeshController,
                    raster: (await import('@/renderers/wgpu-wasm/layers/raster/mesh-controller')).RasterLayerMeshController,
                    // rasterSequence: (await import('@/renderers/webgl2/layers/raster-sequence/mesh-controller')).RasterSequenceLayerMeshController,
                    // text: (await import('@/renderers/webgl2/layers/text/mesh-controller')).TextLayerMeshController,
                    // vector: (await import('@/renderers/webgl2/layers/vector/mesh-controller')).VectorLayerMeshController,
                    // video: (await import('@/renderers/webgl2/layers/video/mesh-controller')).VideoLayerMeshController,
                };
            }

            await wasmInitializeRenderer(canvas, imageWidth, imageHeight, viewWidth, viewHeight);
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
    async resize(imageWidth: number, imageHeight: number, viewWidth: number, viewHeight: number) {
        wasmResize(imageWidth, imageHeight, viewWidth, viewHeight);
        this.dirty = true;
    }
    async enableImageBoundaryMask(enabled: boolean) {
        wasmEnableImageBoundaryMask(enabled);
    }
    async setBackgroundColor(r: number, g: number, b: number, alpha: number) {
        wasmSetBackgroundColor(r, g, b, alpha);
    }
    async setMasks(masks: Record<number, WorkingFileLayerMask>) {

    }
    async setSelectionMask(image?: ImageBitmap, offset?: { x: number, y: number }) {

    }
    async setViewTransform(transform: Float32Array) {
        wasmSetViewTransform(transform);
        this.dirty = true;
    }
    async setLayerOrder(layerOrder: WorkingFileLayer[]) {
        wasmSetLayerOrder();
    }
    async queueCreateLayerPasses() {

    }
    async applySelectionMaskToAlphaChannel(layerId: number, options?: WgpuWasmRendererApplySelectionMaskToAlphaChannelOptions): Promise<RendererTextureTile[]> {
        return [];
    }
    async takeSnapshot(imageWidth: number, imageHeight: number, options?: WgpuWasmRendererBackendTakeSnapshotOptions): Promise<ImageBitmap> {
        let dirtyInterval = setInterval(() => {
            this.dirty = true;
        }, 16);
        let wasmImageData: WasmImageData = await wasmTakeSnapshot(
            imageWidth,
            imageHeight,
            options?.cameraTransform,
            options?.layerIds,
            options?.filters,
            options?.applySelectionMask,
            options?.disableScaleToSize,
        );
        clearInterval(dirtyInterval);
        return createImageBitmap(new ImageData(
            new Uint8ClampedArray(wasmImageData.buffer),
            wasmImageData.width,
            wasmImageData.height,
        ));
    }
    async startBrushStroke(settings: RendererBrushStrokeSettings) {

    }
    async moveBrushStroke(layerId: number, x: number, y: number, size: number, density: number, colorBlendingStrength: number, concentration: number) {

    }
    async stopBrushStroke(layerId: number): Promise<RendererTextureTile[]> {
        return [];
    }
    async createBrushPreview(settings: RendererBrushStrokePreviewSettings): Promise<ImageBitmap> {
        let dirtyInterval = setInterval(() => {
            this.dirty = true;
        }, 16);
        let wasmImageData: WasmImageData = await wasmCreateBrushPreview(
            new Float32Array([settings.color[0], settings.color[1], settings.color[2], settings.color[3]]),
            settings.size,
            settings.hardness,
            settings.colorBlendingPersistence,
            settings.colorBlendingStrength,
            settings.pressureMinColorBlendingStrength,
            settings.density,
            settings.pressureMinDensity,
            settings.concentration,
            settings.pressureMinConcentration,
            settings.pressureMinSize,
            settings.jitter,
            settings.spacing,
            settings.pressureTaper,
        );
        clearInterval(dirtyInterval);
        return createImageBitmap(new ImageData(
            new Uint8ClampedArray(wasmImageData.buffer),
            wasmImageData.width,
            wasmImageData.height,
        ));
    }
    async createMeshController(type: string): Promise<MeshControllerInterface> {
        return new this.meshControllersByType[type]();
    };
    async setDirty() {

    }
    async dispose() {
        
    }

    render(timelineCursor: number) {
        if (this.rendererBusy) return;

        for (const callback of this.beforeRenderCallbacks) {
            callback(timelineCursor);
        }

        wasmRender();

        this.dirty = false;
        messageBus.emit('renderer.renderComplete');
    }

    async addMeshController(id: number, type: WasmRendererMeshControllerType) {
        wasmAddMeshController(id, type);
    }

    async updateMeshControllerName(id: number, name: string) {
        wasmUpdateMeshControllerName(id, name);
    }

    async updateMeshControllerSize(id: number, width: number, height: number) {
        wasmUpdateMeshControllerSize(id, width, height);
    }

    async updateMeshControllerTransform(id: number, transform: Float32Array) {
        wasmUpdateMeshControllerTransform(id, transform);
    }

    async updateMeshControllerVisible(id: number, visible: boolean) {
        wasmUpdateMeshControllerVisible(id, visible);
    }

    async updateMeshControllerSourceImageData(id: number, sourceImageData: WasmImageData) {
        wasmUpdateMeshControllerSourceImageData(
            id,
            sourceImageData.width,
            sourceImageData.height,
            sourceImageData.format,
            sourceImageData.buffer,
        );
    }

    async reorderMeshController(id: number, order: number) {
        wasmReorderMeshController(id, order);
    }

    async removeMeshController(id: number) {
        wasmRemoveMeshController(id);
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
