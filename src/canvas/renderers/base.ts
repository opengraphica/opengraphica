import { CanvasRenderingContext2DEnhanced, WorkingFileLayer, RGBAColor } from '@/types';

export class BaseCanvasRenderer {
    draw(ctx: CanvasRenderingContext2DEnhanced, layer: WorkingFileLayer<RGBAColor>) {
        // Override
    }
}
