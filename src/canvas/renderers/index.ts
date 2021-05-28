import BaseLayerRenderer from './base';
import RasterLayerRenderer from './raster';
import RasterSequenceLayerRenderer from './raster-sequence';

const renderers = {
    base: new BaseLayerRenderer(),
    group: new BaseLayerRenderer(),
    raster: new RasterLayerRenderer(),
    rasterSequence: new RasterSequenceLayerRenderer(),
    text: new BaseLayerRenderer(),
    vector: new BaseLayerRenderer()
};

export default renderers;
