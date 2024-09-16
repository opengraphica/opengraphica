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

enum LayerBlendingMode {
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

    addition = 10,
    darkenOnly = 11,
    lumaDarkenOnly = 12,
    multiply = 13,
    burn = 14,
    linearBurn = 15,

    overlay = 16,
    softLight = 17,
    hardLight = 18,
    vividLight = 19,
    pinLight = 20,
    linearLight = 21,
    hardMix = 22,

    difference = 23,
    exclusion = 24,
    subtract = 25,
    grainExtract = 26,
    grainMerge = 27,
    divide = 28,

    hue = 29,
    color = 30,
    value = 31,
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
    let blending = NormalBlending;
    let blendEquation = AddEquation;
    let blendSrc = SrcAlphaFactor;
    let blendDst = OneMinusSrcAlphaFactor;
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
