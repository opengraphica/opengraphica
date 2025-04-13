import { SRGBColorSpace, LinearFilter } from 'three/src/constants';
import { Texture } from 'three/src/textures/Texture';
import { Vector2 } from 'three/src/math/Vector2';
import { Vector4 } from 'three/src/math/Vector4';

import { generateGradientImage } from '@/lib/gradient';
import { camelCaseToKebabCase } from '@/lib/string';

import blendingModesFragmentShaderSetup from '@/renderers/webgl2/layers/base/shader/blending-modes.setup.frag';
import blendingModesFragmentShaderMain from '@/renderers/webgl2/layers/base/shader/blending-modes.main.frag';
import commonUtilityFragmentShader from '@/renderers/webgl2/layers/base/shader/common-utility.frag';

import { getWebgl2RendererBackend } from '@/renderers/webgl2/backend';

import type { IUniform } from 'three/src/renderers/shaders/UniformsLib';
import type {
    ClassType, Webgl2RendererCanvasFilter, CanvasFilterEditConfig,
    WorkingFileLayerFilter, CanvasFilterEditConfigGradient
} from '@/types';

export async function createCanvasFilter(name: string): Promise<Webgl2RendererCanvasFilter> {
    const kebabCaseName = camelCaseToKebabCase(name);
    const CanvasFilterClass: ClassType<Webgl2RendererCanvasFilter>
        = (await import(/* webpackChunkName: 'layer-filter-[request]' */ `@/canvas/filters/${kebabCaseName}`)).default;
    const fragmentShader: string
        = (await import(/* webpackChunkName: 'layer-filter-[request]' */ `@/renderers/webgl2/backend/filters/${kebabCaseName}.frag`)).default;
    const canvasFilter = new CanvasFilterClass();
    canvasFilter.fragmentShader = fragmentShader;
    return canvasFilter;
}

/**
 * Given the configuration of the filters/effects in a layer, gathers all the necessary information
 * about each filter in order to be able to render it.
 * @param {WorkingFileLayerFilter[]} filterConfigs - The filter configurations for a layer
 * @returns {Promise<Webgl2RendererCanvasFilter[]>} - A class for each filter that can be used to render it
 */

export async function createCanvasFiltersFromLayerConfig(
    filterConfigs: WorkingFileLayerFilter[],
): Promise<Webgl2RendererCanvasFilter[]> {
    const canvasFilters: Webgl2RendererCanvasFilter[] = [];
    for (const filterConfig of filterConfigs) {
        if (!filterConfig.disabled) {
            const canvasFilter = await createCanvasFilter(filterConfig.name);
            canvasFilter.maskId = filterConfig.maskId;
            canvasFilter.params = filterConfig.params ?? {};
            canvasFilters.push(canvasFilter);
        }
    }
    return canvasFilters;
}

/**
 * Converts the configured layer filter/effect parameter value to a value that the GLSL shader can read.
 * @function getLayerFilterParamUniformValue
 * @param {string} paramName - The name of the filter parameter
 * @param {any} paramValue - The configured value of the filter parameter, as stored in Webgl2RendererCanvasFilter
 * @param {CanvasFilterEditConfig} editConfig - The edit config for the filter
 * @param {Record<string, unknown>} otherParams - All the other params on the filter, if needed for reference
 * @returns {any} The value that should be assigned to the shader uniform
 */

