import { v4 as uuidv4 } from 'uuid';

import { FrontSide, LinearFilter, SRGBColorSpace } from 'three/src/constants';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import { Texture } from 'three/src/textures/Texture';
import { Vector2 } from 'three/src/math/Vector2';
import { Vector3 } from 'three/src/math/Vector3';

import { srgbaToLinearSrgba, linearSrgbaToOklab } from '@/lib/color';
import { generateGradientImage } from '@/lib/gradient';
import { generateObjectHash, generateStringHash } from '@/lib/hash';

import gradientMaterialVertexShaderSetup from './shader/setup.vert';
import gradientMaterialVertexShaderMain from './shader/main.vert';
import gradientMaterialFragmentShaderSetup from './shader/setup.frag';
import gradientMaterialFragmentShaderMain from './shader/main.frag';
import { createLayerShader, createLayerShaderUniformsAndDefines } from '../base/material';

import type { Matrix4 } from 'three';
import type {
    RGBAColor, Webgl2RendererCanvasFilter, WorkingFileGradientLayer,
    WorkingFileGradientColorStop, WorkingFileGradientColorSpace,
} from '@/types';

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

export interface GradientMaterialUpdateParams {
    gradientData: WorkingFileGradientLayer<RGBAColor>['data'];
    canvasWidth?: number;
    canvasHeight?: number;
    canvasFilters?: Webgl2RendererCanvasFilter[];
    transform: Matrix4;
}

const generatedGradientStopTextures = new Map<number, Texture>();

function createGradientStopTexture(
    stops: WorkingFileGradientColorStop<RGBAColor>[],
    colorSpace: WorkingFileGradientColorSpace,
    textureSize: number = 64
): Texture {
    const texture = new Texture(generateGradientImage(stops, colorSpace, textureSize));
    texture.colorSpace = SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearFilter;
    texture.needsUpdate = true;
    return texture;
}

function calculateGradientAverageBrightness(stops: WorkingFileGradientColorStop<RGBAColor>[]) {
    let brightnessAccumulator = 0;
    for (const stop of stops) {
        brightnessAccumulator += linearSrgbaToOklab(srgbaToLinearSrgba(stop.color)).l;
    }
    return brightnessAccumulator / stops.length;
}

