import type { WorkingFileLayer, WorkingFileAnyLayer, WorkingFileGroupLayer, WorkingFileLayerRenderer, ColorModel } from '@/types';
import { markRaw } from 'vue';
import canvasStore from '@/store/canvas';

import BaseLayerRenderer2d from './2d/base';
import GradientLayerRenderer2d from './2d/gradient';
import GroupLayerRenderer2d from './2d/group';
import RasterLayerRenderer2d from './2d/raster';
import RasterSequenceLayerRenderer2d from './2d/raster-sequence';
import TextLayerRenderer2d from './2d/text';
import VectorLayerRenderer2d from './2d/vector';
import VideoLayerRenderer2d from './2d/video';

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
        gradient: GradientLayerRenderer2d,
        group: GroupLayerRenderer2d,
        raster: RasterLayerRenderer2d,
        rasterSequence: RasterSequenceLayerRenderer2d,
        text: TextLayerRenderer2d,
        video: VideoLayerRenderer2d,
        vector: VectorLayerRenderer2d,
    },
};

export default renderers;
