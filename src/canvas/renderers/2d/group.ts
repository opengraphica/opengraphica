import { DrawWorkingFileLayerOptions, WorkingFileGroupLayer, WorkingFileLayerRenderer, ColorModel } from '@/types';
import BaseLayerRenderer from './base';

export default class GroupLayerRenderer extends BaseLayerRenderer {
    onDraw(ctx: CanvasRenderingContext2D, layer: WorkingFileGroupLayer<ColorModel>, options: DrawWorkingFileLayerOptions = {}) {
        const layers = layer.layers;
        for (const layer of layers) {
            layer.renderer.draw(ctx, layer, options);
        }
    }
}
