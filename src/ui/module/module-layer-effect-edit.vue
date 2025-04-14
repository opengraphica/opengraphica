<template>
    <el-alert v-if="hasError" type="error" show-icon :closable="false" :title="t('module.layerEffectEdit.generalError')" />
    <div v-else-if="isDeleting" v-loading="true" :element-loading-text="t('module.layerEffectEdit.deleting')" style="height: 15rem" />
    <div v-else v-loading="loading" :element-loading-text="t('module.layerEffectEdit.loading')">
        <div class="flex flex-row items-center">
            <canvas ref="beforeEffectCanvas" style="width: 100%; min-width: 0; height: auto; max-height: 40vh; background-image: url('../images/transparency-bg.png')" />
            <span class="bi bi-arrow-right-short shrink-1 text-5xl has-text-color-fill-darker" :style="{ visibility: currentFilterEnabled ? undefined : 'hidden' }" aria-hidden="true" />
            <canvas ref="afterEffectCanvas" style="width: 100%; min-width: 0; height: auto; max-height: 40vh; background-image: url('../images/transparency-bg.png')" :style="{ visibility: currentFilterEnabled ? undefined : 'hidden' }" />
        </div>
        <div class="flex flex-row items-center justify-center my-3">
            <el-button v-if="isSelectionMaskAvailable" @click="onCreateSelectionMask">
                <span class="bi bi-mask mr-1" aria-hidden="true" />
                {{ t('module.layerEffectEdit.useActiveSelectionMask') }}
            </el-button>
            <el-button v-if="isMaskApplied" @click="onClearMask">
                <span class="bi bi-x-circle mr-1" aria-hidden="true" />
                {{ t('module.layerEffectEdit.clearSelectionMask') }}
            </el-button>
        </div>
        <el-divider />
        <div class="flex flex-row items-center justify-between">
            <h2 v-t="currentFilterTitle" class="text-lg m-0" />
            <div class="flex flex-row items-center shrink-1">
                <el-switch
                    v-model="currentFilterEnabled"
                    :active-text="t('module.layerEffectEdit.enableToggle')"
                    class="mr-4 el-switch--label-align-fix-sm-above"
                />
                <el-button link type="danger" class="el-text-alignment-fix--below" @click="onDelete">
                    <span class="bi bi-trash mr-1 el-text-alignment-fix--above" aria-hidden="true" />
                    <span v-t="'module.layerEffectEdit.deleteEffect'" />
                </el-button>
            </div>
        </div>
        <el-form
            ref="form"
            action="javascript:void(0)"
            label-position="left"
            :model="formData.filterParams"
            :rules="formValidationRules"
            novalidate="novalidate"
            hide-required-asterisk
            class="mt-3"
            @submit="onConfirm"
        >
            <el-form-item-group class="el-form-item-group--resetable">
                <template v-for="(editConfigField, paramName) in currentFilterEditConfig" :key="paramName">
                    <el-form-item v-if="!editConfigField.hidden" :label="t(`layerFilter.${currentFilterName}.param.${paramName}`)">
                        <template v-if="editConfigField.type === 'percentage'">
                            <el-row>
                                <el-col :span="20" :xs="18">
                                    <el-slider
                                        v-model="formData.filterParams[paramName] as number"
                                        :min="getEditConfigMin(editConfigField)"
                                        :max="getEditConfigMax(editConfigField)"
                                        :step="0.01"
                                        :show-tooltip="false"
                                    />
                                </el-col>
                                <el-col :span="4" :xs="6">
                                    <el-input-number
                                        :modelValue="Math.floor((formData.filterParams[paramName] as number) * 100)"
                                        :min="getEditConfigMin(editConfigField) * 100"
                                        :max="getEditConfigMax(editConfigField) * 100"
                                        :precision="0"
                                        suffixText="%"
                                        class="el-input--text-right"
                                        @update:modelValue="formData.filterParams[paramName] = $event / 100"
                                    >
                                    </el-input-number>
                                </el-col>
                            </el-row>
                        </template>
                        <template v-if="editConfigField.type === 'percentageRange'">
                            <el-row>
                                <el-col :span="4" :xs="6">
                                    <el-input-number
                                        :modelValue="Math.floor((formData.filterParams[paramName] as number[])[0] * 100)"
                                        :min="getEditConfigMin(editConfigField) * 100"
                                        :max="getEditConfigMax(editConfigField) * 100"
                                        :precision="0"
                                        suffixText="%"
                                        class="el-input--text-right"
                                        @update:modelValue="(formData.filterParams[paramName] as number[])[0] = $event / 100"
                                    >
                                    </el-input-number>
                                </el-col>
                                <el-col :span="16" :xs="12">
                                    <el-slider
                                        v-model="formData.filterParams[paramName] as number"
                                        range
                                        :min="getEditConfigMin(editConfigField)"
                                        :max="getEditConfigMax(editConfigField)"
                                        :step="0.01"
                                        :show-tooltip="false"
                                    />
                                </el-col>
                                <el-col :span="4" :xs="6">
                                    <el-input-number
                                        :modelValue="Math.floor((formData.filterParams[paramName] as number[])[1] * 100)"
                                        :min="getEditConfigMin(editConfigField) * 100"
                                        :max="getEditConfigMax(editConfigField) * 100"
                                        :precision="0"
                                        suffixText="%"
                                        class="el-input--text-right"
                                        @update:modelValue="(formData.filterParams[paramName] as number[])[1] = $event / 100"
                                    >
                                    </el-input-number>
                                </el-col>
                            </el-row>
                        </template>
                        <template v-else-if="editConfigField.type === 'integer' && editConfigField.options">
                            <el-select
                                v-model="formData.filterParams[paramName] as number"
                                popper-class="el-select-dropdown--unlocked-option-height"
                            >
                                <el-option
                                    v-for="option of editConfigField.options"
                                    :key="option.key"
                                    :label="t(`layerFilter.${currentFilterName}.param.${paramName}Option.${option.key}`)"
                                    :value="option.value"
                                >
                                    <div style="line-height: 1.4em" class="py-2">
                                        <div>{{ t(`layerFilter.${currentFilterName}.param.${paramName}Option.${option.key}`) }}</div>
                                        <div v-if="editConfigField.optionsHaveDescriptions" class="has-text-color-placeholder">
                                            {{ t(`layerFilter.${currentFilterName}.param.${paramName}OptionDescription.${option.key}`) }}
                                        </div>
                                    </div>
                                </el-option>
                            </el-select>
                        </template>
                        <template v-else-if="editConfigField.type === 'boolean'">
                            <el-switch v-model="formData.filterParams[paramName] as boolean" />
                        </template>
                        <template v-else-if="editConfigField.type === 'color'">
                            <el-input-color v-model="formData.filterParams[paramName] as RGBAColor" />
                        </template>
                        <template v-else-if="editConfigField.type === 'gradient'">
                            <div
                                role="button"
                                tabindex="0"
                                class="og-gradient-input"
                                :style="{ '--gradient': gradientBackgrounds[paramName] }"
                                aria-haspopup="dialog"
                                @click="onClickStopGradientSelect(paramName as string)"
                                @keydown="onKeydownStopGradientSelect($event, paramName as string)"
                            >
                            </div>
                        </template>
                        <el-button
                            link type="primary" class="el-button--form-item-reset"
                            :disabled="isFilterParamDefault(paramName as string, editConfigField)"
                            :aria-label="t('module.layerEffectEdit.resetField')"
                            @click="resetFilterParam(paramName as string, editConfigField)">
                            <span class="bi bi-arrow-repeat" aria-hidden="true" />
                        </el-button>
                    </el-form-item>
                </template>
            </el-form-item-group>
        </el-form>
        <div class="text-right">
            <el-divider />
            <div class="text-right">
                <el-button @click="onCancel">{{ t('button.cancel') }}</el-button>
                <el-button type="primary" @click="onConfirm">{{ t('button.apply') }}</el-button>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
