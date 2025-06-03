import { camelCaseToKebabCase } from "@/lib/string";
import { Vector2 } from 'three/src/math/Vector2';
import { Vector4 } from 'three/src/math/Vector4';
import { CanvasTexture } from 'three/src/textures/CanvasTexture';
import { Texture } from 'three/src/textures/Texture';

import basicMaterialVertexShaderSetup from '@/canvas/renderers/webgl/shaders/basic-material.setup.vert';
import basicMaterialVertexShaderMain from '@/canvas/renderers/webgl/shaders/basic-material.main.vert';
import basicMaterialFragmentShaderSetup from '@/canvas/renderers/webgl/shaders/basic-material.setup.frag';
import basicMaterialFragmentShaderMain from '@/canvas/renderers/webgl/shaders/basic-material.main.frag';
import blendingModesFragmentShaderSetup from '@/canvas/renderers/webgl/shaders/blending-modes.setup.frag';
import blendingModesFragmentShaderMain from '@/canvas/renderers/webgl/shaders/blending-modes.main.frag';
import commonUtilityFragmentShader from '@/canvas/renderers/webgl/shaders/common-utility.frag';

import { generateGradientImage } from '@/lib/gradient';

import workingFileStore from '@/store/working-file';
import { getStoredImageOrCanvas } from "@/store/image";

import { SRGBColorSpace, LinearFilter } from 'three/src/constants';

import type { IUniform } from 'three/src/renderers/shaders/UniformsLib';
import type { Webgl2RendererCanvasFilter, CanvasFilterLayerInfo, CanvasFilterEditConfig, WorkingFileLayerFilter, CanvasFilterEditConfigGradient } from '@/types';

export async function getCanvasFilterClass(name: string): Promise<new (...args: any) => Webgl2RendererCanvasFilter> {
    const kebabCaseName = camelCaseToKebabCase(name);
    return (await import(/* webpackChunkName: 'layer-filter-[request]' */ `./${kebabCaseName}`)).default;
}

interface CreateFiltersOptions {
    createDisabled?: boolean;
}

export async function createFiltersFromLayerConfig(filterConfigs: WorkingFileLayerFilter[], options: CreateFiltersOptions = {}): Promise<Webgl2RendererCanvasFilter[]> {
    const canvasFilters: Webgl2RendererCanvasFilter[] = [];
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

function translateParamToUniformValue(paramValue: any, editConfig: CanvasFilterEditConfig, editParamName: string, params: Record<string, unknown>) {
    const type = editConfig[editParamName].type;
    if (type === 'boolean') {
        paramValue = paramValue === true ? 1 : 0;
    } else if (type === 'percentageRange') {
        paramValue = new Vector2(paramValue[0], paramValue[1]);
    } else if (type === 'color') {
        paramValue = new Vector4(paramValue.r, paramValue.g, paramValue.b, paramValue.a);
    } else if (type === 'gradient') {
        const colorSpaceFieldName = (editConfig[editParamName] as CanvasFilterEditConfigGradient).colorSpaceFieldName;
        const blendColorSpace = ({
            0: 'oklab',
            1: 'srgb',
            2: 'linearSrgb',
        }[params[colorSpaceFieldName] as number] ?? 'oklab') as never;
        const texture = new Texture(generateGradientImage(paramValue, blendColorSpace, 64));
        texture.colorSpace = SRGBColorSpace;
        texture.generateMipmaps = false;
        texture.magFilter = LinearFilter;
        texture.minFilter = LinearFilter;
        texture.needsUpdate = true;
        paramValue = texture;
    }
    return paramValue;
}

export function generateShaderUniformsAndDefines(
    canvasFilters: Webgl2RendererCanvasFilter[],
    layer: CanvasFilterLayerInfo
): { uniforms: Record<string, IUniform>, defines: Record<string, unknown>, textures: Texture[] } {
    const defines: Record<string, unknown> = {
        cLayerWidth: layer.width,
        cLayerHeight: layer.height,
    };
    const uniforms: Record<string, IUniform> = {};
    let textures: Texture[] = [];
    for (const [index, canvasFilter] of canvasFilters.entries()) {
        const editConfig = canvasFilter.getEditConfig();
        const computedParamNames: string[] = [];
        const paramValues: Record<string, unknown> = {};
        for (const editParamName in editConfig) {
            let paramValue = canvasFilter.params[editParamName] ?? editConfig[editParamName].default;
            paramValue = translateParamToUniformValue(paramValue, editConfig, editParamName, canvasFilter.params);
            paramValues[editParamName] = paramValue;
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
            if ((paramValue as Texture).isTexture) {
                textures.push(paramValue as Texture);
            }
        }
        for (const editParamName of computedParamNames) {
            let paramValue = editConfig[editParamName].computedValue?.(paramValues, { layerWidth: layer.width ?? 0, layerHeight: layer.height ?? 0 });
            paramValue = translateParamToUniformValue(paramValue, editConfig, editParamName, canvasFilter.params);
            if (editConfig[editParamName].constant) {
                const replaceDefineName = 'constant' + index + '_' + editParamName;
                defines[replaceDefineName] = paramValue;
            } else {
                const replaceParamName = 'param' + index + '_' + editParamName;
                uniforms[replaceParamName] = {
                    value: paramValue
                };
            }
            if ((paramValue as Texture).isTexture) {
                textures.push(paramValue as Texture);
            }
        }
    }
    return { defines, uniforms, textures };
}

interface CombineFilterShadersOptions {
    fragmentShaderMain?: string;
    fragmentShaderSetup?: string;
    vertexShaderMain?: string;
    vertexShaderSetup?: string;
}

export function combineFiltersToShader(canvasFilters: Webgl2RendererCanvasFilter[], layerInfo: CanvasFilterLayerInfo, options?: CombineFilterShadersOptions): CombinedFilterShaderResult {
    let vertexShader = '';
    let fragmentShader = '';

    const { uniforms, defines, textures } = generateShaderUniformsAndDefines(canvasFilters, layerInfo);
    defines.cLayerBlendingMode = 0;

    const masks = workingFileStore.get('masks');

    let vertexShaderMainCalls: string[] = [];
    let fragmentShaderMainCalls: string[] = [];

    const alreadyIncludedFilters = new Set<string>();
    const useFunctionNameStack: string[] = [];

    fragmentShader = 'vec4 materialMain(vec2 uv);\n' + fragmentShader;

    for (const [index, canvasFilter] of canvasFilters.entries()) {
        const editConfig = canvasFilter.getEditConfig();
        let filterVertexShader = '';
        let filterFragmentShader = canvasFilter.fragmentShader;

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
            if (filterFragmentShader.includes('sampleBackbuffer(')) {
                filterFragmentShader = filterFragmentShader.replace(/sampleBackbuffer\(/g, `sampleBackbuffer${index}(`);
                fragmentShader += `vec4 sampleBackbuffer${index}(vec2 uv) { return ${
                    useFunctionNameStack.map(name => name + '(').join('')
                }materialMain(uv)${
                    useFunctionNameStack.map(_ => ')').join('')
                }; }\n`;
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
        useFunctionNameStack.push(useFunctionName);
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
