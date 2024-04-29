import { DrawWorkingFileLayerOptions, WorkingFileRasterLayer, WorkingFileLayerRenderer, ColorModel } from '@/types';
import { getStoredImageOrCanvas } from '@/store/image';
import BaseLayerRenderer from './base';

export default class RasterLayerRenderer extends BaseLayerRenderer {
    onDraw(ctx: CanvasRenderingContext2D, layer: WorkingFileRasterLayer<ColorModel>, options: DrawWorkingFileLayerOptions = {}) {
        ctx.drawImage(
            layer.bakedImage || getStoredImageOrCanvas(layer.data.sourceUuid ?? '') as HTMLImageElement,
            0,
            0,
            layer.width,
            layer.height
        );
    }
}
