import { camelCaseToKebabCase } from "@/lib/string";

import basicMaterialVertexShader from '../renderers/webgl/shaders/basic-material.vert';
import basicMaterialFragmentShader from '../renderers/webgl/shaders/basic-material.frag';

import type { IUniform } from 'three/src/renderers/shaders/UniformsLib';
import type { CanvasFilter, WorkingFileLayerFilter } from '@/types';

export async function getCanvasFilterClass(name: string): Promise<new (...args: any) => CanvasFilter> {
    const kebabCaseName = camelCaseToKebabCase(name);
    return (await import(/* webpackChunkName: 'layer-filter-[request]' */ `./${kebabCaseName}/${kebabCaseName}`)).default;
}

export async function createFiltersFromLayerConfig(filterConfigs: WorkingFileLayerFilter[]): Promise<CanvasFilter[]> {
    const canvasFilters: CanvasFilter[] = [];
    for (const filterConfig of filterConfigs) {
        const canvasFilter = new (await getCanvasFilterClass(filterConfig.name))();
        canvasFilter.params = filterConfig.params ?? {};
        canvasFilters.push(canvasFilter);
    }
    return canvasFilters;
}

export function applyCanvasFilter(imageData: ImageData, canvasFilter: CanvasFilter, paramData?: Record<string, unknown>): ImageData {
    const originalParams = canvasFilter.params;
    if (paramData) {
        canvasFilter.params = paramData;
    }
    const appliedImageData = new ImageData(imageData.width, imageData.height);
    const imageDataSize = imageData.width * imageData.height * 4;
    const data = imageData.data;
    const appliedData = appliedImageData.data;
    for (let i = 0; i < imageDataSize; i += 4) {
        canvasFilter.fragment(data, appliedData, i);
    }
    if (paramData) {
        canvasFilter.params = originalParams;
    }
    return appliedImageData;
}

export function buildCanvasFilterPreviewParams(canvasFilter: CanvasFilter): Record<string, unknown> {
    const filterEditConfig = canvasFilter.getEditConfig();
    const previewParams: Record<string, unknown> = {};
    for (const paramName in filterEditConfig) {
        if (filterEditConfig[paramName]?.preview != null) {
            previewParams[paramName] = filterEditConfig[paramName]?.preview;
        }
    }
    return previewParams;
}

interface CombinedShaderResult {
    fragmentShader: string,
    vertexShader: string,
    uniforms: Record<string, IUniform>
}

export function generateShaderUniforms(canvasFilters: CanvasFilter[]): Record<string, IUniform> {
    const uniforms: Record<string, IUniform> = {};
    for (const [index, canvasFilter] of canvasFilters.entries()) {
        const editConfig = canvasFilter.getEditConfig();
        for (const editParamName in editConfig) {
            const replaceParamName = 'param' + index + '_' + editParamName;
            uniforms[replaceParamName] = {
                value: canvasFilter.params[editParamName] ?? editConfig[editParamName].default
            };
        }
    }
    return uniforms;
}

export function combineShaders(canvasFilters: CanvasFilter[]): CombinedShaderResult {
    let vertexShader = '';
    let fragmentShader = '';
    const uniforms: Record<string, IUniform> = {};

    let vertexShaderMainCalls: string[] = [];
    let fragmentShaderMainCalls: string[] = [];

    for (const [index, canvasFilter] of canvasFilters.entries()) {
        const editConfig = canvasFilter.getEditConfig();
        let filterVertexShader = canvasFilter.getVertexShader();
        let filterFragmentShader = canvasFilter.getFragmentShader();
        for (const editParamName in editConfig) {
            const searchParamName = 'p' + editParamName[0].toUpperCase() + editParamName.slice(1);
            const replaceParamName = 'param' + index + '_' + editParamName;
            const searchFunctionName = 'process' + canvasFilter.name[0].toUpperCase() + canvasFilter.name.slice(1);
            if (filterVertexShader) {
                if (filterVertexShader.includes(searchFunctionName)) {
                    vertexShaderMainCalls.push('    filterPositionResult = ' + searchFunctionName + '(filterPositionResult);');
                }
                filterVertexShader = filterVertexShader.replaceAll(searchParamName, replaceParamName);
            }
            if (filterFragmentShader) {
                if (filterFragmentShader.includes(searchFunctionName)) {
                    fragmentShaderMainCalls.push('    filterColorResult = ' + searchFunctionName + '(filterColorResult);');
                }
                filterFragmentShader = filterFragmentShader.replaceAll(searchParamName, replaceParamName);
            }
            uniforms[replaceParamName] = {
                value: canvasFilter.params[editParamName] ?? editConfig[editParamName].default
            };
        }
        if (filterVertexShader) {
            vertexShader += filterVertexShader + '\n';
        }
        if (filterFragmentShader) {
            fragmentShader += filterFragmentShader + '\n';
        }
    }

    let vertexFilterCode = '';
    if (vertexShaderMainCalls.length > 0) {
        vertexFilterCode += 'vec4 filterPositionResult = gl_Position;\n' + vertexShaderMainCalls.join('\n') + '\n    gl_Position = filterPositionResult;';
    }
    let fragmentFilterCode = '';
    if (fragmentShaderMainCalls.length > 0) {
        fragmentFilterCode += 'vec4 filterColorResult = gl_FragColor;\n' + fragmentShaderMainCalls.join('\n') + '\n    gl_FragColor = filterColorResult;';
    }

    vertexShader += '\n' + basicMaterialVertexShader.replace('//[INJECT_FILTERS_HERE]', vertexFilterCode);
    fragmentShader += '\n' + basicMaterialFragmentShader.replace('//[INJECT_FILTERS_HERE]', fragmentFilterCode);

    return {
        vertexShader,
        fragmentShader,
        uniforms
    };
}
