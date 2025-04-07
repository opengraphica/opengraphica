import type { Scene } from 'three';
import type { WorkingFileLayer } from '@/types';

export interface RendererFrontend {
    initialize(canvas: HTMLCanvasElement | OffscreenCanvas): Promise<void>;
    resize(imageWidth: number, imageHeight: number, viewWidth: number, viewHeight: number): Promise<void>;
    dispose(): Promise<void>;
}

export interface RendererLayerWatcher<T = WorkingFileLayer> {
    attach(layer: T): Promise<void>;
    reorder(order: number): Promise<void>;
    detach(): Promise<void>;
}

export interface RendererMeshController {
    swapScene(scene: Scene): void;
}