export default {
    name: 'ModuleLayerEffectEdit',
    inheritAttrs: false,
};
</script>
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, reactive, watch, WatchStopHandle } from 'vue';
import { Rules } from 'async-validator';

import { Scene } from 'three/src/scenes/Scene';
import { WebGLRenderer } from 'three/src/renderers/WebGLRenderer';
import { ImagePlaneGeometry } from '@/canvas/renderers/webgl/geometries/image-plane-geometry';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import { NearestFilter, SRGBColorSpace } from 'three/src/constants';
import { Mesh } from 'three/src/objects/Mesh';
import { TextureLoader } from 'three/src/loaders/TextureLoader';
import { Texture } from 'three/src/textures/Texture';
import { OrthographicCamera } from 'three/src/cameras/OrthographicCamera';

import ElAlert from 'element-plus/lib/components/alert/index';
import ElButton from 'element-plus/lib/components/button/index';
import ElCol from 'element-plus/lib/components/col/index';
import ElDivider from 'element-plus/lib/components/divider/index';
import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElFormItemGroup from '@/ui/el/el-form-item-group.vue';
import ElInputColor from '@/ui/el/el-input-color.vue';
import ElInputNumber from '@/ui/el/el-input-number.vue';
import vLoading from 'element-plus/lib/components/loading/index';
import ElSlider from 'element-plus/lib/components/slider/index';
import ElSelect, { ElOption } from 'element-plus/lib/components/select/index';
import ElSwitch from 'element-plus/lib/components/switch/index';
import ElRow from 'element-plus/lib/components/row/index';

