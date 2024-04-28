import type { WorkingFileLayerRenderer, ColorModel } from '@/types';

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
