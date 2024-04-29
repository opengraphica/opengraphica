import { DrawWorkingFileLayerOptions, WorkingFileRasterSequenceLayer, WorkingFileLayerRenderer, ColorModel } from '@/types';
import { getStoredImageOrCanvas } from '@/store/image';
import BaseLayerRenderer from './base';

export default class RasterSequenceLayerRenderer extends BaseLayerRenderer {
    onDraw(ctx: CanvasRenderingContext2D, layer: WorkingFileRasterSequenceLayer<ColorModel>, options: DrawWorkingFileLayerOptions = {}) {
        const frame = layer.data.currentFrame;
        if (frame?.sourceUuid) {
            ctx.drawImage(
                layer.bakedImage || getStoredImageOrCanvas(frame.sourceUuid) as HTMLImageElement,
                0,
                0,
                layer.width,
                layer.height
            );
        }
    }
}
