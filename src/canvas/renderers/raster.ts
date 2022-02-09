import { CanvasRenderingContext2DEnhanced, WorkingFileRasterLayer, WorkingFileLayerRenderer, ColorModel } from '@/types';
import { snapPointAtPixel } from '@/lib/dom-matrix';

export default class RasterLayerRenderer implements WorkingFileLayerRenderer<ColorModel> {
    draw(ctx: CanvasRenderingContext2DEnhanced, layer: WorkingFileRasterLayer<ColorModel>) {
        ctx.drawImage(
            layer.data.draftImage || layer.bakedImage || layer.data.sourceImage as HTMLImageElement,
            0,
            0,
            layer.width,
            layer.height
        );
    }
}
