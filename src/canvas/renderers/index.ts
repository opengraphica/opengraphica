import type { WorkingFileLayer, WorkingFileAnyLayer, WorkingFileLayerRenderer, ColorModel } from '@/types';
import { markRaw } from 'vue';
import canvasStore from '@/store/canvas';

import BaseLayerRenderer2d from './2d/base';
import GroupLayerRenderer2d from './2d/group';
import RasterLayerRenderer2d from './2d/raster';
import RasterSequenceLayerRenderer2d from './2d/raster-sequence';
import TextLayerRenderer2d from './2d/text';

import BaseLayerRendererWebgl from './webgl/base';
import GroupLayerRendererWebgl from './webgl/group';
import RasterLayerRendererWebgl from './webgl/raster';
import RasterSequenceLayerRendererWebgl from './webgl/raster-sequence';
import TextLayerRendererWebgl from './webgl/text';

type ClassOfInterface<I, Args extends any[] = any[]> = new(...args: Args) => I;

interface Renderers {
    [key: string]: {
        [key: string]: ClassOfInterface<WorkingFileLayerRenderer<ColorModel>>;
    };
}

const renderers: Renderers = {
    '2d': {
        base: BaseLayerRenderer2d,
        empty: BaseLayerRenderer2d,
        group: GroupLayerRenderer2d,
        raster: RasterLayerRenderer2d,
        rasterSequence: RasterSequenceLayerRenderer2d,
        text: TextLayerRenderer2d,
        vector: BaseLayerRenderer2d
    },
    webgl: {
        base: BaseLayerRendererWebgl,
        empty: BaseLayerRendererWebgl,
        group: GroupLayerRendererWebgl,
        raster: RasterLayerRendererWebgl,
        rasterSequence: RasterSequenceLayerRendererWebgl,
        text: TextLayerRendererWebgl,
        vector: BaseLayerRendererWebgl
    }
};

export default renderers;

export function assignLayerRenderer(layer: WorkingFileAnyLayer<ColorModel>) {
    const renderer = canvasStore.get('renderer');
    switch (layer.type) {
        case 'empty':
            layer.renderer = markRaw(new renderers[renderer].empty());
            break;
        case 'group':
            layer.renderer = markRaw(new renderers[renderer].group());
            break;
        case 'raster':
            layer.renderer = markRaw(new renderers[renderer].raster());
            break;
        case 'rasterSequence':
            layer.renderer = markRaw(new renderers[renderer].rasterSequence());
            break;
        case 'vector':
            layer.renderer = markRaw(new renderers[renderer].vector());
            break;
        case 'text':
            layer.renderer = markRaw(new renderers[renderer].text());
            break;
        default:
            (layer as WorkingFileLayer).renderer = markRaw(new renderers[renderer].base());
    }
}
