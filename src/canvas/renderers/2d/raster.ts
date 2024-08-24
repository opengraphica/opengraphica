import { getStoredImageOrCanvas } from '@/store/image';
import BaseLayerRenderer from './base';

import type { DrawWorkingFileLayerOptions, WorkingFileRasterLayer, ColorModel } from '@/types';

export default class RasterLayerRenderer extends BaseLayerRenderer {
    onDraw(ctx: CanvasRenderingContext2D, layer: WorkingFileRasterLayer<ColorModel>, options: DrawWorkingFileLayerOptions = {}) {
        const image = layer.bakedImage || getStoredImageOrCanvas(layer.data.sourceUuid ?? '') as ImageBitmap;
        const isFlipY = layer.renderer.renderMode === 'webgl' && image instanceof ImageBitmap;
        if (isFlipY) {
            ctx.save();
            ctx.translate(0, layer.height / 2);
            ctx.scale(1, -1);
            ctx.translate(0, -layer.height / 2);
        }
        ctx.drawImage(
            image,
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