import { useI18n } from '@/i18n';

import appEmitter from '@/lib/emitter';
import { generateCssGradient } from '@/lib/gradient';
import { notifyInjector } from '@/lib/notify';
import { throttle } from '@/lib/timing';
import { generateImageHash } from '@/lib/hash';
import { createImageBlobFromCanvas } from '@/lib/image';
import { isWebGLAvailable } from '@/lib/webgl';

import { BaseAction } from '@/actions/base';
import { UpdateLayerFilterDisabledAction } from '@/actions/update-layer-filter-disabled';
import { UpdateLayerFilterMaskAction } from '@/actions/update-layer-filter-mask';
import { UpdateLayerFilterParamsAction } from '@/actions/update-layer-filter-params';
import { DeleteLayerFilterAction } from '@/actions/delete-layer-filter';
import { BundleAction } from '@/actions/bundle';

import historyStore from '@/store/history';
import { createStoredImage, deleteStoredImage, getStoredImageOrCanvas } from '@/store/image';
import workingFileStore, { getCanvasRenderingContext2DSettings, getLayerById, getLayerGlobalTransform, discardMaskIfUnused } from '@/store/working-file';
import { activeSelectionMask, appliedSelectionMask, activeSelectionMaskCanvasOffset, appliedSelectionMaskCanvasOffset, resampleSelectionMaskInLayerBounds } from '@/canvas/store/selection-state';

import { createRasterShaderMaterial } from '@/canvas/renderers/webgl/shaders';
import { buildCanvasFilterParamsFromFormData, createFiltersFromLayerConfig, applyCanvasFilter, generateShaderUniformsAndDefines, combineFiltersToShader } from '@/canvas/filters';
import { EffectComposer } from '@/canvas/renderers/webgl/postprocessing/effect-composer';
import { RenderPass } from '@/canvas/renderers/webgl/postprocessing/render-pass';
import { ShaderPass } from '@/canvas/renderers/webgl/postprocessing/shader-pass';
import { GammaCorrectionShader } from '@/canvas/renderers/webgl/shaders/gamma-correction-shader';

import { useRenderer } from '@/renderers';

import { bakeCanvasFilters } from '@/workers';

import type {
    WorkingFileLayerFilter, RGBAColor, CanvasFilterEditConfig,
    CanvasFilterEditConfigField, CanvasFilterEditConfigGradient,
    WorkingFileGradientColorSpace, Webgl2RendererCanvasFilter,
} from '@/types';

