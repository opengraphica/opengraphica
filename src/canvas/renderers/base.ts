import { DrawWorkingFileLayerOptions, WorkingFileLayer, WorkingFileLayerRenderer, ColorModel } from '@/types';

export default class BaseLayerRenderer implements WorkingFileLayerRenderer<ColorModel> {
    draw(ctx: CanvasRenderingContext2D, layer: WorkingFileLayer<ColorModel>, options: DrawWorkingFileLayerOptions = {}) {
        // Do nothing
    }
}
