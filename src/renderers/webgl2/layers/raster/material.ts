import rasterMaterialVertexShaderSetup from './shader/setup.vert';
import rasterMaterialVertexShaderMain from './shader/main.vert';
import rasterMaterialFragmentShaderSetup from './shader/setup.frag';
import rasterMaterialFragmentShaderMain from './shader/main.frag';

import { FrontSide } from 'three/src/constants';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';

import type { Texture } from 'three/src/textures/Texture';

export enum ColorSpaceConversion {
    'none' = 0,
    'srgbToLinearSrgb' = 1,
}

export interface RasterMaterialUpdateParams {
    srcTexture?: Texture;
    colorSpaceConversion?: ColorSpaceConversion;
}

export async function createRasterMaterial(params: RasterMaterialUpdateParams) {
    const combinedShaderResult = {
        vertexShader: rasterMaterialVertexShaderSetup + rasterMaterialVertexShaderMain,
        fragmentShader: rasterMaterialFragmentShaderSetup + rasterMaterialFragmentShaderMain,
        textures: [],
    }

    const material = new ShaderMaterial({
        transparent: true,
        depthTest: false,
        vertexShader: combinedShaderResult.vertexShader,
        fragmentShader: combinedShaderResult.fragmentShader,
        side: FrontSide,
        defines: {
            // ...combinedShaderResult.defines,
        },
        uniforms: {
            // ...combinedShaderResult.uniforms,
        },
        userData: {
            disposableTextures: combinedShaderResult.textures,
        },
    });

    material.defines.cColorSpaceConversion = params.colorSpaceConversion ?? 0;
    material.uniforms.srcTexture = {
        value: params.srcTexture,
    };
    material.uniforms.dstTexture = {
        value: undefined,
    };

    return material;
}

export async function updateRasterMaterial(material: ShaderMaterial, params: RasterMaterialUpdateParams) {
    const colorSpaceConversion = params.colorSpaceConversion ?? 0;
    if (colorSpaceConversion !== material.defines.cColorSpaceConversion) {
        material.defines.cColorSpaceConversion = colorSpaceConversion;
    }
    material.uniforms.srcTexture.value = params.srcTexture;
    material.needsUpdate = true;
}

export async function disposeRasterMaterial(material: ShaderMaterial) {
    for (const texture of material.userData.disposableTextures ?? []) {
        texture.dispose();
    }
    material.dispose();
}
