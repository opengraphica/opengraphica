import { SRGBColorSpace, LinearFilter } from 'three/src/constants';
import { Texture } from 'three/src/textures/Texture';
import { Vector2 } from 'three/src/math/Vector2';
import { Vector4 } from 'three/src/math/Vector4';

import { generateGradientImage } from '@/lib/gradient';
import { camelCaseToKebabCase } from '@/lib/string';

import blendingModesFragmentShaderSetup from '@/renderers/webgl2/layers/base/shader/blending-modes.setup.frag';
import blendingModesFragmentShaderMain from '@/renderers/webgl2/layers/base/shader/blending-modes.main.frag';
import commonUtilityFragmentShader from '@/renderers/webgl2/layers/base/shader/common-utility.frag';
import filterPassBaseFragmentShader from '@/renderers/webgl2/layers/base/shader/filter-pass-base.frag';

import { getWebgl2RendererBackend } from '@/renderers/webgl2/backend';

import type { IUniform } from 'three/src/renderers/shaders/UniformsLib';
import type {
    ClassType, Webgl2RendererCanvasFilter, CanvasFilterEditConfig,
    WorkingFileLayerFilter, CanvasFilterEditConfigGradient
} from '@/types';

const pluginFiltersByName: Record<string, Webgl2RendererCanvasFilter> = {};

export async function registerPluginFilter(filter: Webgl2RendererCanvasFilter) {
    pluginFiltersByName[filter.name] = filter;
}

