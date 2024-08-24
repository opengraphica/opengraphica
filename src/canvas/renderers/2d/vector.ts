import { getStoredSvgImage } from '@/store/svg';
import BaseLayerRenderer from './base';

import type { DrawWorkingFileLayerOptions, WorkingFileVectorLayer, ColorModel } from '@/types';

export default class VectorLayerRenderer extends BaseLayerRenderer {
    onDraw(ctx: CanvasRenderingContext2D, layer: WorkingFileVectorLayer<ColorModel>, options: DrawWorkingFileLayerOptions = {}) {
        const image = layer.bakedImage || getStoredSvgImage(layer.data.sourceUuid ?? '') as HTMLImageElement;
        ctx.drawImage(
            image,
            0,
            0,
            layer.width,
            layer.height
        );
    }
}
