import {
    NormalBlending,
    CustomBlending,
    AddEquation,
    SubtractEquation,
    SrcAlphaFactor,
    OneMinusSrcAlphaFactor,
    DstColorFactor,
    OneFactor,
    ZeroFactor,
} from 'three/src/constants';

import type { Material } from 'three/src/materials/Material';
import type { Blending, BlendingEquation, BlendingDstFactor } from 'three/src/constants';
import type { WorkingFileLayerBlendingMode } from "@/types";

interface BlendModes {
    blending: Blending;
    blendEquation: BlendingEquation;
    blendSrc: BlendingDstFactor;
    blendDst: BlendingDstFactor;
    blendEquationAlpha: BlendingEquation | null;
    blendSrcAlpha: BlendingDstFactor | null;
    blendDstAlpha: BlendingDstFactor | null;
}

export function getBlendModes(layerBlendingMode: WorkingFileLayerBlendingMode): BlendModes {
    let blending = NormalBlending;
    let blendEquation = AddEquation;
    let blendSrc = SrcAlphaFactor;
    let blendDst = OneMinusSrcAlphaFactor;
    let blendEquationAlpha: BlendingEquation | null = null;
    let blendSrcAlpha: BlendingDstFactor | null = null;
    let blendDstAlpha: BlendingDstFactor | null = null;
    switch (layerBlendingMode) {
        case 'erase':
            blending = CustomBlending;
            blendEquation = AddEquation;
            blendSrc = ZeroFactor;
            blendDst = DstColorFactor;
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

export function assignMaterialBlendModes(material: Material, layerBlendingMode: WorkingFileLayerBlendingMode) {
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
}
