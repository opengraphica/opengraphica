import BaseLayerRenderer from './base';
import GroupLayerRenderer from './group';
import RasterLayerRenderer from './raster';
import RasterSequenceLayerRenderer from './raster-sequence';
import TextLayerRenderer from './text';

const renderers = {
    base: new BaseLayerRenderer(),
    empty: new BaseLayerRenderer(),
    group: new GroupLayerRenderer(),
    raster: new RasterLayerRenderer(),
    rasterSequence: new RasterSequenceLayerRenderer(),
    text: new TextLayerRenderer(),
    vector: new BaseLayerRenderer()
};

export default renderers;
