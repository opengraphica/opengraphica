import { camelCaseToKebabCase } from "@/lib/string";
import { Texture } from 'three/src/textures/Texture';

import type { IUniform } from 'three/src/renderers/shaders/UniformsLib';
import type { Webgl2RendererCanvasFilter, WorkingFileLayerFilter } from '@/types';

export async function getCanvasFilterClass(name: string): Promise<new (...args: any) => Webgl2RendererCanvasFilter> {
    const kebabCaseName = camelCaseToKebabCase(name);
    return (await import(/* webpackChunkName: 'layer-filter-[request]' */ `./${kebabCaseName}`)).default;
}

interface CreateFiltersOptions {
    createDisabled?: boolean;
}

export async function createFiltersFromLayerConfig(filterConfigs: WorkingFileLayerFilter[], options: CreateFiltersOptions = {}): Promise<Array<Webgl2RendererCanvasFilter | null>> {
    const canvasFilters: Array<Webgl2RendererCanvasFilter | null> = [];
    for (const filterConfig of filterConfigs) {
        if (!filterConfig.disabled || options.createDisabled) {
            const canvasFilter = new (await getCanvasFilterClass(filterConfig.name))();
            const kebabCaseName = camelCaseToKebabCase(filterConfig.name);
            canvasFilter.fragmentShader = (await import(/* webpackChunkName: 'layer-filter-[request]' */ `@/renderers/webgl2/backend/filters/${kebabCaseName}.frag`)).default
            canvasFilter.maskId = filterConfig.maskId;
            canvasFilter.params = filterConfig.params ?? {};
            canvasFilters.push(canvasFilter);
        }
    }
    return canvasFilters;
}

export function applyCanvasFilter(imageData: ImageData, canvasFilter: Webgl2RendererCanvasFilter, paramData?: Record<string, unknown>): ImageData {
    const originalParams = canvasFilter.params;
    if (paramData) {
        canvasFilter.params = paramData;
    }
    const appliedImageData = new ImageData(imageData.width, imageData.height);
    const imageDataSize = imageData.width * imageData.height * 4;
    const data = imageData.data;
    const appliedData = appliedImageData.data;
    for (let i = 0; i < imageDataSize; i += 4) {
        // canvasFilter.fragment(data, appliedData, i, imageData.width, imageData.height);
    }
    if (paramData) {
        canvasFilter.params = originalParams;
    }
    return appliedImageData;
}

export function buildCanvasFilterParamsFromFormData(canvasFilter: Webgl2RendererCanvasFilter, formData: Record<string,unknown>): Record<string, unknown> {
    const params: Record<string, unknown> = {};
    const editConfig = canvasFilter.getEditConfig();
    for (const paramName in editConfig) {
        const paramConfig = editConfig[paramName];
        if (paramConfig.type === 'computedFloat') {
            const referenceParamName = paramConfig.valueMap.referenceParam;
            params[paramName] = paramConfig.valueMap.map[(formData[referenceParamName] ?? canvasFilter.params[referenceParamName]) as number];
        } else {
            params[paramName] = formData[paramName] ?? canvasFilter.params[paramName];
        }
    }
    return params;
}

export function buildCanvasFilterPreviewParams(canvasFilter: Webgl2RendererCanvasFilter): Record<string, unknown> {
    const filterEditConfig = canvasFilter.getEditConfig();
    const previewParams: Record<string, unknown> = {};
    for (const paramName in filterEditConfig) {
        previewParams[paramName] = filterEditConfig[paramName]?.preview ?? filterEditConfig[paramName].default;
    }
    return previewParams;
}

export interface CombinedFilterShaderResult {
    fragmentShader: string,
    vertexShader: string,
    uniforms: Record<string, IUniform>,
    defines: Record<string, unknown>,
    textures: Texture[],
}
