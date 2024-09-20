/**
 * This module facilitates WebGL material reuse, since creating a custom shader for every
 * layer will negatively impact performance. This allows the GPU to batch draw calls and also saves GPU memory.
 */

import { v4 as uuidv4 } from 'uuid';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import { FrontSide } from 'three/src/constants';
import { combineFiltersToShader, createFiltersFromLayerConfig, type CombinedFilterShaderResult } from '@/canvas/filters';

import { assignMaterialBlendModes } from './../blending';
import { rasterMaterialSetup } from './raster';
import { gradientMaterialSetup } from './gradient';

import type { RasterMaterialUpdateParams } from './raster';
import type { CanvasFilterLayerInfo, WorkingFileLayerBlendingMode, WorkingFileLayerFilter } from '@/types';

export type MaterialType = 'raster' | 'gradient';

export interface MaterialWapperUpdates {
    raster: RasterMaterialUpdateParams;
    gradient: RasterMaterialUpdateParams;
}

export interface MaterialWrapperSetup {
    vertexShaderSetup: string;
    vertexShaderMain: string;
    fragmentShaderSetup: string;
    fragmentShaderMain: string;

    init(material: ShaderMaterial, params: any): void;
    update(material: ShaderMaterial, params: any): boolean; // Return true if a new material should be generated.
    dispose(material: ShaderMaterial): void;
}

export interface MaterialWrapper<UpdateParams = {}> {
    uuid: string;
    type: MaterialType;
    material: ShaderMaterial;
    blendingMode: WorkingFileLayerBlendingMode;

    update(params: UpdateParams): MaterialWrapper<UpdateParams>;
    changeBlendingMode(blendingMode: WorkingFileLayerBlendingMode): MaterialWrapper<UpdateParams>;
}

const materialWrappersById = new Map<string, MaterialWrapper>();
const materialWrapperUserCount = new Map<string, number>();
const queuedDisposalMaterials = new Set<string>();

function shaderDefinesMatch(defines1: Record<string, any>, defines2: Record<string, any>): boolean {
    const keys1 = Object.keys(defines1);
    const keys2 = Object.keys(defines2);
    if (keys1.length !== keys2.length) return false;
    for (const key of keys1) {
        if (defines1[key] !== defines2[key]) {
            return false;
        }
    }
    return true;
}

/**
 * Creates a new material if an equivalent does not already exist.
 */
export async function createMaterial<T extends MaterialType>(
    type: T,
    initParams: MaterialWapperUpdates[T],
    canvasFilters: WorkingFileLayerFilter[],
    canvasFilterLayerInfo: CanvasFilterLayerInfo,
    blendingMode: WorkingFileLayerBlendingMode = 'normal',
): Promise<MaterialWrapper<MaterialWapperUpdates[T]>> {
    let vertexShaderSetup = '';
    let vertexShaderMain = '';
    let fragmentShaderSetup = '';
    let fragmentShaderMain = '';
    let init!: MaterialWrapperSetup['init'];
    let update!: MaterialWrapperSetup['update'];

    switch (type) {
        case 'raster':
            ({
                vertexShaderSetup,
                vertexShaderMain,
                fragmentShaderSetup,
                fragmentShaderMain,
                init,
                update,
            } = rasterMaterialSetup);
            break;
        case 'gradient':
            ({
                vertexShaderSetup,
                vertexShaderMain,
                fragmentShaderSetup,
                fragmentShaderMain,
                init,
                update,
            } = gradientMaterialSetup);
            break;
    }

    const combinedShaderResult = combineFiltersToShader(
        await createFiltersFromLayerConfig(canvasFilters),
        canvasFilterLayerInfo,
        {
            vertexShaderSetup,
            vertexShaderMain,
            fragmentShaderSetup,
            fragmentShaderMain,
        }
    );

    let existingMaterial: ShaderMaterial | undefined;

    for (const [existingUuid, existingMaterialWrapper] of materialWrappersById.entries()) {
        if (
            existingMaterialWrapper.type === type &&
            existingMaterialWrapper.blendingMode === blendingMode &&
            combinedShaderResult.fragmentShader === existingMaterialWrapper.material.fragmentShader &&
            combinedShaderResult.vertexShader === existingMaterialWrapper.material.vertexShader &&
            shaderDefinesMatch(combinedShaderResult.defines, existingMaterialWrapper.material.defines)
        ) {
            // const existingUserCount = materialWrapperUserCount.get(existingUuid) ?? 0;
            // materialWrapperUserCount.set(existingUuid, existingUserCount + 1);
            // queuedDisposalMaterials.delete(existingUuid);
            // return existingMaterialWrapper;
            existingMaterial = existingMaterialWrapper.material.clone();
            break;
        }
    }

    return createMaterialWrapper(type, initParams, combinedShaderResult, blendingMode, init, update, existingMaterial);
}

