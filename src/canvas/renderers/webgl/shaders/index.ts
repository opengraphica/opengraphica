import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import { DoubleSide, CustomBlending, ZeroFactor, OneFactor } from 'three/src/constants';
import prepareGpuTextureMaterialFragmentShader from './prepare-gpu-texture-material.frag';
import prepareGpuTextureMaterialVertexShader from './prepare-gpu-texture-material.vert';
import textureCompositorMaterialFragmentShader from './texture-compositor-material.frag';
import textureCompositorMaterialVertexShader from './texture-compositor-material.vert';

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

export function createRasterTextureCompositorShaderMaterial(
    baseTexture: Texture,
    overlayTexture: Texture,
    overlayTextureOffsetX: number,
    overlayTextureOffsetY: number,
    blendMode: string = 'source-over',
): ShaderMaterial {
    const overlayWidth = overlayTexture.image.width ?? 1;
    const overlayHeight = overlayTexture.image.height ?? 1;
    const destinationWidth = baseTexture.image.width ?? 1;
    const destinationHeight = baseTexture.image.height ?? 1;
    return new ShaderMaterial({
        transparent: true,
        blending: CustomBlending,
        blendSrc: OneFactor,
        blendDst: ZeroFactor,
        vertexShader: textureCompositorMaterialVertexShader,
        fragmentShader: textureCompositorMaterialFragmentShader,
        side: DoubleSide,
        defines: {},
        uniforms: {
            baseTextureScaleX: { value: overlayWidth / destinationWidth },
            baseTextureScaleY: { value: overlayHeight / destinationHeight },
            baseTextureOffsetX: { value: (overlayTextureOffsetX / destinationWidth) },
            baseTextureOffsetY: { value: (overlayTextureOffsetY / destinationHeight) },
            baseMap: { value: baseTexture },
            overlayMap: { value: overlayTexture },
        },
    });
}
export function updateRasterTextureCompositorShaderMaterial(
    material: ShaderMaterial,
    baseTexture: Texture,
    overlayTexture: Texture,
    overlayTextureOffsetX: number,
    overlayTextureOffsetY: number,
    blendMode: string = 'source-over',
) {
    const overlayWidth = overlayTexture.image.width ?? 1;
    const overlayHeight = overlayTexture.image.height ?? 1;
    const baseWidth = baseTexture.image.width ?? 1;
    const baseHeight = baseTexture.image.height ?? 1;
    material.uniforms.baseTextureScaleX.value = overlayWidth / baseWidth;
    material.uniforms.baseTextureScaleY.value = overlayHeight / baseHeight;
    material.uniforms.baseTextureOffsetX.value = (overlayTextureOffsetX / baseWidth);
    material.uniforms.baseTextureOffsetY.value = (overlayTextureOffsetY / baseHeight);
    material.uniforms.baseMap.value = baseTexture;
    material.uniforms.overlayMap.value = overlayTexture;
    material.needsUpdate = true;
}
export function cleanRasterTextureCompositorShaderMaterial(material: ShaderMaterial) {
    material.uniforms.baseTextureOffsetX.value = null;
    delete material.uniforms.baseTextureOffsetX;
    material.uniforms.baseTextureOffsetY.value = null;
    delete material.uniforms.baseTextureOffsetY;
    material.uniforms.baseMap.value = null;
    delete material.uniforms.baseMap;
    material.uniforms.sourceMap.value = null;
    delete material.uniforms.overlayMap;
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
