import { DrawWorkingFileLayerOptions, WorkingFileRasterSequenceLayer, WorkingFileLayerRenderer, ColorModel } from '@/types';
import { DecomposedMatrix } from '@/lib/dom-matrix';

export default class RasterSequenceLayerRenderer implements WorkingFileLayerRenderer<ColorModel> {
    draw(ctx: CanvasRenderingContext2D, layer: WorkingFileRasterSequenceLayer<ColorModel>, decomposedTransform: DecomposedMatrix, options: DrawWorkingFileLayerOptions = {}) {
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
