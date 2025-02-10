import { camelCaseToKebabCase } from "@/lib/string";
import { Vector2 } from 'three/src/math/Vector2';
import { CanvasTexture } from 'three/src/textures/CanvasTexture';
import { Texture } from 'three/src/textures/Texture';

import basicMaterialVertexShaderSetup from '@/canvas/renderers/webgl/shaders/basic-material.setup.vert';
import basicMaterialVertexShaderMain from '@/canvas/renderers/webgl/shaders/basic-material.main.vert';
import basicMaterialFragmentShaderSetup from '@/canvas/renderers/webgl/shaders/basic-material.setup.frag';
import basicMaterialFragmentShaderMain from '@/canvas/renderers/webgl/shaders/basic-material.main.frag';
import blendingModesFragmentShaderSetup from '@/canvas/renderers/webgl/shaders/blending-modes.setup.frag';
import blendingModesFragmentShaderMain from '@/canvas/renderers/webgl/shaders/blending-modes.main.frag';
import commonUtilityFragmentShader from '@/canvas/renderers/webgl/shaders/common-utility.frag';

import workingFileStore from '@/store/working-file';
import { getStoredImageOrCanvas } from "@/store/image";

import type { IUniform } from 'three/src/renderers/shaders/UniformsLib';
import type { CanvasFilter, CanvasFilterLayerInfo, CanvasFilterEditConfig, WorkingFileLayerFilter } from '@/types';

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
            canvasFilter.maskId = filterConfig.maskId;
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
        canvasFilter.fragment(data, appliedData, i, imageData.width, imageData.height);
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

export interface CombinedFilterShaderResult {
    fragmentShader: string,
    vertexShader: string,
    uniforms: Record<string, IUniform>,
    defines: Record<string, unknown>,
    textures: Texture[],
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

export function generateShaderUniformsAndDefines(canvasFilters: CanvasFilter[], layer: CanvasFilterLayerInfo): { uniforms: Record<string, IUniform>, defines: Record<string, unknown> } {
    const defines: Record<string, unknown> = {
        cLayerWidth: layer.width,
        cLayerHeight: layer.height,
    };
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

interface CombineFilterShadersOptions {
    fragmentShaderMain?: string;
    fragmentShaderSetup?: string;
    vertexShaderMain?: string;
    vertexShaderSetup?: string;
}

export function combineFiltersToShader(canvasFilters: CanvasFilter[], layerInfo: CanvasFilterLayerInfo, options?: CombineFilterShadersOptions): CombinedFilterShaderResult {
    let vertexShader = '';
    let fragmentShader = '';

    const { uniforms, defines } = generateShaderUniformsAndDefines(canvasFilters, layerInfo);
    defines.cLayerBlendingMode = 0;

    const masks = workingFileStore.get('masks');

    let vertexShaderMainCalls: string[] = [];
    let fragmentShaderMainCalls: string[] = [];
    let textures: Texture[] = [];

    const alreadyIncludedFilters = new Set<string>();

    for (const [index, canvasFilter] of canvasFilters.entries()) {
        const editConfig = canvasFilter.getEditConfig();
        let filterVertexShader = canvasFilter.getVertexShader();
        let filterFragmentShader = canvasFilter.getFragmentShader();

        const mask = masks[canvasFilter.maskId ?? -1];
        let maskTexture: Texture | undefined;
        if (mask) {
            const maskImage = getStoredImageOrCanvas(mask.sourceUuid);
            if (maskImage) {
                maskTexture = new CanvasTexture(maskImage);
                textures.push(maskTexture);
                uniforms[`filterMask${index}Map`] = {
                    value: maskTexture,
                };
            }
        }

        const searchFunctionName = 'process' + canvasFilter.name[0].toUpperCase() + canvasFilter.name.slice(1);
        const useFunctionName = searchFunctionName + index;
        if (filterVertexShader?.includes(searchFunctionName)) {
            if (alreadyIncludedFilters.has(canvasFilter.name)) {
                filterVertexShader = filterVertexShader.replace(/const int.*?;/g, '');
            }
            filterVertexShader = filterVertexShader.replace(searchFunctionName + '(', useFunctionName + '(');
            vertexShaderMainCalls.push('    filterPositionResult = ' + useFunctionName + '(filterPositionResult);');
        }
        if (filterFragmentShader?.includes(searchFunctionName)) {
            if (alreadyIncludedFilters.has(canvasFilter.name)) {
                filterFragmentShader = filterFragmentShader.replace(/const int.*?;/g, '');
            }
            filterFragmentShader = filterFragmentShader.replace(searchFunctionName + '(', useFunctionName + '(');
            if (maskTexture) {
                fragmentShaderMainCalls.push(`    filterColorBuffer = filterColorResult;\n    filterMaskAlpha = texture2D(filterMask${index}Map, vUv).a;`);
            }
            fragmentShaderMainCalls.push('    filterColorResult = ' + useFunctionName + '(filterColorResult);');
            if (maskTexture) {
                fragmentShaderMainCalls.push(
                    '    filterColorResult = vec4('
                    +       'filterColorResult.r * filterMaskAlpha + filterColorBuffer.r * (1.0 - filterMaskAlpha),'
                    +       'filterColorResult.g * filterMaskAlpha + filterColorBuffer.g * (1.0 - filterMaskAlpha),'
                    +       'filterColorResult.b * filterMaskAlpha + filterColorBuffer.b * (1.0 - filterMaskAlpha),'
                    +       'filterColorResult.a + filterColorBuffer.a * (1.0 - filterColorResult.a)'
                    +   ');'
                );
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
        if (maskTexture) {
            fragmentShader += `uniform sampler2D filterMask${index}Map;\n`;
        }
        alreadyIncludedFilters.add(canvasFilter.name);
    }

    let vertexFilterCode = '';
    if (vertexShaderMainCalls.length > 0) {
        vertexFilterCode += '    vec4 filterPositionResult = gl_Position;\n' + vertexShaderMainCalls.join('\n') + '\n    gl_Position = filterPositionResult;';
    }
    let fragmentFilterCode = '';
    if (fragmentShaderMainCalls.length > 0) {
        if (textures.length > 0) {
            fragmentFilterCode += 'float filterMaskAlpha = 1.0;\n    vec4 filterColorBuffer = vec4(0.0, 0.0, 0.0, 0.0);\n';
        }
        fragmentFilterCode += '    vec4 filterColorResult = gl_FragColor;\n' + fragmentShaderMainCalls.join('\n') + '\n    gl_FragColor = filterColorResult;';
    }
    fragmentFilterCode += '\n' + blendingModesFragmentShaderMain + '\n';

    vertexShader = (options?.vertexShaderSetup ?? basicMaterialVertexShaderSetup) + '\n' + vertexShader
        + '\n' + (options?.vertexShaderMain ?? basicMaterialVertexShaderMain).replace('//[INJECT_FILTERS_HERE]', vertexFilterCode);
    fragmentShader = commonUtilityFragmentShader + '\n' + blendingModesFragmentShaderSetup + '\n'
        + (options?.fragmentShaderSetup ?? basicMaterialFragmentShaderSetup) + '\n' + fragmentShader
        + '\n' + (options?.fragmentShaderMain ?? basicMaterialFragmentShaderMain).replace('//[INJECT_FILTERS_HERE]', fragmentFilterCode);

    return {
        vertexShader,
        fragmentShader,
        uniforms,
        defines,
        textures,
    };
}
