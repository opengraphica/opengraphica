import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import { DoubleSide } from 'three/src/constants';

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
        }
    });
}
