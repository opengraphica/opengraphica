import BaseLayerRenderer from './base';
import RasterLayerRenderer from './raster';
import RasterSequenceLayerRenderer from './raster-sequence';
import TextLayerRenderer from './text';

const renderers = {
    base: new BaseLayerRenderer(),
    group: new BaseLayerRenderer(),
    raster: new RasterLayerRenderer(),
    rasterSequence: new RasterSequenceLayerRenderer(),
    text: new TextLayerRenderer(),
    vector: new BaseLayerRenderer()
};

export default renderers;
