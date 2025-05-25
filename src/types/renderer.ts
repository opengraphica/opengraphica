import type { Matrix4, Scene, Texture } from 'three';
import type { WorkingFileLayer, WorkingFileLayerFilter, Webgl2RendererCanvasFilter } from '@/types';

export interface RendererFrontendTakeSnapshotCropOptions {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface RendererFrontendApplySelectionMaskToAlphaChannelOptions {
    /** Inverts the selection mask during application. */
    invert?: boolean;
}

export interface RendererFrontendTakeSnapshotOptions {
    /** Transform the camera to take a snapshot at a different angle. */
    cameraTransform?: DOMMatrix;
    /** Only take a snapshot of the layers with specified ids. */
    layerIds?: number[];
    /** Filters/effects to override the existing layer's filters. */
    filters?: WorkingFileLayerFilter[];
    /** Uses the current selection mask to erase portions of the snapshot's alpha channel. */
    applySelectionMask?: boolean;
    /** Inverts the selection mask during application. */
    invertSelectionMask?: boolean;
    /** Crops the final image, after all of the other transforms are applied. */
    crop?: RendererFrontendTakeSnapshotCropOptions;
}

export interface RendererTextureTile {
    x: number;
    y: number;
    width: number;
    height: number;
    oldImage?: ImageBitmap;
    image: ImageBitmap;
}

export interface RendererBrushStrokeSettings {
    layerId: number;
    size: number;
    color: Float16Array;
    hardness: number;
    colorBlendingPersistence: number;
}

export interface RendererFrontend {
    initialize(canvas: HTMLCanvasElement | OffscreenCanvas): Promise<void>;
    resize(imageWidth: number, imageHeight: number, viewWidth: number, viewHeight: number): Promise<void>;
    applySelectionMaskToAlphaChannel(layerId: number, options?: RendererFrontendApplySelectionMaskToAlphaChannelOptions): Promise<RendererTextureTile[]>;
    takeSnapshot(imageWidth: number, imageHeight: number, options?: RendererFrontendTakeSnapshotOptions): Promise<ImageBitmap>;
    startBrushStroke(settings: RendererBrushStrokeSettings): Promise<void>;
    moveBrushStroke(layerId: number, x: number, y: number, size: number, density: number, colorBlendingStrength: number, concentration: number): Promise<void>;
    stopBrushStroke(layerId: number): Promise<void>;
    dispose(): Promise<void>;
}

export interface RendererLayerWatcher<T = WorkingFileLayer> {
    attach(layer: T): Promise<void>;
    reorder(order: number): Promise<void>;
    detach(): Promise<void>;
}

export interface Webgl2RendererMeshController {
    getTexture(wait?: boolean): Promise<Texture | null>;
    getTransform(): Matrix4;
    swapScene(scene: Scene): void;
    overrideFilters(filters?: Webgl2RendererCanvasFilter[]): Promise<void>;
    overrideVisibility(visible?: boolean): void;
}