function getLayerFilterParamUniformValue(
    paramName: string,
    paramValue: any,
    editConfig: CanvasFilterEditConfig,
    otherParams: Record<string, unknown>
) {
    const type = editConfig[paramName].type;
    if (type === 'boolean') {
        paramValue = paramValue === true ? 1 : 0;
    } else if (type === 'percentageRange') {
        paramValue = new Vector2(paramValue[0], paramValue[1]);
    } else if (type === 'color') {
        paramValue = new Vector4(paramValue.r, paramValue.g, paramValue.b, paramValue.a);
    } else if (type === 'gradient') {
        const colorSpaceFieldName = (editConfig[paramName] as CanvasFilterEditConfigGradient).colorSpaceFieldName;
        const blendColorSpace = ({
            0: 'oklab',
            1: 'srgb',
            2: 'linearSrgb',
        }[otherParams[colorSpaceFieldName] as number] ?? 'oklab') as never;
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

/**
 * Creates a new base set of uniforms and defines for a layer's shader.
 * @function createLayerShaderUniformsAndDefines
 * @param {number} width - Layer width in pixels.
 * @param {number} height - Layer height in pixels.
 * @param {Webgl2RendererCanvasFilter[]} canvasFilters - Information about the filters/effects applied to the layer.
 * @returns {CreateLayerShaderUniformsAndDefinesResult}
 */

export interface CreateLayerShaderUniformsAndDefinesResult {
    uniforms: Record<string, IUniform>,
    defines: Record<string, unknown>,
    textures: Texture[],
}

export function createLayerShaderUniformsAndDefines(
    width: number,
    height: number,
    canvasFilters: Webgl2RendererCanvasFilter[],
): CreateLayerShaderUniformsAndDefinesResult {
    const defines: Record<string, unknown> = {
        cLayerWidth: width,
        cLayerHeight: height,
    };
    const uniforms: Record<string, IUniform> = {};
    let textures: Texture[] = [];
    for (const [index, canvasFilter] of canvasFilters.entries()) {
        const editConfig = canvasFilter.getEditConfig();
        const computedParamNames: string[] = [];
        const paramValues: Record<string, unknown> = {};
        for (const editParamName in editConfig) {
            let paramValue = canvasFilter.params[editParamName] ?? editConfig[editParamName].default;
            paramValue = getLayerFilterParamUniformValue(editParamName, paramValue, editConfig, canvasFilter.params);
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
            let paramValue = editConfig[editParamName].computedValue?.(paramValues, { layerWidth: width ?? 0, layerHeight: height ?? 0 });
            paramValue = getLayerFilterParamUniformValue(editParamName, paramValue, editConfig, canvasFilter.params);
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

/**
 * Generates fragment and vertex shaders for a layer based on its properties.
 * This mostly does the work of stacking the filters/effects on top of the layer.
 * @function createLayerShader
 * @param {CreateLayerShaderOptions} options - Information about the layer and the base shaders to use.
 * @returns {CombinedFilterShaderResult}
 */

export interface CreateLayerShaderOptions {
    fragmentShaderMain: string;
    fragmentShaderSetup: string;
    vertexShaderMain: string;
    vertexShaderSetup: string;
    canvasFilters: Webgl2RendererCanvasFilter[],
    width: number;
    height: number;
}

export interface CreateLayerShaderResult {
    fragmentShader: string,
    vertexShader: string,
    uniforms: Record<string, IUniform>,
    defines: Record<string, unknown>,
    textures: Texture[],
}

export async function createLayerShader(
    options: CreateLayerShaderOptions,
): Promise<CreateLayerShaderResult> {
    const {
        fragmentShaderMain, fragmentShaderSetup, vertexShaderMain, vertexShaderSetup,
        canvasFilters, width, height,
    } = options;

    let vertexShader = '';
    let fragmentShader = '';

    const { uniforms, defines, textures } = createLayerShaderUniformsAndDefines(width, height, canvasFilters);
    defines.cLayerBlendingMode = 0;

    const rendererBackend = getWebgl2RendererBackend();

    let vertexShaderMainCalls: string[] = [];
    let fragmentShaderMainCalls: string[] = [];

    const alreadyIncludedFilters = new Set<string>();
    const useFunctionNameStack: string[] = [];

    fragmentShader = 'vec4 materialMain(vec2 uv);\n' + fragmentShader;

    for (const [index, canvasFilter] of canvasFilters.entries()) {
        const editConfig = canvasFilter.getEditConfig();
        let filterVertexShader = '';
        let filterFragmentShader = canvasFilter.fragmentShader;

        const maskTexture = await rendererBackend.getMaskTexture(canvasFilter.maskId ?? -1);
        if (maskTexture) {
            uniforms[`filterMask${index}Map`] = {
                value: maskTexture,
            };
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

    vertexShader = vertexShaderSetup + '\n' + vertexShader
        + '\n' + vertexShaderMain.replace('//[INJECT_FILTERS_HERE]', vertexFilterCode);
    fragmentShader = commonUtilityFragmentShader + '\n' + blendingModesFragmentShaderSetup + '\n'
        + fragmentShaderSetup + '\n' + fragmentShader
        + '\n' + fragmentShaderMain.replace('//[INJECT_FILTERS_HERE]', fragmentFilterCode);

    return {
        vertexShader,
        fragmentShader,
        uniforms,
        defines,
        textures,
    };
}
