import { CanvasRenderingContext2DEnhanced, DrawWorkingFileLayerOptions, WorkingFileLayer, WorkingFileLayerRenderer, ColorModel } from '@/types';

export default class BaseLayerRenderer implements WorkingFileLayerRenderer<ColorModel> {
    draw(ctx: CanvasRenderingContext2DEnhanced, layer: WorkingFileLayer<ColorModel>, options: DrawWorkingFileLayerOptions = {}) {
        // Do nothing
    }
}
