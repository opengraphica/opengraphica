import { FrontSide } from 'three/src/constants';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';

import rasterMaterialVertexShaderSetup from './shader/setup.vert';
import rasterMaterialVertexShaderMain from './shader/main.vert';
import rasterMaterialFragmentShaderSetup from './shader/setup.frag';
import rasterMaterialFragmentShaderMain from './shader/main.frag';
import { createLayerShader } from '../base/material';

import type { Texture } from 'three/src/textures/Texture';
import type { Webgl2RendererCanvasFilter } from '@/types';

export enum ColorSpaceConversion {
    'none' = 0,
    'srgbToLinearSrgb' = 1,
}

export interface RasterMaterialUpdateParams {
    srcTexture?: Texture<any>;
    draftTexture?: Texture<any>;
    colorSpaceConversion?: ColorSpaceConversion;
    canvasFilters?: Array<Webgl2RendererCanvasFilter | null>;
    opacity?: number;
    premultiplyAlphaFix?: boolean; // Created for SVG rendering
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
        depthWrite: false,
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
        premultipliedAlpha: params.premultiplyAlphaFix ?? false,
    });

    material.defines.cColorSpaceConversion = params.colorSpaceConversion ?? 0;
    material.defines.cPremultiplyAlphaFix = params.premultiplyAlphaFix ? 1 : 0;
    material.uniforms.srcTexture = {
        value: params.srcTexture,
    };
    material.uniforms.dstTexture = {
        value: undefined,
    };
    material.uniforms.opacity = {
        value: params.opacity ?? 1,
    };
    material.needsUpdate = true;

    return material;
}

export async function updateRasterMaterial(
    material: ShaderMaterial,
    params: RasterMaterialUpdateParams
) {
    const colorSpaceConversion = params.colorSpaceConversion ?? 0;
    if (colorSpaceConversion !== material.defines.cColorSpaceConversion) {
        material.defines.cColorSpaceConversion = colorSpaceConversion;
    }
    const premultiplyAlphaFix = params.premultiplyAlphaFix ? 1 : 0;
    if (premultiplyAlphaFix !== material.defines.cPremultiplyAlphaFix) {
        material.defines.cPremultiplyAlphaFix = premultiplyAlphaFix;
    }
    if (material.uniforms.srcTexture.value !== params.srcTexture) {
        if (!params.srcTexture?.userData.isDraft) {
            material.uniforms.srcTexture.value?.dispose(); // Prevent GPU memory leak. If it's still needed, THREE will re-upload.
        }
        material.uniforms.srcTexture.value = params.srcTexture;
    }
    if (params.opacity != null && material.uniforms.opacity.value !== params.opacity) {
        material.uniforms.opacity.value = params.opacity;
    }
    material.needsUpdate = true;
}

export async function disposeRasterMaterial(material: ShaderMaterial) {
    for (const texture of material.userData.disposableTextures ?? []) {
        texture.dispose();
    }
    material.uniforms = {};
    material.dispose();
}
