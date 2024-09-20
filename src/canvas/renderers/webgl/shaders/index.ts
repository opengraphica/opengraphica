import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import { Texture } from 'three/src/textures/Texture';
import { Vector2 } from 'three/src/math/Vector2';
import { FrontSide, DoubleSide, CustomBlending, ZeroFactor, OneFactor, sRGBEncoding, LinearFilter } from 'three/src/constants';

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

/*-----------------------*\
| Gradient Layer Material |
\*-----------------------*/

enum GradientColorSpace {
    'oklab' = 0,
    'srgb' = 1,
    'linearSrgb' = 2,
}
enum GradientFillType {
    'linear' = 0,
    'radial' = 1,
}
enum GradientSpreadMethod {
    'pad' = 0,
    'repeat' = 1,
    'reflect' = 2,
    'truncate' = 3,
}
function createGradientStopTexture(stops: WorkingFileGradientColorStop<RGBAColor>[], colorSpace: WorkingFileGradientColorSpace, textureSize: number = 64): Texture {
    const gradientImageData = new ImageData(textureSize, 1);
    stops.sort((a, b) => a.offset < b.offset ? -1 : 1);
    let leftStopIndex = stops[0].offset > 0 ? -1 : 0;
    let leftOffset = 0;
    let leftColor = stops[0].color as RGBAColor;
    const rightStopIndex = Math.min(leftStopIndex + 1, stops.length - 1);
    let rightOffset = stops[rightStopIndex].offset;
    let rightColor = (stops[rightStopIndex].color) as RGBAColor;
    for (let i = 0; i < textureSize; i++) {
        const currentStopOffset = i / (textureSize - 1);
        if (currentStopOffset > rightOffset) {
            leftStopIndex += 1;
            const leftStop = stops[Math.min(leftStopIndex, stops.length - 1)];
            const rightStop = stops[Math.min(leftStopIndex + 1, stops.length - 1)];
            leftOffset = leftStop.offset;
            leftColor = leftStop.color as RGBAColor;
            rightOffset = leftStopIndex + 1 > stops.length - 1 ? 1 : rightStop.offset;
            rightColor = rightStop.color as RGBAColor;
        }
        const interpolateOffset = (rightOffset - leftOffset > 0) ? (currentStopOffset - leftOffset) / (rightOffset - leftOffset) : 0;
        let interpolatedColor = leftColor;
        if (colorSpace === 'oklab') {
            const leftColorTransfer = linearSrgbaToOklab(srgbaToLinearSrgba(leftColor));
            const rightColorTransfer = linearSrgbaToOklab(srgbaToLinearSrgba(rightColor));
            interpolatedColor = linearSrgbaToSrgba(oklabToLinearSrgba({
                l: lerp(leftColorTransfer.l, rightColorTransfer.l, interpolateOffset),
                a: lerp(leftColorTransfer.a, rightColorTransfer.a, interpolateOffset),
                b: lerp(leftColorTransfer.b, rightColorTransfer.b, interpolateOffset),
                alpha: lerp(leftColorTransfer.alpha, rightColorTransfer.alpha, interpolateOffset),
            }));
        } else if (colorSpace === 'linearSrgb') {
            const leftColorTransfer = srgbaToLinearSrgba(leftColor);
            const rightColorTransfer = srgbaToLinearSrgba(rightColor);
            interpolatedColor = linearSrgbaToSrgba({
                r: lerp(leftColorTransfer.r, rightColorTransfer.r, interpolateOffset),
                g: lerp(leftColorTransfer.g, rightColorTransfer.g, interpolateOffset),
                b: lerp(leftColorTransfer.b, rightColorTransfer.b, interpolateOffset),
                alpha: lerp(leftColorTransfer.alpha, rightColorTransfer.alpha, interpolateOffset),
            });
        } else {
            interpolatedColor = {
                is: 'color',
                r: lerp(leftColor.r, rightColor.r, interpolateOffset),
                g: lerp(leftColor.g, rightColor.g, interpolateOffset),
                b: lerp(leftColor.b, rightColor.b, interpolateOffset),
                alpha: lerp(leftColor.alpha, rightColor.alpha, interpolateOffset),
                style: leftColor.style,
            }
        }
        gradientImageData.data[(i * 4)] = Math.round(255 * interpolatedColor.r);
        gradientImageData.data[(i * 4) + 1] = Math.round(255 * interpolatedColor.g);
        gradientImageData.data[(i * 4) + 2] = Math.round(255 * interpolatedColor.b);
        gradientImageData.data[(i * 4) + 3] = Math.round(255 * interpolatedColor.alpha);
    }
    const canvas = document.createElement('canvas');
    canvas.width = gradientImageData.width;
    canvas.height = gradientImageData.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.putImageData(gradientImageData, 0, 0);
    }
    const texture = new Texture(canvas);
    texture.encoding = sRGBEncoding;
    texture.generateMipmaps = false;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearFilter;
    texture.needsUpdate = true;
    return texture;
}
export function calculateGradientAverageBrightness(stops: WorkingFileGradientColorStop<RGBAColor>[]) {
    let brightnessAccumulator = 0;
    for (const stop of stops) {
        brightnessAccumulator += linearSrgbaToOklab(srgbaToLinearSrgba(stop.color)).l;
    }
    return brightnessAccumulator / stops.length;
}
export function createGradientShaderMaterial(
    params: WorkingFileGradientLayer<RGBAColor>['data'],
    canvasWidth: number,
    canvasHeight: number,
    transform: DOMMatrix,
    combinedShaderResult: CombinedFilterShaderResult
): ShaderMaterial {
    const startTransformed = new DOMPoint(params.start.x, params.start.y).matrixTransform(transform);
    const endTransformed = new DOMPoint(params.end.x, params.end.y).matrixTransform(transform);
    const focusTransformed = new DOMPoint(params.focus.x, params.focus.y).matrixTransform(transform);
    return new ShaderMaterial({
        transparent: true,
        depthTest: false,
        vertexShader: combinedShaderResult.vertexShader,
        fragmentShader: combinedShaderResult.fragmentShader,
        side: FrontSide,
        defines: {
            cLayerBlendingMode: 0,
            cCanvasWidth: canvasWidth,
            cCanvasHeight: canvasHeight,
            cBlendColorSpace: GradientColorSpace[params.blendColorSpace],
            cFillType: GradientFillType[params.fillType],
            cSpreadMethod: GradientSpreadMethod[params.spreadMethod],
            cAverageBrightness: calculateGradientAverageBrightness(params.stops),
            ...combinedShaderResult.defines,
        },
        uniforms: {
            gradientMap: { value: createGradientStopTexture(params.stops, params.blendColorSpace) },
            start: { value: new Vector2(startTransformed.x, startTransformed.y) },
            end: { value: new Vector2(endTransformed.x, endTransformed.y) },
            focus: { value: new Vector2(focusTransformed.x, focusTransformed.y) },
            dstTexture: { value: undefined },
            ...combinedShaderResult.uniforms
        },
        userData: {
            blendColorSpace: params.blendColorSpace,
            stops: params.stops,
            transform: transform,
        },
    });
}
export function updateGradientShaderMaterial(
    material: ShaderMaterial,
    params: WorkingFileGradientLayer<RGBAColor>['data'],
    canvasWidth: number,
    canvasHeight: number,
    transform: DOMMatrix
) {
    material.defines.cLayerBlendingMode = 0;
    material.defines.cCanvasWidth = canvasWidth;
    material.defines.cCanvasHeight = canvasHeight;
    material.defines.cBlendColorSpace = GradientColorSpace[params.blendColorSpace];
    material.defines.cFillType = GradientFillType[params.fillType];
    material.defines.cSpreadMethod = GradientSpreadMethod[params.spreadMethod];
    material.defines.cAverageBrightness = calculateGradientAverageBrightness(params.stops);
    let hasStopsChanged = params.stops.length !== material.userData.stops?.length;
    if (!hasStopsChanged) {
        for (const [stopIndex, stop] of params.stops.entries()) {
            if (
                material.userData.stops?.[stopIndex].offset !== stop.offset ||
                material.userData.stops?.[stopIndex]?.color?.r !== stop.color.r ||
                material.userData.stops?.[stopIndex]?.color?.g !== stop.color.g ||
                material.userData.stops?.[stopIndex]?.color?.b !== stop.color.b ||
                material.userData.stops?.[stopIndex]?.color?.alpha !== stop.color.alpha
            ) {
                hasStopsChanged = true;
                break;
            }
        }
    }
    if (hasStopsChanged || params.blendColorSpace !== material.userData.blendColorSpace) {
        material.uniforms.gradientMap.value?.dispose();
        material.uniforms.gradientMap.value = createGradientStopTexture(params.stops, params.blendColorSpace);
    }
    const hasTransformChanged = transform != material.userData.transform;
    const startTransformed = new DOMPoint(params.start.x, params.start.y).matrixTransform(transform);
    const endTransformed = new DOMPoint(params.end.x, params.end.y).matrixTransform(transform);
    const focusTransformed = new DOMPoint(params.focus.x, params.focus.y).matrixTransform(transform);
    if (hasTransformChanged || startTransformed.x !== material.uniforms.start.value.x || startTransformed.y !== material.uniforms.start.value.y) {
        material.uniforms.start.value = new Vector2(startTransformed.x, startTransformed.y);
    }
    if (hasTransformChanged || endTransformed.x !== material.uniforms.end.value.x || endTransformed.y !== material.uniforms.end.value.y) {
        material.uniforms.end.value = new Vector2(endTransformed.x, endTransformed.y);
    }
    if (hasTransformChanged || focusTransformed.x !== material.uniforms.focus.value.x || focusTransformed.y !== material.uniforms.focus.value.y) {
        material.uniforms.focus.value = new Vector2(focusTransformed.x, focusTransformed.y);
    }
    material.userData.blendColorSpace = params.blendColorSpace;
    material.userData.stops = params.stops;
    material.userData.transform = transform;
    material.needsUpdate = true;
}
export function cleanGradientShaderMaterial(material: ShaderMaterial) {
    material.uniforms.gradientMap.value?.dispose();
    material.uniforms.gradientMap.value = null;
    delete material.uniforms.gradientMap;
    material.uniforms.start.value = null;
    delete material.uniforms.start;
    material.uniforms.end.value = null;
    delete material.uniforms.end;
    material.uniforms.focus.value = null;
    delete material.uniforms.focus;
    material.userData = {};
    material.needsUpdate = true;
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
