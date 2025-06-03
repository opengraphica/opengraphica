import {
    NormalBlending,
    CustomBlending,
    MultiplyBlending,
    AddEquation,
    MaxEquation,
    MinEquation,
    SubtractEquation,
    SrcAlphaFactor,
    OneMinusSrcColorFactor,
    OneMinusSrcAlphaFactor,
    SrcColorFactor,
    DstColorFactor,
    OneMinusDstColorFactor,
    OneFactor,
    ZeroFactor,
} from 'three/src/constants';

import type { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import type { Blending, BlendingEquation, BlendingDstFactor } from 'three/src/constants';
import type { WorkingFileLayerBlendingMode } from "@/types";

export enum LayerBlendingMode {
    normal = 0,
    dissolve = 1,
    colorErase = 2,
    erase = 3,
    merge = 4,
    split = 5,

    lightenOnly = 6,
    lumaLightenOnly = 7,
    screen = 8,
    dodge = 9,
    linearDodge = 10,
    addition = 11,

    darkenOnly = 12,
    lumaDarkenOnly = 13,
    multiply = 14,
    burn = 15,
    linearBurn = 16,

    overlay = 17,
    softLight = 18,
    hardLight = 19,
    vividLight = 20,
    pinLight = 21,
    linearLight = 22,
    hardMix = 23,

    difference = 24,
    exclusion = 25,
    subtract = 26,
    grainExtract = 27,
    grainMerge = 28,
    divide = 29,

    hue = 30,
    chroma = 31,
    color = 32,
    lightness = 33,
    luminance = 34,
}

interface MaterialBlendModes {
    blending: Blending;
    blendEquation: BlendingEquation;
    blendSrc: BlendingDstFactor;
    blendDst: BlendingDstFactor;
    blendEquationAlpha: BlendingEquation | null;
    blendSrcAlpha: BlendingDstFactor | null;
    blendDstAlpha: BlendingDstFactor | null;
}

export function getBlendModes(layerBlendingMode: WorkingFileLayerBlendingMode): MaterialBlendModes {
    let blending: Blending = NormalBlending;
    let blendEquation = AddEquation;
    let blendSrc: BlendingDstFactor = SrcAlphaFactor;
    let blendDst: BlendingDstFactor = OneMinusSrcAlphaFactor;
    let blendEquationAlpha: BlendingEquation | null = null;
    let blendSrcAlpha: BlendingDstFactor | null = ZeroFactor;
    let blendDstAlpha: BlendingDstFactor | null = OneMinusSrcAlphaFactor;
    switch (layerBlendingMode) {
        case 'erase':
            blending = CustomBlending;
            blendEquation = AddEquation;
            blendSrc = ZeroFactor;
            blendDst = OneFactor;
            blendEquationAlpha = AddEquation;
            blendSrcAlpha = null;
            blendDstAlpha = OneMinusSrcAlphaFactor;
            break;
        case 'colorErase':
            blending = CustomBlending;
            blendEquation = AddEquation;
            blendSrc = OneFactor;
            blendDst = ZeroFactor;
            blendEquationAlpha = null;
            blendSrcAlpha = null;
            blendDstAlpha = null;
    }
    return {
        blending,
        blendEquation,
        blendSrc,
        blendDst,
        blendEquationAlpha,
        blendSrcAlpha,
        blendDstAlpha,
    };
}

export function assignMaterialBlendModes(material: ShaderMaterial, layerBlendingMode: WorkingFileLayerBlendingMode) {
    const {
        blending,
        blendEquation,
        blendSrc,
        blendDst,
        blendEquationAlpha,
        blendSrcAlpha,
        blendDstAlpha,
    } = getBlendModes(layerBlendingMode);
    material.blending = blending;
    material.blendEquation = blendEquation;
    material.blendSrc = blendSrc;
    material.blendDst = blendDst;
    material.blendEquationAlpha = blendEquationAlpha;
    material.blendSrcAlpha = blendSrcAlpha;
    material.blendDstAlpha = blendDstAlpha;
    material.defines.cLayerBlendingMode = LayerBlendingMode[layerBlendingMode as never];
    material.needsUpdate = true;
}
