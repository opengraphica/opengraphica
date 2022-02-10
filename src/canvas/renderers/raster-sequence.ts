import { CanvasRenderingContext2DEnhanced, DrawWorkingFileLayerOptions, WorkingFileRasterSequenceLayer, WorkingFileLayerRenderer, ColorModel } from '@/types';

export default class RasterSequenceLayerRenderer implements WorkingFileLayerRenderer<ColorModel> {
    draw(ctx: CanvasRenderingContext2DEnhanced, layer: WorkingFileRasterSequenceLayer<ColorModel>, options: DrawWorkingFileLayerOptions = {}) {
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
