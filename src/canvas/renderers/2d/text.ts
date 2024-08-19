import { DrawWorkingFileLayerOptions, WorkingFileTextLayer, WorkingFileLayerRenderer, ColorModel } from '@/types';
// import { fontLoadedStatusMap, textLayerCache, textMetaDefaults, TextLayerCacheItem, TextLayerRenderInfoWrap } from '@/canvas/store/text-state';
import { getFontMetrics, FontMetrics } from '@/lib/metrics';
import { generateColorStyle } from '@/lib/color';
import { DecomposedMatrix } from '@/lib/dom-matrix';
import workingFileStore from '@/store/working-file';
import BaseLayerRenderer from './base';

import DrawableCanvas from '@/canvas/renderers/drawable/canvas';

import type { TextData } from '@/canvas/drawables/text';
import type { DrawableConstructor } from '@/types';

let TextDrawable: DrawableConstructor | undefined = undefined;
import('@/canvas/drawables/text').then(({ default: TextDrawableConstructor }) => {
    TextDrawable = TextDrawableConstructor;
});

export default class TextLayerRenderer extends BaseLayerRenderer {

    private drawableCanvas: DrawableCanvas | undefined;
    private textDrawableUuid: string | undefined;

    onDraw(ctx: CanvasRenderingContext2D, layer: WorkingFileTextLayer<ColorModel>, options: DrawWorkingFileLayerOptions = {}) {
        this.createDrawableCanvas(layer);

        if (this.textDrawableUuid && this.drawableCanvas) {
            const isHorizontal = layer.data.lineDirection === 'ltr' || layer.data.lineDirection === 'rtl';
            this.drawableCanvas.draw({
                updates: [{
                    uuid: this.textDrawableUuid,
                    data: {
                        wrapSize: isHorizontal ? layer.width : layer.height,
                        document: layer.data
                    }
                }]
            });
            const { canvas } = this.drawableCanvas.drawCompleteSync();
            ctx.drawImage(canvas, 0, 0);
        }
    }

    onAttach(layer: WorkingFileTextLayer<ColorModel>) {
        this.createDrawableCanvas(layer);
    }

    createDrawableCanvas(layer: WorkingFileTextLayer<ColorModel>) {
        if (this.drawableCanvas || !TextDrawable) return;
        this.drawableCanvas = new DrawableCanvas({
            scale: 1,
            forceDrawOnMainThread: true,
            sync: true,
        });
        this.drawableCanvas.registerDrawableClass('text', TextDrawable);
        this.textDrawableUuid = this.drawableCanvas.addSync<TextData>('text', {
            wrapSize: layer.width,
            document: layer.data
        });
    }

}