const props = defineProps({
    isDialog: {
        type: Boolean,
        default: false
    },
    dialogOpened: {
        type: Boolean,
        default: false
    },
    layerId: {
        type: Number,
        required: true
    },
    filterIndex: {
        type: Number,
        default: 0
    },
    isFilterJustAdded: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits([
    'update:title',
    'update:dialogSize',
    'close'
]);

emit('update:title', 'module.layerEffectEdit.title');
emit('update:dialogSize', 'medium-large');

const { t } = useI18n();
const $notify = notifyInjector('$notify');

const isUseWebGlPreview = isWebGLAvailable();
const isCanceling = ref(false);
const isDeleting = ref(false);
const hasError = ref(false);
const loading = ref(true);
const beforeEffectCanvas = ref<HTMLCanvasElement>();
const beforeEffectCanvasCtx = ref<CanvasRenderingContext2D>();
const afterEffectCanvas = ref<HTMLCanvasElement>();
const afterEffectCanvasCtx = ref<CanvasRenderingContext2D | undefined>();

const currentFilterEnabled = ref(true);
const canvasFilters = ref<Webgl2RendererCanvasFilter[]>([]);

let threejsRenderer: WebGLRenderer;
let threejsComposer: EffectComposer;
let threejsScene: Scene;
let threejsCamera: OrthographicCamera;
let previewImageUrl: string;
let previewTexture: Texture;
let previewPlaneGeometry: ImagePlaneGeometry;
let previewMaterial: ShaderMaterial;
let previewFilterTextures: Texture[] = [];
let previewMesh: Mesh;

const formData = reactive<{ filterParams: Record<string, unknown> }>({
    filterParams: {}
});
const formValidationRules = ref<Rules>({});

const generatedSelectionMaskUuid = ref<string>();
const generatedMaskId = ref<number>();
const removedMaskId = ref<number>();

const layer = computed(() => {
    return getLayerById(props.layerId);
});

const currentFilterConfig = computed(() => {
    return layer.value?.filters[props.filterIndex];
});

const currentFilter = computed<Webgl2RendererCanvasFilter | undefined>(() => {
    if (canvasFilters.value) {
        return canvasFilters.value[props.filterIndex];
    }
});

const currentFilterEditConfig = computed<CanvasFilterEditConfig | undefined>(() => {
    return currentFilter.value?.getEditConfig();
});

const currentFilterName = computed<string>(() => {
    return `${currentFilterConfig.value?.name}`;
});

const currentFilterTitle = computed<string>(() => {
    return `layerFilter.${currentFilterConfig.value?.name}.name`;
});

const gradientBackgrounds = computed<Record<string, string>>(() => {
    const backgrounds: Record<string, string> = {};
    if (!currentFilterEditConfig.value) return backgrounds;
    for (const paramKey of Object.keys(currentFilterEditConfig.value)) {
        if (currentFilterEditConfig.value?.[paramKey]?.type === 'gradient') {
            const colorSpaceFieldName = currentFilterEditConfig.value?.[paramKey].colorSpaceFieldName;
            backgrounds[paramKey] = generateCssGradient(
                currentFilter.value?.params[paramKey] as never,
                currentFilter.value?.params[colorSpaceFieldName] as WorkingFileGradientColorSpace,
            );
        }
    }
    return backgrounds;
})

const isMaskApplied = computed<boolean>(() => {
    return currentFilter.value?.maskId != null;
});

const isSelectionMaskAvailable = computed<boolean>(() => {
    return !!(activeSelectionMask.value || appliedSelectionMask.value);
});

watch([layer], async ([layer]) => {
    if (layer) {
        canvasFilters.value = await createFiltersFromLayerConfig(layer?.filters ?? [], { createDisabled: true });
    }
}, { immediate: true });

watch([currentFilterConfig], async ([currentFilterConfig]) => {
    if (currentFilterConfig) {
        currentFilterEnabled.value = !currentFilterConfig.disabled;
    } else {
        onCancel();
    }
}, { immediate: true });

watch([currentFilterEditConfig, currentFilter], async ([currentFilterEditConfig, currentFilter]) => {
    if (currentFilterEditConfig && currentFilter) {
        formData.filterParams = {};
        for (const paramName in currentFilterEditConfig) {
            const paramConfig = currentFilterEditConfig[paramName];
            formData.filterParams[paramName] = currentFilter.params[paramName] ?? paramConfig.default;
        }
    }
}, { immediate: true });

// Draw previous effects to first canvas, as soon as canvas filter objects and canvases are constructed.
watch(
    [canvasFilters, beforeEffectCanvasCtx, beforeEffectCanvas, afterEffectCanvas, afterEffectCanvasCtx],
    async ([canvasFilters, beforeEffectCanvasCtx, beforeEffectCanvas, afterEffectCanvas, afterEffectCanvasCtx]) => {
    if (canvasFilters.length > 0 && beforeEffectCanvasCtx && beforeEffectCanvas && afterEffectCanvas) {
        try {
            let beforeImageData = beforeEffectCanvasCtx.getImageData(0, 0, beforeEffectCanvasCtx.canvas.width, beforeEffectCanvasCtx.canvas.height);
            const filterConfigurations = [...(layer.value?.filters ?? [])].slice(0, props.filterIndex);
            if (isUseWebGlPreview) {
                beforeEffectCanvasCtx.putImageData(beforeImageData, 0, 0);
                await calculateBeforeImageWithThreejs(beforeEffectCanvas, beforeEffectCanvasCtx, filterConfigurations);
                await initializeThreejs(afterEffectCanvas);
            } else if (afterEffectCanvasCtx) {
                beforeImageData = await bakeCanvasFilters(beforeImageData, 999999999 + Math.floor(Math.random() * 1000), filterConfigurations);
                beforeEffectCanvasCtx.putImageData(beforeImageData, 0, 0);
                afterEffectCanvasCtx.putImageData(beforeImageData, 0, 0);
            }
            updatePreview();
            loading.value = false;
        } catch (error) {
            console.error('[src/ui/module-layer-effect-edit.ts] Error setting up webgl preview. ', error);
            hasError.value = true;
        }
    }
}, { immediate: true });

// Update the preview as the user changes inputs.
watch([formData], () => {
    updatePreview();
}, { deep: true });

onMounted(async () => {
    nextTick(async () => {
        if (props.isDialog) {
            let stopWatch: WatchStopHandle;
            stopWatch = watch(() => props.dialogOpened, (dialogOpened) => {
                if (dialogOpened) {
                    stopWatch?.();
                    initialSetup();
                }
            }, { immediate: true });
        } else {
            initialSetup();
        }
    });
});

onUnmounted(() => {
    cleanupThreejs();

    if (generatedMaskId.value != null) {
        discardMaskIfUnused(generatedMaskId.value);
    }

    if (isCanceling.value && props.isFilterJustAdded) {
        historyStore.dispatch('undo');
    }
});

async function initialSetup() {
    try {
        if (layer.value) {
            if (beforeEffectCanvas.value && afterEffectCanvas.value) {
                const selectedLayer = layer.value;
                const layerWidth = selectedLayer.type === 'group' ? workingFileStore.state.width : selectedLayer.width;
                const layerHeight = selectedLayer.type === 'group' ? workingFileStore.state.height : selectedLayer.height;
                const targetWidth = 400;
                const targetHeight = targetWidth * (layerHeight / layerWidth);
                beforeEffectCanvas.value.width = targetWidth;
                beforeEffectCanvas.value.height = targetHeight;
                afterEffectCanvas.value.width = targetWidth;
                afterEffectCanvas.value.height = targetHeight;
                const beforeCanvasCtx = beforeEffectCanvas.value.getContext('2d', getCanvasRenderingContext2DSettings());
                let afterCanvasCtx;
                if (!isUseWebGlPreview) {
                    afterCanvasCtx = afterEffectCanvas.value.getContext('2d', getCanvasRenderingContext2DSettings()) ?? undefined;
                }
                if (!beforeCanvasCtx) {
                    throw new Error('module.layerEffectBrowser.generationErrorGeneral');
                }
                beforeCanvasCtx.setTransform(selectedLayer.transform.scale(layerWidth / targetWidth, layerHeight / targetHeight).invertSelf());

                const renderer = await useRenderer();
                const layerBitmap = await renderer.takeSnapshot(workingFileStore.state.width, workingFileStore.state.height, {
                    layerIds: [selectedLayer.id],
                    filters: [],
                });
                beforeCanvasCtx.drawImage(layerBitmap, 0, 0);
                layerBitmap.close();

                beforeEffectCanvasCtx.value =  beforeCanvasCtx;
                afterEffectCanvasCtx.value = afterCanvasCtx;
            } else {
                throw new Error('Canvas refs not found.');
            }
        } else {
            throw new Error('Layer not found.');
        }
    } catch (error) {
        console.error('[src/ui/module-layer-effect-edit.vue] Error setting up preview canvas. ', error);
        hasError.value = true;
    }
}

function getEditConfigMin(editConfig: CanvasFilterEditConfigField) {
    return editConfig.min ?? 0;
}

function getEditConfigMax(editConfig: CanvasFilterEditConfigField) {
    return editConfig.max ?? 1;
}

function isFilterParamDefault(fieldName: string, editConfig: CanvasFilterEditConfigField) {
    return formData.filterParams[fieldName] === editConfig.default;
}

function resetFilterParam(fieldName: string, editConfig: CanvasFilterEditConfigField) {
    formData.filterParams[fieldName] = editConfig.default;
}

async function calculateBeforeImageWithThreejs(beforeCanvas: HTMLCanvasElement, beforeEffectCanvasCtx: CanvasRenderingContext2D, beforeFilterConfigs: WorkingFileLayerFilter[]) {
    const width = beforeCanvas.width;
    const height = beforeCanvas.height;
    let renderer!: WebGLRenderer;
    let scene!: Scene;
    let imagePlaneGeometry!: ImagePlaneGeometry;
    let beforeImageUrl!: string;
    let beforeTexture!: Texture;
    let material!: ShaderMaterial;
    let mesh!: Mesh;
    let camera!: OrthographicCamera;
    let composer!: EffectComposer;
    let encounteredError: unknown;
    let filterTextures: Texture[] = [];

    try {
        const bakingCanvas = document.createElement('canvas');
        bakingCanvas.width = width;
        bakingCanvas.height = height;

        renderer = new WebGLRenderer({
            alpha: true,
            canvas: bakingCanvas,
            premultipliedAlpha: false,
            powerPreference: 'low-power'
        });
        scene = new Scene();
        imagePlaneGeometry = new ImagePlaneGeometry(width, height);

        beforeImageUrl = URL.createObjectURL(
            await createImageBlobFromCanvas(beforeCanvas)
        );
        await new Promise<void>(async (resolve, reject) => {
            beforeTexture = new TextureLoader().load(
                beforeImageUrl,
                () => resolve(),
                undefined,
                () => reject()
            );
            beforeTexture.magFilter = NearestFilter;
            beforeTexture.colorSpace = SRGBColorSpace;
        });

        const combinedShaderResult = combineFiltersToShader(await createFiltersFromLayerConfig(beforeFilterConfigs), layer.value!);
        material = createRasterShaderMaterial(beforeTexture, combinedShaderResult);
        filterTextures = combinedShaderResult.textures;

        mesh = new Mesh(imagePlaneGeometry, material);
        scene.add(mesh);

        renderer.setSize(width, height, false);
        renderer.outputColorSpace = SRGBColorSpace;

        camera = new OrthographicCamera(-1, 1, 1, -1, 1, 10000);
        camera.position.z = 1;
        camera.left = 0;
        camera.right = width;
        camera.top = 0;
        camera.bottom = height;
        camera.updateProjectionMatrix();

        composer = new EffectComposer(renderer);
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);
        composer.addPass(new ShaderPass(GammaCorrectionShader));
        composer.render();

        beforeEffectCanvasCtx.setTransform(new DOMMatrix());
        beforeEffectCanvasCtx.clearRect(0, 0, width, height);
        beforeEffectCanvasCtx.drawImage(bakingCanvas, 0, 0);
    } catch (error) {
        encounteredError = error;
    }
    
    composer?.dispose();
    renderer?.dispose();
    if (beforeImageUrl) {
        URL.revokeObjectURL(beforeImageUrl);
    }
    beforeTexture?.dispose();
    imagePlaneGeometry?.dispose();
    material?.dispose();
    for (const texture of filterTextures) {
        texture.dispose();
    }
    
    if (encounteredError) {
        throw encounteredError;
    }
}

async function initializeThreejs(afterCanvas: HTMLCanvasElement) {
    if (!currentFilter.value || !beforeEffectCanvas.value) return;
    const width = afterCanvas.width;
    const height = afterCanvas.height;

    threejsRenderer = new WebGLRenderer({
        alpha: true,
        canvas: afterCanvas,
        premultipliedAlpha: false,
        powerPreference: 'low-power'
    });
    threejsScene = new Scene();
    previewPlaneGeometry = new ImagePlaneGeometry(width, height);

    previewImageUrl = URL.createObjectURL(await createImageBlobFromCanvas(beforeEffectCanvas.value));
    await new Promise<void>(async (resolve, reject) => {
        previewTexture = new TextureLoader().load(
            previewImageUrl,
            () => resolve(),
            undefined,
            () => reject()
        );
        previewTexture.magFilter = NearestFilter;
        previewTexture.colorSpace = SRGBColorSpace;
    });

    const combinedShaderResult = combineFiltersToShader([currentFilter.value], layer.value!);
    previewMaterial = createRasterShaderMaterial(previewTexture, combinedShaderResult);
    previewFilterTextures = combinedShaderResult.textures;

    previewMesh = new Mesh(previewPlaneGeometry, previewMaterial);
    threejsScene.add(previewMesh);

    threejsRenderer.setSize(width, height, false);
    threejsRenderer.outputColorSpace = SRGBColorSpace;

    threejsCamera = new OrthographicCamera(-1, 1, 1, -1, 1, 10000);
    threejsCamera.position.z = 1;
    threejsCamera.left = 0;
    threejsCamera.right = width;
    threejsCamera.top = 0;
    threejsCamera.bottom = height;
    threejsCamera.updateProjectionMatrix();

    threejsComposer = new EffectComposer(threejsRenderer);
    const renderPass = new RenderPass(threejsScene, threejsCamera);
    threejsComposer.addPass(renderPass);
    threejsComposer.addPass(new ShaderPass(GammaCorrectionShader));

    threejsComposer.render();
}

function cleanupThreejs() {
    threejsRenderer?.dispose();
    (threejsRenderer as any) = undefined;
    (threejsScene as any) = undefined;
    (threejsCamera as any) = undefined;
    if (previewImageUrl) {
        URL.revokeObjectURL(previewImageUrl);
        (previewImageUrl as any) = undefined;
    }
    previewTexture?.dispose();
    (previewTexture as any) = undefined;
    previewPlaneGeometry?.dispose();
    (previewPlaneGeometry as any) = undefined;
    previewMaterial?.dispose();
    (previewMaterial as any) = undefined;
    (previewMesh as any) = undefined;
    threejsComposer?.dispose();
    (threejsComposer as any) = undefined;
    for (const texture of previewFilterTextures) {
        texture.dispose();
    }
    previewFilterTextures = [];
}

function isParamsChanged(oldParams: Record<string, unknown>, newParams: Record<string, unknown>) {
    const oldKeys = Object.keys(oldParams).sort();
    const newKeys = Object.keys(newParams).sort();
    if (oldKeys.length != newKeys.length) {
        return true;
    }
    for (let i = 0; i < oldKeys.length; i++) {
        if (oldKeys[i] !== newKeys[i]) {
            return true;
        }
        if (oldParams[oldKeys[i]] !== newParams[newKeys[i]]) {
            return true;
        }
    }
    return false;
}

function buildEditParamsFromFromData(): Record<string, unknown> {
    if (currentFilter.value) {
        return buildCanvasFilterParamsFromFormData(currentFilter.value, formData.filterParams);
    } else {
        return {};
    }
}

const updatePreview = throttle(function () {
    const beforeCtx = beforeEffectCanvasCtx.value;
    const afterCtx = afterEffectCanvasCtx.value;
    if (!currentFilter.value) return;
    if (isUseWebGlPreview) {
        if (threejsComposer && previewMaterial) {
            currentFilter.value.params = buildEditParamsFromFromData();
            const { uniforms: newUniforms, defines: newDefines } = generateShaderUniformsAndDefines([currentFilter.value], layer.value!);
            for (const defineName in newDefines) {
                previewMaterial.defines[defineName] = newDefines[defineName];
            }
            for (const uniformName in newUniforms) {
                previewMaterial.uniforms[uniformName] = newUniforms[uniformName];
            }
            previewMaterial.needsUpdate = true;
            threejsComposer.render();
        }
    } else {
        if (currentFilter.value && beforeCtx && afterCtx) {
            currentFilter.value.params = buildEditParamsFromFromData();
            let beforeImageData = beforeCtx.getImageData(0, 0, beforeCtx.canvas.width, beforeCtx.canvas.height);
            beforeImageData = applyCanvasFilter(beforeImageData, currentFilter.value);
            (afterCtx as CanvasRenderingContext2D).putImageData(beforeImageData, 0, 0);
        }
    }
}, 20);

async function onCreateSelectionMask() {
    const selectionMask = activeSelectionMask.value || appliedSelectionMask.value;
    const selectionMaskCanvasOffset = activeSelectionMaskCanvasOffset.value || appliedSelectionMaskCanvasOffset.value;
    const activeLayer = layer.value;
    if (afterEffectCanvas.value && selectionMask && activeLayer) {
        cleanupThreejs();

        const masks = workingFileStore.get('masks');
        let maskIdCounter = workingFileStore.get('maskIdCounter');
        if (generatedSelectionMaskUuid.value) {
            deleteStoredImage(generatedSelectionMaskUuid.value);
        }
        generatedSelectionMaskUuid.value = await createStoredImage(
            await resampleSelectionMaskInLayerBounds(
                selectionMask,
                selectionMaskCanvasOffset,
                new DOMPoint(activeLayer.width ?? 1, activeLayer.height ?? 1),
                getLayerGlobalTransform(activeLayer.id),
            )
        );
        const storedMaskImage = getStoredImageOrCanvas(generatedSelectionMaskUuid.value);
        if (storedMaskImage) {
            if (generatedMaskId.value != null && masks[generatedMaskId.value]) {
                delete masks[generatedMaskId.value];
            } else {
                generatedMaskId.value = maskIdCounter++;
                workingFileStore.set('maskIdCounter', maskIdCounter);
            }
            const mask = {
                sourceUuid: generatedSelectionMaskUuid.value,
                offset: new DOMPoint(0, 0),
                hash: await generateImageHash(storedMaskImage),
            };
            masks[generatedMaskId.value] = mask;
            workingFileStore.set('masks', masks);
            if (canvasFilters.value[props.filterIndex]) {
                canvasFilters.value[props.filterIndex].maskId = generatedMaskId.value;
            }
        } else {
            deleteStoredImage(generatedSelectionMaskUuid.value);
        }

        initializeThreejs(afterEffectCanvas.value);
    }
}

async function onClickStopGradientSelect(fieldName: string) {
    const colorSpaceFieldName = (currentFilterEditConfig.value?.[fieldName] as CanvasFilterEditConfigGradient).colorSpaceFieldName;
    const blendColorSpace = formData.filterParams[colorSpaceFieldName];
    appEmitter.emit('app.dialogs.openFromDock', {
        name: 'gradient-editor',
        props: {
            isDialog: true,
            gradient: JSON.parse(JSON.stringify(formData.filterParams[fieldName])),
            blendColorSpace: {
                0: 'oklab',
                1: 'srgb',
                2: 'linearSrgb',
            }[blendColorSpace as number] ?? blendColorSpace,
        },
        onClose: (event?: any) => {
            if (event?.gradient) {
                formData.filterParams[fieldName] = event.gradient;
            }
        }
    });
}

function onKeydownStopGradientSelect(event: KeyboardEvent, fieldName: string) {
    if (event.key === 'Enter' || event.key === ' ') {
        onClickStopGradientSelect(fieldName);
    }
}

function onClearMask() {
    if (afterEffectCanvas.value && canvasFilters.value[props.filterIndex].maskId != null) {
        cleanupThreejs();
        if (canvasFilters.value[props.filterIndex].maskId !== generatedMaskId.value) {
            removedMaskId.value = canvasFilters.value[props.filterIndex].maskId;
        }
        canvasFilters.value[props.filterIndex].maskId = undefined;
        initializeThreejs(afterEffectCanvas.value);
    }
}

function onDelete() {
    if (props.isFilterJustAdded) {
        onCancel();
        return;
    }
    if (layer.value) {
        isDeleting.value = true;
        historyStore.dispatch('runAction', {
            action: new DeleteLayerFilterAction(layer.value.id, props.filterIndex)
        })
        emit('close');
    } else {
        $notify({
            type: 'error',
            message: t('module.layerEffectEdit.deleteFilterError')
        })
    }
}

function onCancel() {
    isCanceling.value = true;
    emit('close');
}

async function onConfirm() {
    if (layer.value && currentFilterConfig.value) {
        const layerId = layer.value.id;
        let actions: BaseAction[] = [];
        if ((currentFilterEnabled.value === true) !== ((!currentFilterConfig.value.disabled) === true)) {
            actions.push(
                new UpdateLayerFilterDisabledAction(layerId, props.filterIndex, !currentFilterEnabled.value)
            );
        }
        const newParams = buildEditParamsFromFromData();
        if (isParamsChanged(currentFilterConfig.value.params, newParams)) {
            actions.push(
                new UpdateLayerFilterParamsAction(layerId, props.filterIndex, newParams)
            );
        }

        if (generatedMaskId.value != null && canvasFilters.value[props.filterIndex].maskId === generatedMaskId.value) {
            actions.push(
                new UpdateLayerFilterMaskAction(layerId, props.filterIndex, generatedMaskId.value)
            );
            generatedMaskId.value = undefined;
        } else if (removedMaskId.value != null && canvasFilters.value[props.filterIndex].maskId == null) {
            actions.push(
                new UpdateLayerFilterMaskAction(layerId, props.filterIndex, undefined)
            );
        }

        if (actions.length > 0) {
            await historyStore.dispatch('runAction', {
                action: new BundleAction('applyLayerFilterChanges', 'action.updateLayerFilterParams', actions)
            });
        }
        emit('close');
    } else {
        $notify({
            type: 'error',
            message: t('module.layerEffectEdit.applyFilterError')
        })
    }
}
</script>
