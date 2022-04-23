import { DrawWorkingFileLayerOptions, WorkingFileLayer, WorkingFileLayerRenderer, ColorModel } from '@/types';
import { DecomposedMatrix } from '@/lib/dom-matrix';

export default class BaseLayerRenderer implements WorkingFileLayerRenderer<ColorModel> {
    draw(ctx: CanvasRenderingContext2D, layer: WorkingFileLayer<ColorModel>, decomposedTransform: DecomposedMatrix, options: DrawWorkingFileLayerOptions = {}) {
        // Do nothing
    }
}
