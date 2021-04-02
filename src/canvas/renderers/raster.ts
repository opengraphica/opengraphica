import { CanvasRenderingContext2DEnhanced, WorkingFileRasterLayer, WorkingFileLayerRenderer, RGBAColor } from '@/types';
import { snapPointAtPixel } from '@/lib/dom-matrix';

export default class RasterLayerRenderer implements WorkingFileLayerRenderer<RGBAColor> {
    draw(ctx: CanvasRenderingContext2DEnhanced, layer: WorkingFileRasterLayer<RGBAColor>) {
        const position = { x: layer.x, y: layer.y };
        ctx.drawImage(
            layer.data.draftImage || layer.bakedImage || layer.data.sourceImage as HTMLImageElement,
            position.x,
            position.y,
            layer.width,
            layer.height
        );
    }
}
