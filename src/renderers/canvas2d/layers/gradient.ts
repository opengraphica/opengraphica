import { getStoredImageOrCanvas } from '@/store/image';
import workingFileStore, { getLayerGlobalTransform } from '@/store/working-file';
import BaseLayerRenderer from './base';

import { pointDistance2d } from '@/lib/math';
import { sampleGradient } from '@/lib/gradient';

import type { DrawWorkingFileLayerOptions, WorkingFileGradientLayer, RGBAColor } from '@/types';

export default class GradientLayerRenderer extends BaseLayerRenderer {
    onDraw(ctx: CanvasRenderingContext2D, layer: WorkingFileGradientLayer<RGBAColor>, options: DrawWorkingFileLayerOptions = {}) {

        ctx.save();
        const globalTransform = getLayerGlobalTransform(layer);
        const { a, b, c, d, e, f } = getLayerGlobalTransform(layer).inverse();
        ctx.transform(a, b, c, d, e, f);

        const { start, end, stops, blendColorSpace } = layer.data;
        const xformStart = new DOMPoint(start.x, start.y).matrixTransform(globalTransform);
        const xformEnd = new DOMPoint(end.x, end.y).matrixTransform(globalTransform);

        let gradient: CanvasGradient | undefined;
        switch (layer.data.fillType) {
            case 'radial':
                const radius = pointDistance2d(xformStart.x, xformStart.y, xformEnd.x, xformEnd.y);
                gradient = ctx.createRadialGradient(
                    xformStart.x, xformStart.y, 0, xformStart.x, xformStart.y, radius
                );
                break;
            case 'linear':
                gradient = ctx.createLinearGradient(xformStart.x, xformStart.y, xformEnd.x, xformEnd.y);
        }
        if (gradient) {
            for (let i = 0; i <= 100; i += 10) {
                const stopOffset = i / 100;
                gradient.addColorStop(stopOffset, sampleGradient(stops, blendColorSpace, stopOffset).style);
            }
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, workingFileStore.get('width'), workingFileStore.get('height'));
        }
        ctx.restore();
    }
}
