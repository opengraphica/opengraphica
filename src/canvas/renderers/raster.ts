import { CanvasRenderingContext2DEnhanced, DrawWorkingFileLayerOptions, WorkingFileRasterLayer, WorkingFileLayerRenderer, ColorModel } from '@/types';
import { snapPointAtPixel } from '@/lib/dom-matrix';

export default class RasterLayerRenderer implements WorkingFileLayerRenderer<ColorModel> {
    draw(ctx: CanvasRenderingContext2DEnhanced, layer: WorkingFileRasterLayer<ColorModel>, options: DrawWorkingFileLayerOptions = {}) {
        ctx.drawImage(
            layer.data.draftImage || layer.bakedImage || layer.data.sourceImage as HTMLImageElement,
            0,
            0,
            layer.width,
            layer.height
        );
    }
}
