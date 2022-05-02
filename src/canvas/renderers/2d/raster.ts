import { DrawWorkingFileLayerOptions, WorkingFileRasterLayer, WorkingFileLayerRenderer, ColorModel } from '@/types';
import { DecomposedMatrix } from '@/lib/dom-matrix';
import BaseLayerRenderer from './base';

export default class RasterLayerRenderer extends BaseLayerRenderer {
    onDraw(ctx: CanvasRenderingContext2D, layer: WorkingFileRasterLayer<ColorModel>, options: DrawWorkingFileLayerOptions = {}) {
        ctx.drawImage(
            layer.data.draftImage || layer.bakedImage || layer.data.sourceImage as HTMLImageElement,
            0,
            0,
            layer.width,
            layer.height
        );
    }
}
