import { CanvasRenderingContext2DEnhanced, WorkingFileLayer, WorkingFileLayerRenderer, ColorModel } from '@/types';

export default class BaseLayerRenderer implements WorkingFileLayerRenderer<ColorModel> {
    draw(ctx: CanvasRenderingContext2DEnhanced, layer: WorkingFileLayer<ColorModel>) {
        // Do nothing
    }
}
