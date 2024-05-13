import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import { DoubleSide, CustomBlending, ZeroFactor, OneFactor } from 'three/src/constants';
import prepareGpuTextureMaterialFragmentShader from './prepare-gpu-texture-material.frag';
import prepareGpuTextureMaterialVertexShader from './prepare-gpu-texture-material.vert';
import textureMergeMaterialFragmentShader from './texture-merge-material.frag';
import textureMergeMaterialVertexShader from './texture-merge-material.vert';

import type { CombinedShaderResult } from '@/canvas/filters';
import type { Texture } from 'three';

export function createRasterShaderMaterial(texture: Texture | null, combinedShaderResult: CombinedShaderResult): ShaderMaterial {
    return new ShaderMaterial({
        transparent: true,
        depthTest: false,
        vertexShader: combinedShaderResult.vertexShader,
        fragmentShader: combinedShaderResult.fragmentShader,
        side: DoubleSide,
        defines: {
            cMapWidth: texture?.image.width ?? 1,
            cMapHeight: texture?.image.height ?? 1,
            ...combinedShaderResult.defines,
        },
        uniforms: {
            map: { value: texture },
            ...combinedShaderResult.uniforms
        },
    });
}

export function createRasterTextureMergeShaderMaterial(destinationTexture: Texture, sourceTexture: Texture, sourceX: number, sourceY: number): ShaderMaterial {
    const sourceWidth = sourceTexture.image.width ?? 1;
    const sourceHeight = sourceTexture.image.height ?? 1;
    const destinationWidth = destinationTexture.image.width ?? 1;
    const destinationHeight = destinationTexture.image.height ?? 1;
    return new ShaderMaterial({
        transparent: true,
        blending: CustomBlending,
        blendSrc: OneFactor,
        blendDst: ZeroFactor,
        vertexShader: textureMergeMaterialVertexShader,
        fragmentShader: textureMergeMaterialFragmentShader,
        side: DoubleSide,
        defines: {},
        uniforms: {
            destinationTextureScaleX: { value: sourceWidth / destinationWidth },
            destinationTextureScaleY: { value: sourceHeight / destinationHeight },
            destinationTextureOffsetX: { value: (sourceX / destinationWidth) },
            destinationTextureOffsetY: { value: (sourceY / destinationHeight) },
            destinationMap: { value: destinationTexture },
            sourceMap: { value: sourceTexture },
        },
    });
}
export function updateRasterTextureMergeShaderMaterial(material: ShaderMaterial, destinationTexture: Texture, sourceTexture: Texture, sourceX: number, sourceY: number) {
    const sourceWidth = sourceTexture.image.width ?? 1;
    const sourceHeight = sourceTexture.image.height ?? 1;
    const destinationWidth = destinationTexture.image.width ?? 1;
    const destinationHeight = destinationTexture.image.height ?? 1;
    material.uniforms.destinationTextureScaleX.value = sourceWidth / destinationWidth;
    material.uniforms.destinationTextureScaleY.value = sourceHeight / destinationHeight;
    material.uniforms.destinationTextureOffsetX.value = (sourceX / destinationWidth);
    material.uniforms.destinationTextureOffsetY.value = (sourceY / destinationHeight);
    material.uniforms.destinationMap.value = destinationTexture;
    material.uniforms.sourceMap.value = sourceTexture;
    material.needsUpdate = true;
}
export function cleanRasterTextureMergeShaderMaterial(material: ShaderMaterial) {
    material.uniforms.destinationTextureOffsetX.value = null;
    delete material.uniforms.destinationTextureOffsetX;
    material.uniforms.destinationTextureOffsetY.value = null;
    delete material.uniforms.destinationTextureOffsetY;
    material.uniforms.destinationMap.value = null;
    delete material.uniforms.destinationMap;
    material.uniforms.sourceMap.value = null;
    delete material.uniforms.sourceMap;
    material.needsUpdate = true;
}

export function createPrepareGpuTextureShaderMaterial(texture: Texture): ShaderMaterial {
    return new ShaderMaterial({
        transparent: true,
        blending: CustomBlending,
        blendSrc: OneFactor,
        blendDst: ZeroFactor,
        vertexShader: prepareGpuTextureMaterialVertexShader,
        fragmentShader: prepareGpuTextureMaterialFragmentShader,
        side: DoubleSide,
        defines: {
            cMapWidth: texture?.image.width ?? 1,
            cMapHeight: texture?.image.height ?? 1,
        },
        uniforms: {
            map: { value: texture },
        },
    });
}
export function updatePrepareGpuTextureShaderMaterial(material: ShaderMaterial, texture: Texture) {
    material.defines.cMapWidth = texture?.image.width ?? 1;
    material.defines.cMapHeight = texture?.image.height ?? 1;
    material.uniforms.map.value = texture;
    material.needsUpdate = true;
}
export function cleanPrepareGpuTextureShaderMaterial(material: ShaderMaterial) {
    material.uniforms.map.value = null;
    delete material.uniforms.map;
    material.needsUpdate = true;
}
