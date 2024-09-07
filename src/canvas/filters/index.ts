import { camelCaseToKebabCase } from "@/lib/string";
import { Vector2 } from 'three/src/math/Vector2';

import basicMaterialVertexShaderSetup from '@/canvas/renderers/webgl/shaders/basic-material.setup.vert';
import basicMaterialVertexShaderMain from '@/canvas/renderers/webgl/shaders/basic-material.main.vert';
import basicMaterialFragmentShaderSetup from '@/canvas/renderers/webgl/shaders/basic-material.setup.frag';
import basicMaterialFragmentShaderMain from '@/canvas/renderers/webgl/shaders/basic-material.main.frag';

import type { IUniform } from 'three/src/renderers/shaders/UniformsLib';
import type { CanvasFilter, CanvasFilterEditConfig, WorkingFileAnyLayer, WorkingFileLayerFilter } from '@/types';

export async function getCanvasFilterClass(name: string): Promise<new (...args: any) => CanvasFilter> {
    const kebabCaseName = camelCaseToKebabCase(name);
    return (await import(/* webpackChunkName: 'layer-filter-[request]' */ `./${kebabCaseName}/${kebabCaseName}`)).default;
}

interface CreateFiltersOptions {
    createDisabled?: boolean;
}

export async function createFiltersFromLayerConfig(filterConfigs: WorkingFileLayerFilter[], options: CreateFiltersOptions = {}): Promise<CanvasFilter[]> {
    const canvasFilters: CanvasFilter[] = [];
    for (const filterConfig of filterConfigs) {
        if (!filterConfig.disabled || options.createDisabled) {
            const canvasFilter = new (await getCanvasFilterClass(filterConfig.name))();
            canvasFilter.params = filterConfig.params ?? {};
            canvasFilters.push(canvasFilter);
        }
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

export function buildCanvasFilterParamsFromFormData(canvasFilter: CanvasFilter, formData: Record<string,unknown>): Record<string, unknown> {
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

export function buildCanvasFilterPreviewParams(canvasFilter: CanvasFilter): Record<string, unknown> {
    const filterEditConfig = canvasFilter.getEditConfig();
    const previewParams: Record<string, unknown> = {};
    for (const paramName in filterEditConfig) {
        previewParams[paramName] = filterEditConfig[paramName]?.preview ?? filterEditConfig[paramName].default;
    }
    return previewParams;
}

export interface CombinedShaderResult {
    fragmentShader: string,
    vertexShader: string,
    uniforms: Record<string, IUniform>,
    defines: Record<string, unknown>
}

function translateParamToUniformValue(paramValue: any, editConfig: CanvasFilterEditConfig, editParamName: string) {
    const type = editConfig[editParamName].type;
    if (type === 'boolean') {
        paramValue = paramValue === true ? 1 : 0;
    } else if (type === 'percentageRange') {
        paramValue = new Vector2(paramValue[0], paramValue[1]);
    }
    return paramValue;
}

export function generateShaderUniformsAndDefines(canvasFilters: CanvasFilter[], layer: Partial<WorkingFileAnyLayer>): { uniforms: Record<string, IUniform>, defines: Record<string, unknown> } {
    const defines: Record<string, unknown> = {};
    const uniforms: Record<string, IUniform> = {};
    for (const [index, canvasFilter] of canvasFilters.entries()) {
        const editConfig = canvasFilter.getEditConfig();
        const computedParamNames: string[] = [];
        const paramValues: Record<string, unknown> = {};
        for (const editParamName in editConfig) {
            let paramValue = canvasFilter.params[editParamName] ?? editConfig[editParamName].default;
            paramValues[editParamName] = translateParamToUniformValue(paramValue, editConfig, editParamName);
            if (editConfig[editParamName].computedValue) {
                computedParamNames.push(editParamName);
            } else {
                if (editConfig[editParamName].constant) {
                    const replaceDefineName = 'constant' + index + '_' + editParamName;
                    defines[replaceDefineName] = paramValue;
                } else {
                    const replaceParamName = 'param' + index + '_' + editParamName;
                    uniforms[replaceParamName] = {
                        value: paramValue
                    };
                }
            }
        }
        for (const editParamName of computedParamNames) {
            let paramValue = editConfig[editParamName].computedValue?.(paramValues, { layerWidth: layer.width ?? 0, layerHeight: layer.height ?? 0 });
            paramValue = translateParamToUniformValue(paramValue, editConfig, editParamName);
            if (editConfig[editParamName].constant) {
                const replaceDefineName = 'constant' + index + '_' + editParamName;
                defines[replaceDefineName] = paramValue;
            } else {
                const replaceParamName = 'param' + index + '_' + editParamName;
                uniforms[replaceParamName] = {
                    value: paramValue
                };
            }
        }
    }
    return { defines, uniforms };
}

interface CombineShadersOptions {
    fragmentShaderMain?: string;
    fragmentShaderSetup?: string;
    vertexShaderMain?: string;
    vertexShaderSetup?: string;
}

export function combineShaders(canvasFilters: CanvasFilter[], layer: Partial<WorkingFileAnyLayer>, options?: CombineShadersOptions): CombinedShaderResult {
    let vertexShader = '';
    let fragmentShader = '';

    const { uniforms, defines } = generateShaderUniformsAndDefines(canvasFilters, layer);

    let vertexShaderMainCalls: string[] = [];
    let fragmentShaderMainCalls: string[] = [];

    for (const [index, canvasFilter] of canvasFilters.entries()) {
        const editConfig = canvasFilter.getEditConfig();
        let filterVertexShader = canvasFilter.getVertexShader();
        let filterFragmentShader = canvasFilter.getFragmentShader();
        const searchFunctionName = 'process' + canvasFilter.name[0].toUpperCase() + canvasFilter.name.slice(1);
        if (filterVertexShader) {
            if (filterVertexShader.includes(searchFunctionName)) {
                vertexShaderMainCalls.push('    filterPositionResult = ' + searchFunctionName + '(filterPositionResult);');
            }
        }
        if (filterFragmentShader) {
            if (filterFragmentShader.includes(searchFunctionName)) {
                fragmentShaderMainCalls.push('    filterColorResult = ' + searchFunctionName + '(filterColorResult);');
            }
        }
        
        for (const editParamName in editConfig) {
            const isConstant = (editConfig[editParamName].constant);
            const searchParamName = isConstant
                ? 'c' + editParamName[0].toUpperCase() + editParamName.slice(1)
                : 'p' + editParamName[0].toUpperCase() + editParamName.slice(1);
            const replaceParamName = isConstant
                ? 'constant' + index + '_' + editParamName
                : 'param' + index + '_' + editParamName;
            
            if (filterVertexShader) {
                filterVertexShader = filterVertexShader.replaceAll(searchParamName, replaceParamName);
            }
            if (filterFragmentShader) {
                filterFragmentShader = filterFragmentShader.replaceAll(searchParamName, replaceParamName);
            }
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

    vertexShader = (options?.vertexShaderSetup ?? basicMaterialVertexShaderSetup) + '\n' + vertexShader
        + '\n' + (options?.vertexShaderMain ?? basicMaterialVertexShaderMain).replace('//[INJECT_FILTERS_HERE]', vertexFilterCode);
    fragmentShader = (options?.fragmentShaderSetup ?? basicMaterialFragmentShaderSetup) + '\n' + fragmentShader
        + '\n' + (options?.fragmentShaderMain ?? basicMaterialFragmentShaderMain).replace('//[INJECT_FILTERS_HERE]', fragmentFilterCode);

    return {
        vertexShader,
        fragmentShader,
        uniforms,
        defines
    };
}
