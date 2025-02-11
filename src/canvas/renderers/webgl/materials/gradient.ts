import { Texture } from 'three/src/textures/Texture';

import { srgbaToLinearSrgba, linearSrgbaToSrgba, linearSrgbaToOklab, oklabToLinearSrgba } from '@/lib/color';
import { generateGradientImage } from '@/lib/gradient';
import { generateObjectHash, generateStringHash } from '@/lib/hash';
import { lerp } from '@/lib/math';

import { Vector2 } from 'three/src/math/Vector2';
import { SRGBColorSpace, LinearFilter } from 'three/src/constants';

import gradientMaterialVertexShaderSetup from '@/canvas/renderers/webgl/shaders/gradient-material.setup.vert';
import gradientMaterialVertexShaderMain from '@/canvas/renderers/webgl/shaders/gradient-material.main.vert';
import gradientMaterialFragmentShaderSetup from '@/canvas/renderers/webgl/shaders/gradient-material.setup.frag';
import gradientMaterialFragmentShaderMain from '@/canvas/renderers/webgl/shaders/gradient-material.main.frag';

import type { MaterialWrapperSetup } from './material-factory';
import type {
    WorkingFileGradientLayer, WorkingFileGradientColorStop, WorkingFileGradientColorSpace, RGBAColor,
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
    canvasWidth: number;
    canvasHeight: number;
    transform: DOMMatrix;
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

export const gradientMaterialSetup: MaterialWrapperSetup = {
    vertexShaderSetup: gradientMaterialVertexShaderSetup,
    vertexShaderMain: gradientMaterialVertexShaderMain,
    fragmentShaderSetup: gradientMaterialFragmentShaderSetup,
    fragmentShaderMain: gradientMaterialFragmentShaderMain,

    init(material, { gradientData, canvasWidth, canvasHeight, transform }: GradientMaterialUpdateParams) {
        const cCanvasWidth = canvasWidth;
        const cCanvasHeight = canvasHeight;
        const cBlendColorSpace = GradientColorSpace[gradientData.blendColorSpace];
        const cFillType = GradientFillType[gradientData.fillType];
        const cSpreadMethod = GradientSpreadMethod[gradientData.spreadMethod];
        const cAverageBrightness = calculateGradientAverageBrightness(gradientData.stops);

        material.defines.cCanvasWidth = cCanvasWidth;
        material.defines.cCanvasHeight = cCanvasHeight;
        material.defines.cBlendColorSpace = cBlendColorSpace;
        material.defines.cFillType = cFillType;
        material.defines.cSpreadMethod = cSpreadMethod;
        material.defines.cAverageBrightness = cAverageBrightness;

        const newStopsHash = generateObjectHash(gradientData.stops) + generateStringHash(gradientData.blendColorSpace) + generateStringHash(material.userData.uuid);
        const newStopsTexture = createGradientStopTexture(gradientData.stops, gradientData.blendColorSpace);
        generatedGradientStopTextures.set(newStopsHash, newStopsTexture);
        material.uniforms.stops = { value: newStopsTexture };

        const startTransformed = new DOMPoint(gradientData.start.x, gradientData.start.y).matrixTransform(transform);
        const endTransformed = new DOMPoint(gradientData.end.x, gradientData.end.y).matrixTransform(transform);
        const focusTransformed = new DOMPoint(gradientData.focus.x, gradientData.focus.y).matrixTransform(transform);
        material.uniforms.start = { value: new Vector2(startTransformed.x, startTransformed.y) };
        material.uniforms.end = { value: new Vector2(endTransformed.x, endTransformed.y) };
        material.uniforms.focus = { value: new Vector2(focusTransformed.x, focusTransformed.y) };
        material.uniforms.dstTexture = { value: undefined };

        material.userData.blendColorSpace = gradientData.blendColorSpace;
        material.userData.stopsHash = newStopsHash;
        material.userData.transform = transform;
        material.needsUpdate = true;
    },

    update(material, { gradientData, canvasWidth, canvasHeight, transform }: GradientMaterialUpdateParams) {
        let needsNewMaterial = false;
        let isNewMaterial = material.defines.cBlendColorSpace == null;

        const cCanvasWidth = canvasWidth;
        const cCanvasHeight = canvasHeight;
        const cBlendColorSpace = GradientColorSpace[gradientData.blendColorSpace];
        const cFillType = GradientFillType[gradientData.fillType];
        const cSpreadMethod = GradientSpreadMethod[gradientData.spreadMethod];
        const cAverageBrightness = calculateGradientAverageBrightness(gradientData.stops);
        if (
            !isNewMaterial &&
            (
                material.defines.cCanvasWidth !== cCanvasWidth ||
                material.defines.cCanvasHeight !== cCanvasHeight ||
                material.defines.cBlendColorSpace !== cBlendColorSpace ||
                material.defines.cFillType !== cFillType ||
                material.defines.cSpreadMethod !== cSpreadMethod ||
                material.defines.cAverageBrightness !== cAverageBrightness
            )
        ) {
            needsNewMaterial = true;
        }
        if (isNewMaterial) {
            material.defines.cCanvasWidth = cCanvasWidth;
            material.defines.cCanvasHeight = cCanvasHeight;
            material.defines.cBlendColorSpace = cBlendColorSpace;
            material.defines.cFillType = cFillType;
            material.defines.cSpreadMethod = cSpreadMethod;
            material.defines.cAverageBrightness = cAverageBrightness;
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
        const startTransformed = new DOMPoint(gradientData.start.x, gradientData.start.y).matrixTransform(transform);
        const endTransformed = new DOMPoint(gradientData.end.x, gradientData.end.y).matrixTransform(transform);
        const focusTransformed = new DOMPoint(gradientData.focus.x, gradientData.focus.y).matrixTransform(transform);
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

        return needsNewMaterial;
    },

    dispose(material) {
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
        material.userData = {};
        material.needsUpdate = true;
    },
};
