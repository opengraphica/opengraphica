import { Texture } from 'three/src/textures/Texture';

import { srgbaToLinearSrgba, linearSrgbaToSrgba, linearSrgbaToOklab, oklabToLinearSrgba } from '@/lib/color';
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
