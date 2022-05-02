import { shallowReadonly, watch, type WatchStopHandle } from 'vue';
import { DrawWorkingFileLayerOptions, WorkingFileLayer, WorkingFileLayerRenderer, ColorModel } from '@/types';

export default class BaseLayerRenderer implements WorkingFileLayerRenderer<ColorModel> {

    attach(layer: WorkingFileLayer<ColorModel>) {
        this.onAttach(layer);
    }
    onAttach(layer: WorkingFileLayer<ColorModel>) {
        // Override
    }

    detach() {
        this.onDetach();
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
}
