import { FrontSide, HalfFloatType, RGBAFormat, UnsignedByteType } from 'three/src/constants';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import { WebGLRenderTarget } from 'three/src/renderers/WebGLRenderTarget';

import rasterMaterialVertexShaderSetup from './shader/setup.vert';
import rasterMaterialVertexShaderMain from './shader/main.vert';
import rasterMaterialFragmentShaderSetup from './shader/setup.frag';
import rasterMaterialFragmentShaderMain from './shader/main.frag';
import { createLayerShader } from '../base/material';

import { limitMaxDimension } from '@/lib/math';

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
    useAutomaticLayerTextureMipmaps?: boolean;
    isHalfFloat?: boolean;
}

/**
 * @deprecated use createRasterMaterials
 */
export async function createRasterMaterial(params: RasterMaterialUpdateParams) {
    return (await createRasterMaterials(params))[0];
}

export async function createRasterMaterials(params: RasterMaterialUpdateParams): Promise<ShaderMaterial[]> {
    const width = params?.srcTexture?.image.width ?? 1;
    const height = params?.srcTexture?.image.height ?? 1;

    const shaders = await createLayerShader({
        vertexShaderSetup: rasterMaterialVertexShaderSetup,
        vertexShaderMain: rasterMaterialVertexShaderMain,
        fragmentShaderSetup: rasterMaterialFragmentShaderSetup,
        fragmentShaderMain: rasterMaterialFragmentShaderMain,
        canvasFilters: params.canvasFilters ?? [],
        width,
        height,
        useAutomaticLayerTextureMipmaps: params?.useAutomaticLayerTextureMipmaps,
    });

    const materials: ShaderMaterial[] = [];

    let srcTexture = params.srcTexture;
    for (const [shaderIndex, shader] of shaders.entries()) {
        const extendedBounds = shader.getExtendedBounds(params.canvasFilters);
        const { width: renderTargetWidth, height: renderTargetHeight } = limitMaxDimension(
            width + extendedBounds[0] + extendedBounds[2],
            height + extendedBounds[1] + extendedBounds[3],
            params.canvasFilters?.[0]?.maxPassTextureSize ?? Infinity,
        );

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
                getExtendedBounds: shader.getExtendedBounds,
                extendedBounds,
                disposableTextures: shader.textures,
                shouldCaptureSource: shader.shouldCaptureSource,
            },
            premultipliedAlpha: params.premultiplyAlphaFix ?? false,
        });

        material.defines.cColorSpaceConversion = params.colorSpaceConversion ?? 0;
        material.defines.cPremultiplyAlphaFix = params.premultiplyAlphaFix ? 1 : 0;
        material.uniforms.srcTexture = {
            value: srcTexture,
        };
        if (shaderIndex > 0) {
            const renderTarget = new WebGLRenderTarget(renderTargetWidth, renderTargetHeight, {
                format: RGBAFormat,
                type: params.isHalfFloat ? HalfFloatType : UnsignedByteType,
                depthBuffer: false,
                stencilBuffer: false,
            });
            material.userData.srcRenderTarget = renderTarget;
            material.userData.disposableTextures.push(renderTarget);
            material.uniforms.passTexture = {
                value: renderTarget.texture,
            };
            if (shader.shouldCaptureSource) {
                srcTexture = renderTarget.texture;
            }
        }
        material.uniforms.dstTexture = {
            value: undefined,
        };
        material.uniforms.opacity = {
            value: params.opacity ?? 1,
        };
        material.needsUpdate = true;

        materials.push(material);
    }

    return materials;
}

/**
 * @deprecated use updateRasterMaterials
 */
export async function updateRasterMaterial(
    material: ShaderMaterial,
    params: RasterMaterialUpdateParams,
) {
    return (await updateRasterMaterials([material], params))[0];
}

