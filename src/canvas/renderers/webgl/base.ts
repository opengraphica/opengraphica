import { shallowReadonly, watch, type WatchStopHandle } from 'vue';
import { DrawWorkingFileLayerOptions, WorkingFileLayer, WorkingFileLayerRenderer, WorkingFileGroupLayer, ColorModel } from '@/types';
import type { Camera, Scene, WebGLRenderer } from 'three';

export default class BaseLayerRenderer implements WorkingFileLayerRenderer<ColorModel> {
    threejsScene: Scene | undefined;
    isAttached: boolean = false;
    order: number = 0;

    reorder(order: number) {
        this.order = order;
        this.onReorder(order);
    }
    onReorder(order: number) {
        // Override
    }

    attach(layer: WorkingFileLayer<ColorModel>) {
        if (!this.isAttached) {
            try {
                this.onAttach(layer);
            } catch (error) {
                console.error(error);
            }
            this.isAttached = true;
        }
    }
    onAttach(layer: WorkingFileLayer<ColorModel>) {
        // Override
    }

    detach() {
        if (this.isAttached) {
            try {
                this.onDetach();
            } catch (error) {
                console.error(error);
            }
            this.isAttached = false;
        }
    }
    onDetach() {
        // Override
    }

    update(updates: Partial<WorkingFileLayer<ColorModel>>) {
        this.onUpdate(updates);
    }
    onUpdate(updates: Partial<WorkingFileLayer<ColorModel>>) {
        // Override
    }

    draw(ctx: CanvasRenderingContext2D, layer: WorkingFileLayer<ColorModel>, options: DrawWorkingFileLayerOptions = {}) {
        this.onDraw(ctx, layer, options);
    }
    onDraw(ctx: CanvasRenderingContext2D, layer: WorkingFileLayer<ColorModel>, options: DrawWorkingFileLayerOptions = {}) {
        // Override
    }

    renderGroup(renderer: WebGLRenderer, camera: Camera, layer: WorkingFileGroupLayer<ColorModel>) {
        this.onRenderGroup(renderer, camera, layer);
    }
    onRenderGroup(renderer: WebGLRenderer, camera: Camera, layer: WorkingFileGroupLayer<ColorModel>) {
        // Override
    }
}
