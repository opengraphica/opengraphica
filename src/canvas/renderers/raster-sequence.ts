import { CanvasRenderingContext2DEnhanced, WorkingFileRasterSequenceLayer, WorkingFileLayerRenderer, RGBAColor } from '@/types';

export default class RasterSequenceLayerRenderer implements WorkingFileLayerRenderer<RGBAColor> {
    draw(ctx: CanvasRenderingContext2DEnhanced, layer: WorkingFileRasterSequenceLayer<RGBAColor>) {
        const frame = layer.data.currentFrame;
        if (frame) {
            ctx.drawImage(
                frame.draftImage || layer.bakedImage || frame.sourceImage as HTMLImageElement,
                0,
                0,
                layer.width,
                layer.height
            );
        }
    }
}
