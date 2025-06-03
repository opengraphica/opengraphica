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

import BaseLayerRendererWebgl from './webgl/base';
import GradientLayerRendererWebgl from './webgl/gradient';
import GroupLayerRendererWebgl from './webgl/group';
import RasterLayerRendererWebgl from './webgl/raster';
import RasterSequenceLayerRendererWebgl from './webgl/raster-sequence';
import TextLayerRendererWebgl from './webgl/text';
import VectorLayerRendererWebgl from './webgl/vector';
import VideoLayerRendererWebgl from './webgl/video';
import { queueRefreshLayerPasses } from './webgl/postprocessing/create-layer-passes';

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
    webgl: {
        base: BaseLayerRendererWebgl,
        empty: BaseLayerRendererWebgl,
        gradient: GradientLayerRendererWebgl,
        group: GroupLayerRendererWebgl,
        raster: RasterLayerRendererWebgl,
        rasterSequence: RasterSequenceLayerRendererWebgl,
        text: TextLayerRendererWebgl,
        vector: VectorLayerRendererWebgl,
        video: VideoLayerRendererWebgl,
    }
};

export default renderers;

// export function assignLayerRenderer(layer: WorkingFileAnyLayer<ColorModel>) {
//     const renderer = canvasStore.get('renderer');
//     switch (layer.type) {
//         case 'empty':
//             layer.renderer = markRaw(new renderers[renderer].empty());
//             break;
//         case 'gradient':
//             layer.renderer = markRaw(new renderers[renderer].gradient());
//             break;
//         case 'group':
//             layer.renderer = markRaw(new renderers[renderer].group());
//             break;
//         case 'raster':
//             layer.renderer = markRaw(new renderers[renderer].raster());
//             break;
//         case 'rasterSequence':
//             layer.renderer = markRaw(new renderers[renderer].rasterSequence());
//             break;
//         case 'text':
//             layer.renderer = markRaw(new renderers[renderer].text());
//             break;
//         case 'vector':
//             layer.renderer = markRaw(new renderers[renderer].vector());
//             break;
//         case 'video':
//             layer.renderer = markRaw(new renderers[renderer].video());
//             break;
//         default:
//             (layer as WorkingFileLayer).renderer = markRaw(new renderers[renderer].base());
//     }
//     queueRefreshLayerPasses();
// }

// export function discardAllLayerRenderers(layers: Array<WorkingFileLayer<ColorModel>>) {
//     for (const layer of layers) {
//         if (layer.renderer) {
//             layer.renderer.detach();
//         }
//         delete (layer as unknown as { renderer: undefined }).renderer;
//         if (layer.type === 'group') {
//             discardAllLayerRenderers((layer as WorkingFileGroupLayer<ColorModel>).layers);
//         }
//     }
// }