export async function createCanvasFilter(name: string): Promise<Webgl2RendererCanvasFilter> {
    if (pluginFiltersByName[name]) {
        return pluginFiltersByName[name];
    }
    const kebabCaseName = camelCaseToKebabCase(name);
    const CanvasFilterClass: ClassType<Webgl2RendererCanvasFilter>
        = (await import(/* webpackChunkName: 'layer-filter-[request]' */ `@/renderers/common/filters/${kebabCaseName}`)).default;
    const canvasFilter = new CanvasFilterClass();
    let fragmentShaders: string[] = [];
    const passCount = canvasFilter.passes || 1;
    if (passCount > 1) {
        for (let i = 0; i < passCount; i++) {
            const passKebabCaseName = kebabCaseName + '-' + i;
            fragmentShaders.push(
                (await import(/* webpackChunkName: 'layer-filter-[request]' */ `@/renderers/webgl2/backend/filters/${passKebabCaseName}.frag`)).default
            );
        }
    } else {
        fragmentShaders.push(
            (await import(/* webpackChunkName: 'layer-filter-[request]' */ `@/renderers/webgl2/backend/filters/${kebabCaseName}.frag`)).default
        );
    }
    let vertexShader: string | undefined;
    if (canvasFilter.hasVertexShader) {
        vertexShader = (await import(/* webpackChunkName: 'layer-filter-[request]' */ `@/renderers/webgl2/backend/filters/${kebabCaseName}.vert`)).default
    }
    canvasFilter.fragmentShader = fragmentShaders[0];
    canvasFilter.fragmentShaders = fragmentShaders;
    canvasFilter.vertexShader = vertexShader;
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
): Promise<Array<Webgl2RendererCanvasFilter | null>> {
    const canvasFilters: Array<Webgl2RendererCanvasFilter | null> = [];
    for (const filterConfig of filterConfigs) {
        const canvasFilter = await createCanvasFilter(filterConfig.name);
        canvasFilter.maskId = filterConfig.maskId;
        canvasFilter.params = filterConfig.params ?? {};
        if (filterConfig.disabled) {
            canvasFilter.disabled = true;
        }
        canvasFilters.push(canvasFilter);
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
        paramValue = new Vector4(paramValue.r, paramValue.g, paramValue.b, paramValue.alpha);
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
    canvasFilters: Array<Webgl2RendererCanvasFilter | null>,
): CreateLayerShaderUniformsAndDefinesResult {
    const defines: Record<string, unknown> = {
        cLayerWidth: width,
        cLayerHeight: height,
    };
    const uniforms: Record<string, IUniform> = {
        opacity: { value: 1 },
    };
    let textures: Texture[] = [];
    for (const [index, canvasFilter] of canvasFilters.entries()) {
        if (canvasFilter == null || (canvasFilter.overrideDisabled ?? canvasFilter.disabled) === true) continue;
        const editConfig = canvasFilter.editConfig ?? canvasFilter.getEditConfig?.()!;
        const computedParamNames: string[] = [];
        const paramsList = canvasFilter.overrideParams ?? canvasFilter.params;
        const paramValues: Record<string, unknown> = {};
        for (const editParamName in editConfig) {
            let paramValue = paramsList?.[editParamName] ?? editConfig[editParamName].default;
            paramValue = getLayerFilterParamUniformValue(
                editParamName,
                paramValue,
                editConfig,
                paramsList,
            );
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
            paramValue = getLayerFilterParamUniformValue(editParamName, paramValue, editConfig, paramsList);
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
    canvasFilters: Array<Webgl2RendererCanvasFilter | null>;
    width: number;
    height: number;
    useAutomaticLayerTextureMipmaps?: boolean;
}

export interface CreateLayerShaderPass {
    fragmentShader: string;
    vertexShader: string;
    uniforms: Record<string, IUniform>;
    defines: Record<string, unknown>;
    textures: Texture[];
    shouldCaptureSource: boolean;
    getExtendedBounds: (params: any) => number[];
}

export async function createLayerShader(
    options: CreateLayerShaderOptions,
): Promise<CreateLayerShaderPass[]> {
    
    const {
        fragmentShaderMain, fragmentShaderSetup, vertexShaderMain, vertexShaderSetup,
        canvasFilters, width, height, useAutomaticLayerTextureMipmaps,
    } = options;

    const shaderPasses: CreateLayerShaderPass[] = [];

    // Since an individual filter can have multiple passes, we need to split into separate shaders.
    const filtersByPass: Webgl2RendererCanvasFilter[][] = [];
    let currentPassFilters: Webgl2RendererCanvasFilter[] = [];
    const getExtendedBoundsFunctions: Record<number, (params: any) => number[]> = {};
    let getExtendedBoundsIndex = 0;
    for (const canvasFilter of canvasFilters) {
        if (canvasFilter == null || (canvasFilter.overrideDisabled ?? canvasFilter.disabled) === true) continue;
        const passCount = canvasFilter.passes || 1;
        if (passCount === 1) {
            currentPassFilters.push(canvasFilter);
        } else {
            for (let i = 0; i < passCount; i++) {
                if (i === 0 && currentPassFilters.length > 0) {
                    filtersByPass.push(currentPassFilters);
                    currentPassFilters = [];
                }
                currentPassFilters.push({
                    ...canvasFilter,
                    editConfig: canvasFilter.editConfig ?? canvasFilter.getEditConfig?.()!,
                    pass: i
                });
                if (i < passCount - 1) {
                    filtersByPass.push(currentPassFilters);
                    currentPassFilters = [];
                }
            }
        }
        if (canvasFilter.getExtendedBounds) {
            getExtendedBoundsFunctions[getExtendedBoundsIndex] = canvasFilter.getExtendedBounds;
        }
        getExtendedBoundsIndex++;
    }
    if (currentPassFilters.length > 0) {
        filtersByPass.push(currentPassFilters);
    }
    if (filtersByPass.length === 0) {
        filtersByPass.push([]);
    }

    // The first pass renders the layer's main shader + filters with a single pass.
    // Subsequent passes read a render target containing the texture of the previous pass,
    // in addition to the texture at the start of the current filter's first pass.
    let originalFilterIndex = 0;
    for (const [passIndex, passFilters] of filtersByPass.entries()) {
        let vertexShader = '';
        let fragmentShader = '';

        const { uniforms, defines, textures } = createLayerShaderUniformsAndDefines(width, height, passFilters);
        defines.cLayerBlendingMode = 0;
        defines.cHighQualityRender = 0;

        const rendererBackend = getWebgl2RendererBackend();

        let vertexShaderMainCalls: string[] = [];
        let fragmentShaderMainCalls: string[] = [];

        const alreadyIncludedFilters = new Set<string>();
        const useFunctionNameStack: Array<[string, string | undefined]> = [];

        fragmentShader = 'vec4 materialMain(vec2 uv, float lod);\n' + fragmentShader;

        let hasMaskTextures = false;
        let hasSampleBackbuffer = false;
        let hasSampleBackbufferLod = false;
        for (const [index, canvasFilter] of passFilters.entries()) {
            if (canvasFilter == null || (canvasFilter.overrideDisabled ?? canvasFilter.disabled) === true) continue;
            const editConfig = canvasFilter.editConfig ?? canvasFilter.getEditConfig?.()!;

            let filterVertexShader = canvasFilter.vertexShader ?? '';
            const canvasFilterPass = canvasFilter.pass ?? 0;
            let filterFragmentShader = canvasFilterPass > 0 ? canvasFilter.fragmentShaders?.[canvasFilterPass] : canvasFilter.fragmentShader;

            const maskTexture = await rendererBackend.getMaskTexture(canvasFilter.maskId ?? -1);
            if (maskTexture) {
                maskTexture.needsUpdate = true;
                hasMaskTextures = true;
                uniforms[`filterMask${index}Map`] = {
                    value: maskTexture,
                };
            }

            const searchProcessFunctionName = 'process' + canvasFilter.name[0].toUpperCase() + canvasFilter.name.slice(1);
            const useProcessFunctionName = searchProcessFunctionName + index;
            const searchBakeFunctionName = 'bake' + canvasFilter.name[0].toUpperCase() + canvasFilter.name.slice(1);
            let useBakeFunctionName: string | undefined = searchBakeFunctionName + index;
            if (filterVertexShader?.includes(searchProcessFunctionName)) {
                if (alreadyIncludedFilters.has(canvasFilter.name)) {
                    filterVertexShader = filterVertexShader.replace(/const int.*?;/g, '');
                }
                filterVertexShader = filterVertexShader.replace(searchProcessFunctionName + '(', useProcessFunctionName + '(');
                vertexShaderMainCalls.push('    ' + useProcessFunctionName + '(filterPositionResult, vUv);');
            }
            if (filterFragmentShader?.includes(searchProcessFunctionName)) {
                if (filterFragmentShader?.includes(searchBakeFunctionName)) {
                    filterFragmentShader = filterFragmentShader.replace(searchBakeFunctionName + '(', useBakeFunctionName + '(');
                } else {
                    useBakeFunctionName = undefined;
                }
                if (alreadyIncludedFilters.has(canvasFilter.name)) {
                    filterFragmentShader = filterFragmentShader.replace(/const int.*?;/g, '');
                }
                if (filterFragmentShader.includes('sampleBackbuffer(')) {
                    hasSampleBackbuffer = true;
                    filterFragmentShader = filterFragmentShader.replace(/sampleBackbuffer\(/g, `sampleBackbuffer${index}(`);

                    fragmentShader += `vec4 sampleBackbuffer${index}(vec2 uv) {\n`
                        + '    vec4 filterColorResult = materialMain(uv, -1.0);\n';
                    if (hasMaskTextures) {
                        fragmentShader += '    float filterMaskAlpha = 1.0;\n    vec4 filterColorBuffer = vec4(0.0, 0.0, 0.0, 0.0);\n';
                    }
                    for (const [functionIndex, [processFunctionName, bakeFunctionName]] of useFunctionNameStack.entries()) {
                        const functionMaskTexture = uniforms[`filterMask${functionIndex}Map`];
                        if (functionMaskTexture) {
                            fragmentShader += `    filterColorBuffer = filterColorResult;\n    filterMaskAlpha = texture2D(filterMask${functionIndex}Map, uv).a;\n`;
                        }
                        if (bakeFunctionName) {
                            fragmentShader += '    if (cHighQualityRender == 1) {\n'
                                + `        filterColorResult = ${bakeFunctionName}(filterColorResult, uv);\n`
                                + `    } else {\n`;
                        }
                        fragmentShader += `    filterColorResult = ${processFunctionName}(filterColorResult, uv);\n`;
                        if (bakeFunctionName) {
                            fragmentShader += '    }\n';
                        }
                        if (functionMaskTexture) {
                            fragmentShader += '    filterColorResult = vec4('
                                +       'filterColorResult.r * filterMaskAlpha + filterColorBuffer.r * (1.0 - filterMaskAlpha),'
                                +       'filterColorResult.g * filterMaskAlpha + filterColorBuffer.g * (1.0 - filterMaskAlpha),'
                                +       'filterColorResult.b * filterMaskAlpha + filterColorBuffer.b * (1.0 - filterMaskAlpha),'
                                +       'filterColorResult.a * filterMaskAlpha + filterColorBuffer.a * (1.0 - filterMaskAlpha)'
                                +   ');\n';
                        }
                    }
                    fragmentShader += '    return filterColorResult;\n}\n\n';
                    fragmentShaderMainCalls = [];
                }
                if (filterFragmentShader.includes('sampleBackbufferLod(')) {
                    hasSampleBackbufferLod = true;
                    filterFragmentShader = filterFragmentShader.replace(/sampleBackbufferLod\(/g, `sampleBackbufferLod${index}(`);

                    fragmentShader += `vec4 sampleBackbufferLod${index}(vec2 uv, float lod) {\n`
                        + '    vec4 filterColorResult = materialMain(uv, lod);\n';
                    if (hasMaskTextures) {
                        fragmentShader += '    float filterMaskAlpha = 1.0;\n    vec4 filterColorBuffer = vec4(0.0, 0.0, 0.0, 0.0);\n';
                    }
                    for (const [functionIndex, [processFunctionName, bakeFunctionName]] of useFunctionNameStack.entries()) {
                        const functionMaskTexture = uniforms[`filterMask${functionIndex}Map`];
                        if (functionMaskTexture) {
                            fragmentShader += `    filterColorBuffer = filterColorResult;\n    filterMaskAlpha = texture2D(filterMask${functionIndex}Map, uv).a;\n`;
                        }
                        if (bakeFunctionName) {
                            fragmentShader += '    if (cHighQualityRender == 1) {\n'
                                + `        filterColorResult = ${bakeFunctionName}(filterColorResult, uv);\n`
                                + `    } else {\n`;
                        }
                        fragmentShader += `    filterColorResult = ${processFunctionName}(filterColorResult, uv);\n`;
                        if (bakeFunctionName) {
                            fragmentShader += '    }\n';
                        }
                        if (functionMaskTexture) {
                            fragmentShader += '    filterColorResult = vec4('
                                +       'filterColorResult.r * filterMaskAlpha + filterColorBuffer.r * (1.0 - filterMaskAlpha),'
                                +       'filterColorResult.g * filterMaskAlpha + filterColorBuffer.g * (1.0 - filterMaskAlpha),'
                                +       'filterColorResult.b * filterMaskAlpha + filterColorBuffer.b * (1.0 - filterMaskAlpha),'
                                +       'filterColorResult.a * filterMaskAlpha + filterColorBuffer.a * (1.0 - filterMaskAlpha)'
                                +   ');\n';
                        }
                    }
                    fragmentShader += '    return filterColorResult;\n}\n\n';
                    fragmentShaderMainCalls = [];
                }
                filterFragmentShader = filterFragmentShader.replace(searchProcessFunctionName + '(', useProcessFunctionName + '(');
                if (maskTexture) {
                    fragmentShaderMainCalls.push(`    filterColorBuffer = filterColorResult;\n    filterMaskAlpha = texture2D(filterMask${index}Map, vUv).a;`);
                }
                if (useBakeFunctionName) {
                    fragmentShaderMainCalls.push('    if (cHighQualityRender == 1) {\n'
                        + `        filterColorResult = ${useBakeFunctionName}(filterColorResult, vUv);\n`
                        + `    } else {\n`);
                }
                fragmentShaderMainCalls.push('    filterColorResult = ' + useProcessFunctionName + '(filterColorResult, vUv);');
                if (useBakeFunctionName) {
                    fragmentShaderMainCalls.push('    }\n');
                }
                if (maskTexture) {
                    fragmentShaderMainCalls.push(
                        '    filterColorResult = vec4('
                        +       'filterColorResult.r * filterMaskAlpha + filterColorBuffer.r * (1.0 - filterMaskAlpha),'
                        +       'filterColorResult.g * filterMaskAlpha + filterColorBuffer.g * (1.0 - filterMaskAlpha),'
                        +       'filterColorResult.b * filterMaskAlpha + filterColorBuffer.b * (1.0 - filterMaskAlpha),'
                        +       'filterColorResult.a * filterMaskAlpha + filterColorBuffer.a * (1.0 - filterMaskAlpha)'
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
            useFunctionNameStack.push([useProcessFunctionName, useBakeFunctionName]);
            originalFilterIndex++;
        }

        let vertexFilterCode = '';
        if (vertexShaderMainCalls.length > 0) {
            vertexFilterCode += '    vec4 filterPositionResult = gl_Position;\n' + vertexShaderMainCalls.join('\n') + '\n    gl_Position = filterPositionResult;';
        }
        let fragmentFilterCode = '';
        if ((!hasSampleBackbuffer && !hasSampleBackbufferLod) || hasMaskTextures) {
            fragmentFilterCode += '    gl_FragColor = materialMain(vUv, -1.0);';
        }
        if (fragmentShaderMainCalls.length > 0) {
            if (hasMaskTextures) {
                fragmentFilterCode += '    float filterMaskAlpha = 1.0;\n    vec4 filterColorBuffer = vec4(0.0, 0.0, 0.0, 0.0);\n';
            }
            fragmentFilterCode += '    vec4 filterColorResult = gl_FragColor;\n' + fragmentShaderMainCalls.join('\n') + '\n    gl_FragColor = filterColorResult;';
        }
        if (passIndex === filtersByPass.length - 1) {
            fragmentFilterCode += '\n' + blendingModesFragmentShaderMain + '\n';
        }

        let sampleLayerTextureSetup = 'vec4 sampleLayerTexture(sampler2D layerTexture, vec2 uv, float lod) {\n'
            + '    return texture2D(layerTexture, uv);\n'
            + '}\n';
        if (useAutomaticLayerTextureMipmaps) {
            sampleLayerTextureSetup = 'vec4 sampleLayerTexture(sampler2D layerTexture, vec2 uv, float lod) {\n'
            + '    return texture2D(layerTexture, uv);\n'
            + '}\n';
        } else if (hasSampleBackbuffer || hasSampleBackbufferLod) {
            sampleLayerTextureSetup = 'vec4 sampleLayerTexture(sampler2D layerTexture, vec2 uv, float lod) {\n'
            + '    vec2 layerResolution = vec2(float(cLayerWidth), float(cLayerHeight));\n'
            + '    vec2 uvDx = dFdx(vUv * layerResolution);\n'
            + '    vec2 uvDy = dFdy(vUv * layerResolution);\n'
            + '    float autoLod = floor(log2(max(max(length(uvDx), length(uvDy)), 1.0)) + 0.5);\n'
            + '    float finalLod = mix(autoLod, lod, step(-0.999, lod));\n'
            + '    return textureLod(layerTexture, uv, finalLod);\n'
            + '}\n';
        }

        vertexShader = vertexShaderSetup + '\n'
            + vertexShader
            + '\n' + vertexShaderMain.replace('//[INJECT_FILTERS_HERE]', vertexFilterCode);
        fragmentShader = commonUtilityFragmentShader + '\n'
            + (passIndex === filtersByPass.length - 1 ? blendingModesFragmentShaderSetup + '\n' : '')
            + fragmentShaderSetup + '\n'
            + sampleLayerTextureSetup + '\n'
            + fragmentShader + '\n'
            + (passIndex > 0 ? filterPassBaseFragmentShader : fragmentShaderMain)
                .replace('//[INJECT_FILTERS_HERE]', fragmentFilterCode);

        shaderPasses.push({
            vertexShader,
            fragmentShader,
            uniforms,
            defines,
            textures,
            shouldCaptureSource: passFilters.length === 1 && passFilters[0].pass === 0,
            getExtendedBounds: (canvasFilters: Webgl2RendererCanvasFilter[]) => {
                const extendedBounds = [0, 0, 0, 0];
                const usedFilters = canvasFilters.filter((canvasFilter) => canvasFilter != null && !canvasFilter.overrideDisabled && !canvasFilter.disabled);
                for (let [canvasFilterIndex, canvasFilter] of usedFilters.entries()) {
                    const bounds = getExtendedBoundsFunctions[canvasFilterIndex]?.(canvasFilter.overrideParams ?? canvasFilter.params);
                    if (!bounds) continue;
                    extendedBounds[0] = Math.max(extendedBounds[0], bounds[0]);
                    extendedBounds[1] = Math.max(extendedBounds[1], bounds[1]);
                    extendedBounds[2] = Math.max(extendedBounds[2], bounds[2]);
                    extendedBounds[3] = Math.max(extendedBounds[3], bounds[3]);
                }
                return extendedBounds;
            }
        });
    }

    return shaderPasses;
}
