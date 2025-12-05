import { nextTick, toRefs, watch, type WatchStopHandle } from 'vue';

import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import workingFileStore, { getLayerById, regenerateLayerThumbnail } from '@/store/working-file';

import type { WgpuWasmRendererBackend, WgpuWasmRendererBackendPublic } from '@/renderers/wgpu-wasm/backend';
import type {
    RGBAColor,
    ClassType, RendererFrontend, RendererFrontendTakeSnapshotOptions,
    RendererBrushStrokeSettings, RendererBrushStrokePreviewsettings,
    RendererFrontendApplySelectionMaskToAlphaChannelOptions,
    RendererLayerWatcher, RendererTextureTile, WorkingFileAnyLayer
} from '@/types';

export class WgpuWasmRendererFrontend implements RendererFrontend {
    rendererBackend: WgpuWasmRendererBackendPublic;

    constructor(backend: WgpuWasmRendererBackendPublic) {
        this.rendererBackend = backend;
    }

    async initialize(canvas: HTMLCanvasElement | OffscreenCanvas) {

        const { viewWidth, viewHeight } = toRefs(canvasStore.state);
        const { width: imageWidth, height: imageHeight } = toRefs(workingFileStore.state);

        await this.rendererBackend.initialize(canvas, imageWidth.value, imageHeight.value, viewWidth.value, viewHeight.value);
    }

    async resize(imageWidth: number, imageHeight: number, viewWidth: number, viewHeight: number) {

    }

    async applySelectionMaskToAlphaChannel(layerId: number, options?: RendererFrontendApplySelectionMaskToAlphaChannelOptions): Promise<RendererTextureTile[]> {
        return [];
    }

    async takeSnapshot(imageWidth: number, imageHeight: number, options?: RendererFrontendTakeSnapshotOptions): Promise<ImageBitmap> {
        return new ImageBitmap();
    }

    async pickColor(canvasX: number, canvasY: number): Promise<RGBAColor> {
        return {} as RGBAColor;
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

    async dispose() {

    }
}