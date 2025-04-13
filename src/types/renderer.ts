import type { Scene } from 'three';
import type { WorkingFileLayer, WorkingFileLayerFilter, Webgl2RendererCanvasFilter } from '@/types';

export interface RendererFrontendTakeSnapshotOptions {
    cameraTransform?: DOMMatrix;
    layerIds?: number[];
    filters?: WorkingFileLayerFilter[];
}

export interface RendererFrontend {
    initialize(canvas: HTMLCanvasElement | OffscreenCanvas): Promise<void>;
    resize(imageWidth: number, imageHeight: number, viewWidth: number, viewHeight: number): Promise<void>;
    takeSnapshot(imageWidth: number, imageHeight: number, options?: RendererFrontendTakeSnapshotOptions): Promise<ImageBitmap>;
    dispose(): Promise<void>;
}

export interface RendererLayerWatcher<T = WorkingFileLayer> {
    attach(layer: T): Promise<void>;
    reorder(order: number): Promise<void>;
    detach(): Promise<void>;
}

export interface RendererMeshController {
    swapScene(scene: Scene): void;
    overrideFilters(filters?: Webgl2RendererCanvasFilter[]): Promise<void>;
    overrideVisibility(visible?: boolean): void;
}
