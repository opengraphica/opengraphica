import BaseLayerRenderer from './base';
import RasterLayerRenderer from './raster';

const renderers = {
    base: new BaseLayerRenderer(),
    group: new BaseLayerRenderer(),
    raster: new RasterLayerRenderer(),
    text: new BaseLayerRenderer(),
    vector: new BaseLayerRenderer()
};

export default renderers;