export async function createGradientMaterial(
    { canvasFilters, canvasWidth, canvasHeight, gradientData, transform }: GradientMaterialUpdateParams
) {
    const uuid = uuidv4();

    const shader = await createLayerShader({
        vertexShaderSetup: gradientMaterialVertexShaderSetup,
        vertexShaderMain: gradientMaterialVertexShaderMain,
        fragmentShaderSetup: gradientMaterialFragmentShaderSetup,
        fragmentShaderMain: gradientMaterialFragmentShaderMain,
        canvasFilters: canvasFilters ?? [],
        width: canvasWidth ?? 1,
        height: canvasHeight ?? 1,
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

    if (gradientData) {
        const cBlendColorSpace = GradientColorSpace[gradientData.blendColorSpace];
        const cFillType = GradientFillType[gradientData.fillType];
        const cSpreadMethod = GradientSpreadMethod[gradientData.spreadMethod];
        const cAverageBrightness = calculateGradientAverageBrightness(gradientData.stops);
        material.defines.cBlendColorSpace = cBlendColorSpace;
        material.defines.cFillType = cFillType;
        material.defines.cSpreadMethod = cSpreadMethod;
        material.defines.cAverageBrightness = cAverageBrightness;
    }

    material.defines.cCanvasWidth = canvasWidth ?? 1;
    material.defines.cCanvasHeight = canvasHeight ?? 1;
    
    if (gradientData) {
        const newStopsHash = generateObjectHash(gradientData.stops) + generateStringHash(gradientData.blendColorSpace) + generateStringHash(uuid);
        const newStopsTexture = createGradientStopTexture(gradientData.stops, gradientData.blendColorSpace);
        generatedGradientStopTextures.set(newStopsHash, newStopsTexture);
        material.uniforms.stops = { value: newStopsTexture };

        const startTransformed = new Vector3(gradientData.start.x, gradientData.start.y, 1).applyMatrix4(transform);
        const endTransformed = new Vector3(gradientData.end.x, gradientData.end.y, 1).applyMatrix4(transform);
        const focusTransformed = new Vector3(gradientData.focus.x, gradientData.focus.y, 1).applyMatrix4(transform);
        material.uniforms.start = { value: new Vector2(startTransformed.x, startTransformed.y) };
        material.uniforms.end = { value: new Vector2(endTransformed.x, endTransformed.y) };
        material.uniforms.focus = { value: new Vector2(focusTransformed.x, focusTransformed.y) };

        material.userData.stopsHash = newStopsHash;
        material.userData.blendColorSpace = gradientData.blendColorSpace;
    } else {
        material.uniforms.stops = { value: undefined };
        material.uniforms.start = { value: new Vector2() };
        material.uniforms.end = { value: new Vector2() };
        material.uniforms.focus = { value: new Vector2() };
    }

    material.uniforms.dstTexture = { value: undefined };

    material.userData.uuid = uuid;
    material.userData.transform = transform;
    material.needsUpdate = true;

    return material;
}

export async function updateGradientMaterial(
    material: ShaderMaterial,
    { gradientData, canvasWidth, canvasHeight, transform }: GradientMaterialUpdateParams
) {
    const cCanvasWidth = canvasWidth;
    const cCanvasHeight = canvasHeight;
    const cBlendColorSpace = GradientColorSpace[gradientData.blendColorSpace];
    const cFillType = GradientFillType[gradientData.fillType];
    const cSpreadMethod = GradientSpreadMethod[gradientData.spreadMethod];
    const cAverageBrightness = calculateGradientAverageBrightness(gradientData.stops);
    if (
        material.defines.cCanvasWidth !== cCanvasWidth ||
        material.defines.cCanvasHeight !== cCanvasHeight ||
        material.defines.cBlendColorSpace !== cBlendColorSpace ||
        material.defines.cFillType !== cFillType ||
        material.defines.cSpreadMethod !== cSpreadMethod ||
        material.defines.cAverageBrightness !== cAverageBrightness
    ) {
        material.defines.cCanvasWidth = cCanvasWidth;
        material.defines.cCanvasHeight = cCanvasHeight;
        material.defines.cBlendColorSpace = cBlendColorSpace;
        material.defines.cFillType = cFillType;
        material.defines.cSpreadMethod = cSpreadMethod;
        material.defines.cAverageBrightness = cAverageBrightness;
        material.needsUpdate = true;
    }
    
    const newStopsHash = generateObjectHash(gradientData.stops) + generateStringHash(gradientData.blendColorSpace) + generateStringHash(material.userData.uuid);
    if (newStopsHash !== material.userData.stopsHash) {
        generatedGradientStopTextures.get(material.userData.stopsHash)?.dispose();
        generatedGradientStopTextures.delete(material.userData.stopsHash);
        const newStopsTexture = createGradientStopTexture(gradientData.stops, gradientData.blendColorSpace);
        generatedGradientStopTextures.set(newStopsHash, newStopsTexture);
        material.uniforms.stops.value = newStopsTexture;
    }
    const hasTransformChanged = transform != material.userData.transform;
    const startTransformed = new Vector3(gradientData.start.x, gradientData.start.y, 1).applyMatrix4(transform);
    const endTransformed = new Vector3(gradientData.end.x, gradientData.end.y, 1).applyMatrix4(transform);
    const focusTransformed = new Vector3(gradientData.focus.x, gradientData.focus.y, 1).applyMatrix4(transform);
    if (hasTransformChanged || startTransformed.x !== material.uniforms.start.value.x || startTransformed.y !== material.uniforms.start.value.y) {
        material.uniforms.start.value = new Vector2(startTransformed.x, startTransformed.y);
    }
    if (hasTransformChanged || endTransformed.x !== material.uniforms.end.value.x || endTransformed.y !== material.uniforms.end.value.y) {
        material.uniforms.end.value = new Vector2(endTransformed.x, endTransformed.y);
    }
    if (hasTransformChanged || focusTransformed.x !== material.uniforms.focus.value.x || focusTransformed.y !== material.uniforms.focus.value.y) {
        material.uniforms.focus.value = new Vector2(focusTransformed.x, focusTransformed.y);
    }
    material.userData.blendColorSpace = gradientData.blendColorSpace;
    material.userData.stopsHash = newStopsHash;
    material.userData.transform = transform;
    material.needsUpdate = true;
}

export async function disposeGradientMaterial(material: ShaderMaterial) {
    for (const texture of material.userData.disposableTextures ?? []) {
        texture.dispose();
    }
    generatedGradientStopTextures.get(material.userData.stopsHash)?.dispose();
    generatedGradientStopTextures.delete(material.userData.stopsHash);
    material.uniforms.stops.value = null;
    delete material.uniforms.stops;
    material.uniforms.start.value = null;
    delete material.uniforms.start;
    material.uniforms.end.value = null;
    delete material.uniforms.end;
    material.uniforms.focus.value = null;
    delete material.uniforms.focus;
    material.uniforms = {};
    material.userData = {};
    material.dispose();
}
