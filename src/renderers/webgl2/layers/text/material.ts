import { BackSide } from 'three/src/constants';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import { Vector4 } from 'three/src/math/Vector4';

import { hexToColor } from '@/lib/color';

import textMaterialVertexShaderSetup from './shader/setup.vert';
import textMaterialVertexShaderMain from './shader/main.vert';
import textMaterialFragmentShaderSetup from './shader/setup.frag';
import textMaterialFragmentShaderMain from './shader/main.frag';
import { createLayerShader } from '../base/material';

import type { Webgl2RendererCanvasFilter } from '@/types';

export interface TextMaterialUpdateParams {
    canvasFilters?: Webgl2RendererCanvasFilter[];
    fill?: string;
    width?: number;
    height?: number;
}

export async function createTextMaterial(params: TextMaterialUpdateParams) {
    const shader = await createLayerShader({
        vertexShaderSetup: textMaterialVertexShaderSetup,
        vertexShaderMain: textMaterialVertexShaderMain,
        fragmentShaderSetup: textMaterialFragmentShaderSetup,
        fragmentShaderMain: textMaterialFragmentShaderMain,
        canvasFilters: params.canvasFilters ?? [],
        width: params?.width ?? 1,
        height: params?.height ?? 1,
    });

    const material = new ShaderMaterial({
        transparent: true,
        depthTest: false,
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
    });

    material.uniforms.dstTexture = {
        value: undefined,
    };
    const color = hexToColor(params.fill ?? '#000000', 'rgba');
    material.uniforms.fill = {
        value: new Vector4(color.r, color.g, color.b, color.alpha),
    };
    material.needsUpdate = true;

    return material;
}

export async function updateTextMaterial(material: ShaderMaterial, params: TextMaterialUpdateParams) {
    if (params.fill) {
        const color = hexToColor(params.fill ?? '#000000', 'rgba');
        material.uniforms.fill.value = new Vector4(color.r, color.g, color.b, color.alpha);
    }
    material.needsUpdate = true;
}

export async function disposeTextMaterial(material: ShaderMaterial) {
    for (const texture of material.userData.disposableTextures ?? []) {
        texture.dispose();
    }
    material.uniforms = {};
    material.dispose();
}
