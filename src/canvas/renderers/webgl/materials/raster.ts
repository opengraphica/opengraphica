
import rasterMaterialVertexShaderSetup from '@/canvas/renderers/webgl/shaders/basic-material.setup.vert';
import rasterMaterialVertexShaderMain from '@/canvas/renderers/webgl/shaders/basic-material.main.vert';
import rasterMaterialFragmentShaderSetup from '@/canvas/renderers/webgl/shaders/basic-material.setup.frag';
import rasterMaterialFragmentShaderMain from '@/canvas/renderers/webgl/shaders/basic-material.main.frag';

import type { Texture } from 'three/src/textures/Texture';
import type { MaterialWrapperSetup } from './material-factory';

export interface RasterMaterialUpdateParams {
    texture?: Texture;
}

export const rasterMaterialSetup: MaterialWrapperSetup = {
    vertexShaderSetup: rasterMaterialVertexShaderSetup,
    vertexShaderMain: rasterMaterialVertexShaderMain,
    fragmentShaderSetup: rasterMaterialFragmentShaderSetup,
    fragmentShaderMain: rasterMaterialFragmentShaderMain,

    init(material, params: RasterMaterialUpdateParams) {
        material.uniforms.map = {
            value: params.texture,
        };
        material.uniforms.destinationMap = {
            value: undefined,
        };
    },

    update(material, params: RasterMaterialUpdateParams) {
        material.uniforms.map.value = params.texture;
        material.needsUpdate = true;
        return false;
    },

    dispose() {
        // NOOP
    },
};
