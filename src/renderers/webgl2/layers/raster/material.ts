import { FrontSide } from 'three/src/constants';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';

import rasterMaterialVertexShaderSetup from './shader/setup.vert';
import rasterMaterialVertexShaderMain from './shader/main.vert';
import rasterMaterialFragmentShaderSetup from './shader/setup.frag';
import rasterMaterialFragmentShaderMain from './shader/main.frag';
import { createLayerShader, createLayerShaderUniformsAndDefines } from '../base/material';

import type { Texture } from 'three/src/textures/Texture';
import type { Webgl2RendererCanvasFilter } from '@/types';

export enum ColorSpaceConversion {
    'none' = 0,
    'srgbToLinearSrgb' = 1,
}

export interface RasterMaterialUpdateParams {
    srcTexture?: Texture;
    colorSpaceConversion?: ColorSpaceConversion;
    canvasFilters?: Webgl2RendererCanvasFilter[],
}

export async function createRasterMaterial(params: RasterMaterialUpdateParams) {
    const shader = await createLayerShader({
        vertexShaderSetup: rasterMaterialVertexShaderSetup,
        vertexShaderMain: rasterMaterialVertexShaderMain,
        fragmentShaderSetup: rasterMaterialFragmentShaderSetup,
        fragmentShaderMain: rasterMaterialFragmentShaderMain,
        canvasFilters: params.canvasFilters ?? [],
        width: params?.srcTexture?.image.width ?? 1,
        height: params?.srcTexture?.image.height ?? 1,
    });

    const material = new ShaderMaterial({
        transparent: true,
        depthTest: false,
        vertexShader: shader.vertexShader,
        fragmentShader: shader.fragmentShader,
        side: FrontSide,
        defines: {
            ...shader.defines,
        },
        uniforms: {
            ...shader.uniforms,
        },
        userData: {
            disposableTextures: shader.textures,
        },
    });

    material.defines.cColorSpaceConversion = params.colorSpaceConversion ?? 0;
    material.uniforms.srcTexture = {
        value: params.srcTexture,
    };
    material.uniforms.dstTexture = {
        value: undefined,
    };
    material.needsUpdate = true;

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
    material.uniforms = {};
    material.dispose();
}
