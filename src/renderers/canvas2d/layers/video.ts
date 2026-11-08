import { getStoredVideo } from '@/store/video';
import BaseLayerRenderer from './base';

import type { DrawWorkingFileLayerOptions, WorkingFileVideoLayer, ColorModel } from '@/types';

export default class VideoLayerRenderer extends BaseLayerRenderer {
    onDraw(ctx: CanvasRenderingContext2D, layer: WorkingFileVideoLayer<ColorModel>, options: DrawWorkingFileLayerOptions = {}) {
        const video = getStoredVideo(layer.data.sourceUuid ?? '') as HTMLVideoElement;
        ctx.drawImage(
            video,
            0,
            0,
            layer.width,
            layer.height
        );
    }
}
