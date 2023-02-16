<template>
    <el-alert v-if="hasError" type="error" show-icon :closable="false" :title="$t('module.layerEffectEdit.generalError')" />
    <div v-else-if="isDeleting" v-loading="true" :element-loading-text="$t('module.layerEffectEdit.deleting')" style="height: 15rem" />
    <div v-else v-loading="loading" :element-loading-text="$t('module.layerEffectEdit.loading')">
        <div class="is-flex is-flex-row is-align-items-center">
            <canvas ref="beforeEffectCanvas" style="width: 100%; min-width: 0; height: auto; max-height: 40vh; background-image: url('../images/transparency-bg.png')" />
            <span class="bi bi-arrow-right-short is-flex-shrink-1 is-size-1 has-text-color-fill-darker" :style="{ visibility: currentFilterEnabled ? undefined : 'hidden' }" aria-hidden="true" />
            <canvas ref="afterEffectCanvas" style="width: 100%; min-width: 0; height: auto; max-height: 40vh; background-image: url('../images/transparency-bg.png')" :style="{ visibility: currentFilterEnabled ? undefined : 'hidden' }" />
        </div>
        <el-divider />
        <div class="is-flex is-flex-row is-align-items-center is-justify-content-space-between">
            <h2 v-t="currentFilterTitle" class="m-0" />
            <div class="is-flex is-flex-row is-align-items-center is-flex-shrink-1">
                <el-switch
                    v-model="currentFilterEnabled"
                    :active-text="$t('module.layerEffectEdit.enableToggle')"
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
                    <el-form-item v-if="!editConfigField.hidden" :label="$t(`layerFilter.${currentFilterName}.param.${paramName}`)">
                        <template v-if="editConfigField.type === 'percentage'">
                            <el-row>
                                <el-col :span="20" :xs="18">
                                    <el-slider
                                        v-model="formData.filterParams[paramName]"
                                        :min="getEditConfigMin(editConfigField)"
                                        :max="getEditConfigMax(editConfigField)"
                                        :step="0.01"
                                        :show-tooltip="false"
                                    />
                                </el-col>
                                <el-col :span="4" :xs="6">
                                    <el-input-number
                                        :modelValue="Math.floor(formData.filterParams[paramName] * 100)"
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
                            <el-button
                                link type="primary" class="el-button--form-item-reset"
                                :disabled="isFilterParamDefault(paramName, editConfigField)"
                                :aria-label="$t('module.layerEffectEdit.resetField')"
                                @click="resetFilterParam(paramName, editConfigField)">
                                <span class="bi bi-arrow-repeat" aria-hidden="true" />
                            </el-button>
                        </template>
                        <template v-if="editConfigField.type === 'percentageRange'">
                            <el-row>
                                <el-col :span="4" :xs="6">
                                    <el-input-number
                                        :modelValue="Math.floor(formData.filterParams[paramName][0] * 100)"
                                        :min="getEditConfigMin(editConfigField) * 100"
                                        :max="getEditConfigMax(editConfigField) * 100"
                                        :precision="0"
                                        suffixText="%"
                                        class="el-input--text-right"
                                        @update:modelValue="formData.filterParams[paramName][0] = $event / 100"
                                    >
                                    </el-input-number>
                                </el-col>
                                <el-col :span="16" :xs="12">
                                    <el-slider
                                        v-model="formData.filterParams[paramName]"
                                        range
                                        :min="getEditConfigMin(editConfigField)"
                                        :max="getEditConfigMax(editConfigField)"
                                        :step="0.01"
                                        :show-tooltip="false"
                                    />
                                </el-col>
                                <el-col :span="4" :xs="6">
                                    <el-input-number
                                        :modelValue="Math.floor(formData.filterParams[paramName][1] * 100)"
                                        :min="getEditConfigMin(editConfigField) * 100"
                                        :max="getEditConfigMax(editConfigField) * 100"
                                        :precision="0"
                                        suffixText="%"
                                        class="el-input--text-right"
                                        @update:modelValue="formData.filterParams[paramName][1] = $event / 100"
                                    >
                                    </el-input-number>
                                </el-col>
                            </el-row>
                            <el-button
                                link type="primary" class="el-button--form-item-reset"
                                :disabled="isFilterParamDefault(paramName, editConfigField)"
                                :aria-label="$t('module.layerEffectEdit.resetField')"
                                @click="resetFilterParam(paramName, editConfigField)">
                                <span class="bi bi-arrow-repeat" aria-hidden="true" />
                            </el-button>
                        </template>
                        <template v-else-if="editConfigField.type === 'integer' && editConfigField.options">
                            <el-select v-model="formData.filterParams[paramName]" popper-class="el-select-dropdown--unlocked-option-height">
                                <el-option
                                    v-for="option of editConfigField.options"
                                    :key="option.key"
                                    :label="$t(`layerFilter.${currentFilterName}.param.${paramName}Option.${option.key}`)"
                                    :value="option.value"
                                >
                                    <div style="line-height: 1.4em" class="py-2">
                                        <div>{{ $t(`layerFilter.${currentFilterName}.param.${paramName}Option.${option.key}`) }}</div>
                                        <div v-if="editConfigField.optionsHaveDescriptions" class="has-text-color-placeholder">
                                            {{ $t(`layerFilter.${currentFilterName}.param.${paramName}OptionDescription.${option.key}`) }}
                                        </div>
                                    </div>
                                </el-option>
                            </el-select>
                            <el-button
                                link type="primary" class="el-button--form-item-reset"
                                :disabled="isFilterParamDefault(paramName, editConfigField)"
                                :aria-label="$t('module.layerEffectEdit.resetField')"
                                @click="resetFilterParam(paramName, editConfigField)">
                                <span class="bi bi-arrow-repeat" aria-hidden="true" />
                            </el-button>
                        </template>
                        <template v-else-if="editConfigField.type === 'boolean'">
                            <el-switch v-model="formData.filterParams[paramName]" />
                            <el-button
                                link type="primary" class="el-button--form-item-reset"
                                :disabled="isFilterParamDefault(paramName, editConfigField)"
                                :aria-label="$t('module.layerEffectEdit.resetField')"
                                @click="resetFilterParam(paramName, editConfigField)">
                                <span class="bi bi-arrow-repeat" aria-hidden="true" />
                            </el-button>
                        </template>
                    </el-form-item>
                </template>
            </el-form-item-group>
        </el-form>
        <div class="has-text-right">
            <el-divider />
            <div class="has-text-right">
                <el-button @click="onCancel">{{ $t('button.cancel') }}</el-button>
                <el-button type="primary" @click="onConfirm">{{ $t('button.apply') }}</el-button>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, onUnmounted, nextTick, reactive, watch, WatchStopHandle } from 'vue';
