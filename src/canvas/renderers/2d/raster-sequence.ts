import { DrawWorkingFileLayerOptions, WorkingFileRasterSequenceLayer, WorkingFileLayerRenderer, ColorModel } from '@/types';
import { DecomposedMatrix } from '@/lib/dom-matrix';
import BaseLayerRenderer from './base';

export default class RasterSequenceLayerRenderer extends BaseLayerRenderer {
    onDraw(ctx: CanvasRenderingContext2D, layer: WorkingFileRasterSequenceLayer<ColorModel>, options: DrawWorkingFileLayerOptions = {}) {
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