export async function updateRasterMaterials(
    materials: ShaderMaterial[],
    params: RasterMaterialUpdateParams,
) {
    let isSourceTextureUpdate = false;
    let srcTexture: Texture | undefined = undefined;

    for (const [materialIndex, material] of materials.entries()) {
        const extendedBounds = (material.userData.getExtendedBounds?.(params.canvasFilters)) ?? [0, 0, 0, 0];
        material.userData.extendedBounds = extendedBounds;
        if (materialIndex === 0) {
            if (material.uniforms.srcTexture.value !== params.srcTexture) {
                isSourceTextureUpdate = true;
                srcTexture = params.srcTexture;
                if (!params.srcTexture?.userData.isDraft) {
                    material.uniforms.srcTexture.value?.dispose(); // Prevent GPU memory leak. If it's still needed, THREE will re-upload.
                }
                material.uniforms.srcTexture.value = params.srcTexture;
                if (params.srcTexture) {
                    material.defines.cLayerWidth = params.srcTexture?.width;
                    material.defines.cLayerHeight = params.srcTexture?.height;
                }
            }
        } else {
            createRenderTarget:
            if (isSourceTextureUpdate && params.srcTexture) {
                material.uniforms.srcTexture.value = srcTexture;
                material.defines.cLayerWidth = params.srcTexture?.width;
                material.defines.cLayerHeight = params.srcTexture?.height;
                const { width: renderTargetWidth, height: renderTargetHeight } = limitMaxDimension(
                    params.srcTexture.width + extendedBounds[0] + extendedBounds[2],
                    params.srcTexture.height + extendedBounds[1] + extendedBounds[3],
                    params.canvasFilters?.[0]?.maxPassTextureSize ?? Infinity,
                );
                if (material.userData.srcRenderTarget?.width === renderTargetWidth && material.userData.srcRenderTarget?.height === renderTargetHeight) {
                    break createRenderTarget;
                }
                const renderTargetIndex = material.userData.disposableTextures.findIndex(
                    (otherRenderTarget) => otherRenderTarget === material.userData.srcRenderTarget,
                );
                if (renderTargetIndex > -1) {
                    material.userData.disposableTextures.splice(renderTargetIndex, 1);
                }
                material.userData.srcRenderTarget?.dispose();
                const renderTarget = new WebGLRenderTarget(renderTargetWidth, renderTargetHeight, {
                    format: RGBAFormat,
                    type: params.isHalfFloat ? HalfFloatType : UnsignedByteType,
                    depthBuffer: false,
                    stencilBuffer: false,
                });
                material.userData.srcRenderTarget = renderTarget;
                material.userData.disposableTextures.push(renderTarget);
                material.uniforms.passTexture = {
                    value: renderTarget.texture,
                };
                if (material.userData.shouldCaptureSource) {
                    srcTexture = renderTarget.texture;
                }
            }
        }

        const colorSpaceConversion = params.colorSpaceConversion ?? 0;
        if (colorSpaceConversion !== material.defines.cColorSpaceConversion) {
            material.defines.cColorSpaceConversion = colorSpaceConversion;
        }
        const premultiplyAlphaFix = params.premultiplyAlphaFix ? 1 : 0;
        if (premultiplyAlphaFix !== material.defines.cPremultiplyAlphaFix) {
            material.defines.cPremultiplyAlphaFix = premultiplyAlphaFix;
        }
        if (params.opacity != null && material.uniforms.opacity.value !== params.opacity) {
            material.uniforms.opacity.value = params.opacity;
        }
        material.needsUpdate = true;
    }
}

/**
 * @deprecated use disposeRasterMaterials
 */
export async function disposeRasterMaterial(material: ShaderMaterial) {
    return (await disposeRasterMaterials([material]))[0];
}

export async function disposeRasterMaterials(materials: ShaderMaterial[]) {
    for (const material of materials) {
        for (const texture of material.userData.disposableTextures ?? []) {
            texture.dispose();
        }
        material.uniforms = {};
        material.dispose();
    }
}
