import { DrawWorkingFileLayerOptions, WorkingFileGroupLayer, WorkingFileLayerRenderer, ColorModel } from '@/types';
import { drawWorkingFileLayerToCanvas } from '@/lib/canvas';
import { DecomposedMatrix } from '@/lib/dom-matrix';

export default class GroupLayerRenderer implements WorkingFileLayerRenderer<ColorModel> {
    draw(ctx: CanvasRenderingContext2D, layer: WorkingFileGroupLayer<ColorModel>, decomposedTransform: DecomposedMatrix, options: DrawWorkingFileLayerOptions = {}) {
        const layers = layer.layers;
        for (const layer of layers) {
            drawWorkingFileLayerToCanvas(ctx.canvas, ctx, layer, decomposedTransform, options);
        }
    }
}