function createMaterialWrapper<T extends MaterialType>(
    type: T,
    initParams: Record<string, any>,
    combinedShaderResult: CombinedFilterShaderResult,
    blendingMode: WorkingFileLayerBlendingMode,
    init: MaterialWrapperSetup['init'],
    update: MaterialWrapperSetup['update'],
    materialOverride?: ShaderMaterial,
) {
    const uuid = uuidv4();
    const material = materialOverride ?? new ShaderMaterial({
        transparent: true,
        depthTest: false,
        vertexShader: combinedShaderResult.vertexShader,
        fragmentShader: combinedShaderResult.fragmentShader,
        side: FrontSide,
        defines: {
            ...combinedShaderResult.defines,
        },
        uniforms: {
            ...combinedShaderResult.uniforms,
        },
        userData: {
            uuid,
        },
    });
    assignMaterialBlendModes(material, blendingMode);
    init(material, initParams);
    let lastUpdate: MaterialWapperUpdates[T] | undefined;
    const materialWrapper: MaterialWrapper<MaterialWapperUpdates[T]> = {
        uuid,
        type,
        material,
        blendingMode,
        update(updateParams) {
            lastUpdate = updateParams;
            const needsNewMaterial = update(this.material, updateParams);
            if (needsNewMaterial) {
                disposeMaterial(materialWrapper);
                return createMaterialWrapper(type, lastUpdate, combinedShaderResult, blendingMode, init, update);
            }
            return materialWrapper;
        },
        changeBlendingMode(newBlendingMode) {
            disposeMaterial(materialWrapper);
            let existingMaterial: ShaderMaterial | undefined;
            for (const [existingUuid, existingMaterialWrapper] of materialWrappersById.entries()) {
                if (
                    existingMaterialWrapper.type === type &&
                    existingMaterialWrapper.blendingMode === newBlendingMode &&
                    combinedShaderResult.fragmentShader === existingMaterialWrapper.material.fragmentShader &&
                    combinedShaderResult.vertexShader === existingMaterialWrapper.material.vertexShader &&
                    shaderDefinesMatch(combinedShaderResult.defines, existingMaterialWrapper.material.defines)
                ) {
                    // const existingUserCount = materialWrapperUserCount.get(existingUuid) ?? 0;
                    // materialWrapperUserCount.set(existingUuid, existingUserCount + 1);
                    // queuedDisposalMaterials.delete(existingUuid);
                    // return existingMaterialWrapper;
                    existingMaterial = existingMaterialWrapper.material.clone();
                    break;
                }
            }
            return createMaterialWrapper(type, lastUpdate ?? initParams, combinedShaderResult, newBlendingMode, init, update, existingMaterial);
        },
    }
    materialWrappersById.set(uuid, materialWrapper);
    materialWrapperUserCount.set(uuid, 1);
    return materialWrapper;
}

export async function disposeMaterial(materialWrapper: MaterialWrapper) {
    const { uuid } = materialWrapper;
    let userCount = (materialWrapperUserCount.get(uuid) ?? 0) - 1;
    if (userCount < 0) {
        userCount = 0;
    }
    materialWrapperUserCount.set(uuid, userCount);
    if (userCount === 0) {
        queuedDisposalMaterials.add(uuid);
        // Wait for disposal; it is fairly common materials are disposed and re-created immediately.
        setTimeout(disposeMaterialDeferred.bind(null, materialWrapper), 1);
    }
}

function disposeMaterialDeferred(materialWrapper: MaterialWrapper) {
    const { uuid, type, material } = materialWrapper;
    if (!queuedDisposalMaterials.has(uuid)) return;
    switch (type) {
        case 'raster':
            rasterMaterialSetup.dispose(material);
            break;
        case 'gradient':
            gradientMaterialSetup.dispose(material);
            break;
    }
    material.dispose();
    materialWrappersById.delete(uuid);
    materialWrapperUserCount.delete(uuid);
    queuedDisposalMaterials.delete(uuid);
}

