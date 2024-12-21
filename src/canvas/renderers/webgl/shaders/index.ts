import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import { Texture } from 'three/src/textures/Texture';
import { Vector2 } from 'three/src/math/Vector2';
import { FrontSide, DoubleSide, CustomBlending, ZeroFactor, OneFactor, LinearFilter } from 'three/src/constants';

import prepareGpuTextureMaterialFragmentShader from './prepare-gpu-texture-material.frag';
import prepareGpuTextureMaterialVertexShader from './prepare-gpu-texture-material.vert';
import textureCompositorMaterialFragmentShader from './texture-compositor-material.frag';
import textureCompositorMaterialVertexShader from './texture-compositor-material.vert';

import { srgbaToLinearSrgba, linearSrgbaToSrgba, linearSrgbaToOklab, oklabToLinearSrgba } from '@/lib/color';
import { lerp } from '@/lib/math';

import type { CombinedFilterShaderResult } from '@/canvas/filters';
import type {
    WorkingFileGradientLayer,
    WorkingFileGradientColorStop, WorkingFileGradientColorSpace, RGBAColor,
} from '@/types';

/*---------------------*\
| Raster Layer Material |
\*---------------------*/

export function createRasterShaderMaterial(texture: Texture | null, combinedShaderResult: CombinedFilterShaderResult): ShaderMaterial {
    return new ShaderMaterial({
        transparent: true,
        depthTest: false,
        vertexShader: combinedShaderResult.vertexShader,
        fragmentShader: combinedShaderResult.fragmentShader,
        side: FrontSide,
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

/*----------------------*\
| Composite Two Textures |
\*----------------------*/

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
        side: FrontSide,
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

/*---------------------------------*\
| Prepare GPU Texture Alpha Channel |
\*---------------------------------*/

export function createPrepareGpuTextureShaderMaterial(texture: Texture): ShaderMaterial {
    return new ShaderMaterial({
        transparent: true,
        blending: CustomBlending,
        blendSrc: OneFactor,
        blendDst: ZeroFactor,
        vertexShader: prepareGpuTextureMaterialVertexShader,
        fragmentShader: prepareGpuTextureMaterialFragmentShader,
        side: FrontSide,
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
