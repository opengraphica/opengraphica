import { CanvasRenderingContext2DEnhanced, WorkingFileLayer, WorkingFileLayerRenderer, RGBAColor } from '@/types';

export default class BaseLayerRenderer implements WorkingFileLayerRenderer<RGBAColor> {
    draw(ctx: CanvasRenderingContext2DEnhanced, layer: WorkingFileLayer<RGBAColor>) {
        // Do nothing
    }
}