import { Rules } from 'async-validator';
import ElAlert from 'element-plus/lib/components/alert/index';
import ElAutoGrid from './el-auto-grid.vue';
import ElButton from 'element-plus/lib/components/button/index';
import ElCard from 'element-plus/lib/components/card/index';
import ElCol from 'element-plus/lib/components/col/index';
import ElDivider from 'element-plus/lib/components/divider/index';
import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElFormItemGroup from '@/ui/el-form-item-group.vue';
import ElInputNumber from '@/ui/el-input-number.vue';
import ElLoading from 'element-plus/lib/components/loading/index';
import ElSlider from 'element-plus/lib/components/slider/index';
import ElSelect, { ElOption } from 'element-plus/lib/components/select/index';
import ElSwitch from 'element-plus/lib/components/switch/index';
import ElRow from 'element-plus/lib/components/row/index';

import { useI18n } from '@/i18n';
import historyStore from '@/store/history';
import workingFileStore, { getCanvasRenderingContext2DSettings, getLayerById } from '@/store/working-file';
import { notifyInjector } from '@/lib/notify';
import { throttle } from '@/lib/timing';
import layerRenderers from '@/canvas/renderers';
import { createImageBlobFromCanvas } from '@/lib/image';
import { isWebGLAvailable } from '@/lib/webgl';
import { createRasterShaderMaterial } from '@/canvas/renderers/webgl/shaders';
import { buildCanvasFilterParamsFromFormData, createFiltersFromLayerConfig, applyCanvasFilter, generateShaderUniformsAndDefines, combineShaders } from '@/canvas/filters';
import { UpdateLayerFilterDisabledAction } from '@/actions/update-layer-filter-disabled';
import { UpdateLayerFilterParamsAction } from '@/actions/update-layer-filter-params';
import { DeleteLayerFilterAction } from '@/actions/delete-layer-filter';
import { BundleAction } from '@/actions/bundle';
import { bakeCanvasFilters } from '@/workers';

import { Scene } from 'three/src/scenes/Scene';
import { WebGLRenderer } from 'three/src/renderers/WebGLRenderer';
import { ImagePlaneGeometry } from '@/canvas/renderers/webgl/geometries/image-plane-geometry';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import { DoubleSide, NearestFilter, sRGBEncoding } from 'three/src/constants';
import { Mesh } from 'three/src/objects/Mesh';
import { TextureLoader } from 'three/src/loaders/TextureLoader';
import { Texture } from 'three/src/textures/Texture';
import { OrthographicCamera } from 'three/src/cameras/OrthographicCamera';
import { EffectComposer } from '@/canvas/renderers/webgl/three/postprocessing/EffectComposer';
import { RenderPass } from '@/canvas/renderers/webgl/three/postprocessing/RenderPass';
import { ShaderPass } from '@/canvas/renderers/webgl/three/postprocessing/ShaderPass';
import { GammaCorrectionShader } from '@/canvas/renderers/webgl/three/shaders/GammaCorrectionShader';

