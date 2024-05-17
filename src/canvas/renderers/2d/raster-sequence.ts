import { DrawWorkingFileLayerOptions, WorkingFileRasterSequenceLayer, WorkingFileLayerRenderer, ColorModel } from '@/types';
import { getStoredImageOrCanvas } from '@/store/image';
import BaseLayerRenderer from './base';

export default class RasterSequenceLayerRenderer extends BaseLayerRenderer {
    onDraw(ctx: CanvasRenderingContext2D, layer: WorkingFileRasterSequenceLayer<ColorModel>, options: DrawWorkingFileLayerOptions = {}) {
        const frame = layer.data.currentFrame;
        if (frame?.sourceUuid) {
            const frameImage = layer.bakedImage || getStoredImageOrCanvas(frame.sourceUuid) as ImageBitmap;
            const isFlipY = layer.renderer.renderMode === 'webgl' && frameImage instanceof ImageBitmap;
            if (isFlipY) {
                ctx.save();
                ctx.translate(0, layer.width / 2);
                ctx.scale(1, -1);
                ctx.translate(0, -layer.width);
            }
            ctx.drawImage(
                frameImage,
                0,
                0,
                layer.width,
                layer.height
            );
            if (isFlipY) {
                ctx.restore();
            }
        }
    }
}
