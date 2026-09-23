import { FrontSide, BackSide } from 'three/src/constants';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import { Vector2 } from 'three/src/math/Vector2';
import { Vector4 } from 'three/src/math/Vector4';

import rasterMaterialVertexShaderSetup from './shader/setup.vert';
import rasterMaterialVertexShaderMain from './shader/main.vert';
import rasterMaterialFragmentShaderSetup from './shader/setup.frag';
import rasterMaterialFragmentShaderMain from './shader/main.frag';
import { createLayerShader } from '../base/material';

import type { Webgl2RendererCanvasFilter } from '@/types';

export enum ColorSpaceConversion {
    'none' = 0,
    'srgbToLinearSrgb' = 1,
}

export interface VectorMaterialUpdateParams {
    canvasFilters?: Array<Webgl2RendererCanvasFilter | null>;
    color?: Vector4;
    dimensions?: Vector2;
}

export async function createVectorMaterial(params: VectorMaterialUpdateParams) {
    const shader = await createLayerShader({
        vertexShaderSetup: rasterMaterialVertexShaderSetup,
        vertexShaderMain: rasterMaterialVertexShaderMain,
        fragmentShaderSetup: rasterMaterialFragmentShaderSetup,
        fragmentShaderMain: rasterMaterialFragmentShaderMain,
        canvasFilters: params.canvasFilters ?? [],
        width: params.dimensions?.x ?? 1,
        height: params.dimensions?.y ?? 1,
    });

    const material = new ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        vertexShader: shader.vertexShader,
        fragmentShader: shader.fragmentShader,
        side: BackSide,
        defines: {
            ...shader.defines,
        },
        uniforms: {
            ...shader.uniforms,
        },
        userData: {
            disposableTextures: shader.textures,
        },
        premultipliedAlpha: false,
    });

    material.uniforms.color = {
        value: params.color,
    };
    material.needsUpdate = true;

    return material;
}

export async function updateVectorMaterial(
    material: ShaderMaterial,
    params: VectorMaterialUpdateParams
) {
    if (material.uniforms.color.value !== params.color) {
        material.uniforms.color.value = params.color;
    }
    material.needsUpdate = true;
}

export async function disposeVectorrMaterial(material: ShaderMaterial) {
    for (const texture of material.userData.disposableTextures ?? []) {
        texture.dispose();
    }
    material.uniforms = {};
    material.dispose();
}
