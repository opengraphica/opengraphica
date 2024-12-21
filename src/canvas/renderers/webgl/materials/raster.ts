
import rasterMaterialVertexShaderSetup from '@/canvas/renderers/webgl/shaders/raster-material.setup.vert';
import rasterMaterialVertexShaderMain from '@/canvas/renderers/webgl/shaders/raster-material.main.vert';
import rasterMaterialFragmentShaderSetup from '@/canvas/renderers/webgl/shaders/raster-material.setup.frag';
import rasterMaterialFragmentShaderMain from '@/canvas/renderers/webgl/shaders/raster-material.main.frag';

import type { Texture } from 'three/src/textures/Texture';
import type { MaterialWrapperSetup } from './material-factory';

export enum ColorSpaceConversion {
    'none' = 0,
    'srgbToLinearSrgb' = 1,
}

export interface RasterMaterialUpdateParams {
    srcTexture?: Texture;
    colorSpaceConversion?: ColorSpaceConversion;
}

export const rasterMaterialSetup: MaterialWrapperSetup = {
    vertexShaderSetup: rasterMaterialVertexShaderSetup,
    vertexShaderMain: rasterMaterialVertexShaderMain,
    fragmentShaderSetup: rasterMaterialFragmentShaderSetup,
    fragmentShaderMain: rasterMaterialFragmentShaderMain,

    init(material, params: RasterMaterialUpdateParams) {
        material.defines.cColorSpaceConversion = params.colorSpaceConversion ?? 0;
        material.uniforms.srcTexture = {
            value: params.srcTexture,
        };
        material.uniforms.dstTexture = {
            value: undefined,
        };
    },

    update(material, params: RasterMaterialUpdateParams) {
        material.uniforms.srcTexture.value = params.srcTexture;
        material.needsUpdate = true;
        return false;
    },

    dispose() {
        // NOOP
    },
};
