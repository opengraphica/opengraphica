import { CanvasRenderingContext2DEnhanced, WorkingFileRasterLayer, WorkingFileLayerRenderer, RGBAColor } from '@/types';
import { snapPointAtPixel } from '@/lib/dom-matrix';

export default class RasterLayerRenderer implements WorkingFileLayerRenderer<RGBAColor> {
    draw(ctx: CanvasRenderingContext2DEnhanced, layer: WorkingFileRasterLayer<RGBAColor>) {
        ctx.drawImage(
            layer.data.draftImage || layer.bakedImage || layer.data.sourceImage as HTMLImageElement,
            0,
            0,
            layer.width,
            layer.height
        );
    }
}