import type { WorkingFileLayerFilter, CanvasFilter, CanvasFilterEditConfig, CanvasFilterEditConfigField } from '@/types';

export default defineComponent({
    name: 'ModuleLayerEffectEdit',
    inheritAttrs: false,
    directives: {
        loading: ElLoading.directive
    },
    components: {
        ElAlert,
        ElAutoGrid,
        ElButton,
        ElCard,
        ElCol,
        ElDivider,
        ElForm,
        ElFormItem,
        ElFormItemGroup,
        ElInputNumber,
        ElOption,
        ElRow,
        ElSelect,
        ElSlider,
        ElSwitch
    },
    emits: [
        'update:title',
        'update:dialogSize',
        'close'
    ],
    props: {
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
    },
    setup(props, { emit }) {
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
        const canvasFilters = ref<CanvasFilter[]>([]);

        let threejsRenderer: WebGLRenderer;
        let threejsComposer: EffectComposer;
        let threejsScene: Scene;
        let threejsCamera: OrthographicCamera;
        let previewImageUrl: string;
        let previewTexture: Texture;
        let previewPlaneGeometry: ImagePlaneGeometry;
        let previewMaterial: ShaderMaterial;
        let previewMesh: Mesh;

        const formData = reactive<{ filterParams: Record<string, unknown> }>({
            filterParams: {}
        });
        const formValidationRules = ref<Rules>({});

        const layer = computed(() => {
            return getLayerById(props.layerId);
        });

        const currentFilterConfig = computed(() => {
            return layer.value?.filters[props.filterIndex];
        });

        const currentFilter = computed<CanvasFilter | undefined>(() => {
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

        watch([layer], async ([layer]) => {
            if (layer) {
                canvasFilters.value = await createFiltersFromLayerConfig(layer?.filters ?? [], { createDisabled: true });
            }
        }, { immediate: true });

        watch([currentFilterConfig], async ([currentFilterConfig]) => {
            if (currentFilterConfig) {
                currentFilterEnabled.value = !currentFilterConfig.disabled;
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
                    console.error(error);
                    hasError.value = true;
                }
            }
        }, { immediate: true });

        // Update the preview as the user changes inputs.
        watch([formData], ([formData]) => {
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
                        if (layerRenderers['2d'][selectedLayer?.type]) {
                            const layerRenderer = new layerRenderers['2d'][selectedLayer.type]();
                            await layerRenderer.attach(selectedLayer);
                            const bakedImage = selectedLayer.bakedImage;
                            selectedLayer.bakedImage = null;
                            await layerRenderer.draw(beforeCanvasCtx, selectedLayer, { visible: true, force2dRenderer: true });
                            selectedLayer.bakedImage = bakedImage;
                        } else {
                            throw new Error('module.layerEffectBrowser.generationErrorUnsupportedType');
                        }
                        beforeEffectCanvasCtx.value =  beforeCanvasCtx;
                        afterEffectCanvasCtx.value = afterCanvasCtx;
                    } else {
                        throw new Error('Canvas refs not found.');
                    }
                } else {
                    throw new Error('Layer not found.');
                }
            } catch (error) {
                console.error(error);
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
                    beforeTexture.encoding = sRGBEncoding;
                });

                const combinedShaderResult = combineShaders(await createFiltersFromLayerConfig(beforeFilterConfigs), layer.value!);
                material = createRasterShaderMaterial(beforeTexture, combinedShaderResult);

                mesh = new Mesh(imagePlaneGeometry, material);
                scene.add(mesh);

                renderer.setSize(width, height, false);
                renderer.outputEncoding = sRGBEncoding;

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
                previewTexture.encoding = sRGBEncoding;
            });

            const combinedShaderResult = combineShaders([currentFilter.value], layer.value!);
            previewMaterial = createRasterShaderMaterial(previewTexture, combinedShaderResult);

            previewMesh = new Mesh(previewPlaneGeometry, previewMaterial);
            threejsScene.add(previewMesh);

            threejsRenderer.setSize(width, height, false);
            threejsRenderer.outputEncoding = sRGBEncoding;

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

        function onDelete() {
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
                let actions = [];
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
        
        return {
            hasError,
            isDeleting,
            loading,
            beforeEffectCanvas,
            afterEffectCanvas,
            currentFilterConfig,
            currentFilterName,
            currentFilterTitle,
            currentFilterEnabled,
            currentFilterEditConfig,
            formData,
            formValidationRules,
            getEditConfigMin,
            getEditConfigMax,
            isFilterParamDefault,
            resetFilterParam,
            onDelete,
            onCancel,
            onConfirm
        };
    }
});
</script>
