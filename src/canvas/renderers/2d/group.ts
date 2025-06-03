import { DrawWorkingFileLayerOptions, WorkingFileGroupLayer, WorkingFileLayerRenderer, ColorModel } from '@/types';
import BaseLayerRenderer from './base';

let layerRenderers: any;

setTimeout(async () => {
    layerRenderers = (await import('@/canvas/renderers')).default;
}, 0);

export default class GroupLayerRenderer extends BaseLayerRenderer {
    async onAttach() {
        if (!layerRenderers) {
            layerRenderers = (await import('@/canvas/renderers')).default;
        }
    }
    onDraw(ctx: CanvasRenderingContext2D, layer: WorkingFileGroupLayer<ColorModel>, options: DrawWorkingFileLayerOptions = {}) {
        const layers = layer.layers;
        for (const layer of layers) {
            if (options.force2dRenderer) {
                new layerRenderers['2d'][layer.type]().draw(ctx, layer, options);
            } else {
                // layer.renderer.draw(ctx, layer, options);
            }
        }
    }
}
