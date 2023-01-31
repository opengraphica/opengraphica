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
            <template v-for="(editConfigField, paramName) in currentFilterEditConfig" :key="paramName">
                <el-form-item-group>
                    <el-form-item :label="$t(`layerFilter.${currentFilterName}.param.${paramName}`)">
                        <template v-if="editConfigField.type === 'percentage'">
                            <el-row>
                                <el-col :span="16" :xs="14">
                                    <el-slider
                                        v-model="formData.filterParams[paramName]"
                                        :min="getEditConfigMin(editConfigField)"
                                        :max="getEditConfigMax(editConfigField)"
                                        :step="0.01"
                                        :show-tooltip="false"
                                    />
                                </el-col>
                                <el-col :span="8" :xs="10">
                                    <el-input-number
                                        :modelValue="Math.floor(formData.filterParams[paramName] * 100)"
                                        :min="getEditConfigMin(editConfigField) * 100"
                                        :max="getEditConfigMax(editConfigField) * 100"
                                        :precision="0"
                                        class="el-input--text-right"
                                        @update:modelValue="formData.filterParams[paramName] = $event / 100"
                                    >
                                        <template v-slot:append>%</template>
                                    </el-input-number>
                                </el-col>
                            </el-row>
                        </template>
                    </el-form-item>
                </el-form-item-group>
            </template>
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
import { defineComponent, ref, computed, onMounted, onUnmounted, nextTick, reactive, watch } from 'vue';
import layerFilterList from '@/config/layer-filters.json';
import { useI18n } from '@/i18n';
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
import ElSwitch from 'element-plus/lib/components/switch/index';
import ElRow from 'element-plus/lib/components/row/index';
import historyStore from '@/store/history';
import workingFileStore, { getLayerById } from '@/store/working-file';
import { notifyInjector } from '@/lib/notify';
import { throttle } from '@/lib/timing';
import layerRenderers from '@/canvas/renderers';
import { createImageBlobFromCanvas } from '@/lib/image';
import { isWebGLAvailable } from '@/lib/webgl';
import { createFiltersFromLayerConfig, getCanvasFilterClass, applyCanvasFilter, buildCanvasFilterPreviewParams, generateShaderUniforms, combineShaders } from '@/canvas/filters';
import { UpdateLayerFilterDisabledAction } from '@/actions/update-layer-filter-disabled';
import { UpdateLayerFilterParamsAction } from '@/actions/update-layer-filter-params';
import { DeleteLayerFilterAction } from '@/actions/delete-layer-filter';
import { BundleAction } from '@/actions/bundle';
import { Rules, RuleItem } from 'async-validator';
import { bakeCanvasFilters } from '@/workers';

import { Scene } from 'three/src/scenes/Scene';
import { WebGLRenderer } from 'three/src/renderers/WebGLRenderer';
import { ImagePlaneGeometry } from '@/canvas/renderers/webgl/geometries/image-plane-geometry';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import { DoubleSide, NearestFilter } from 'three/src/constants';
import { Mesh } from 'three/src/objects/Mesh';
import { TextureLoader } from 'three/src/loaders/TextureLoader';
import { Texture } from 'three/src/textures/Texture';
import { OrthographicCamera } from 'three/src/cameras/OrthographicCamera';

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
        ElRow,
        ElSlider,
        ElSwitch
    },
    emits: [
        'update:title',
        'update:dialogSize',
        'close'
    ],
    props: {
        layerId: {
            type: Number,
            required: true
        },
        filterIndex: {
            type: Number,
            default: 0
        }
    },
    setup(props, { emit }) {
        emit('update:title', 'module.layerEffectEdit.title');
        emit('update:dialogSize', 'medium-large');

        const { t } = useI18n();
        const $notify = notifyInjector('$notify');

        const isUseWebGlPreview = isWebGLAvailable();
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
                    formData.filterParams[paramName] = currentFilter.params[paramName] ?? currentFilterEditConfig[paramName].default;
                }
            }
        }, { immediate: true });

        // Draw previous effects to first canvas, as soon as canvas filter objects and canvases are constructed.
        watch(
            [canvasFilters, beforeEffectCanvasCtx, afterEffectCanvas, afterEffectCanvasCtx],
            async ([canvasFilters, beforeEffectCanvasCtx, afterEffectCanvas, afterEffectCanvasCtx]) => {
            if (canvasFilters.length > 0 && beforeEffectCanvasCtx && afterEffectCanvas) {
                try {
                    let beforeImageData = beforeEffectCanvasCtx.getImageData(0, 0, beforeEffectCanvasCtx.canvas.width, beforeEffectCanvasCtx.canvas.height);
                    const filterConfigurations = [...(layer.value?.filters ?? [])].slice(0, props.filterIndex);
                    beforeImageData = await bakeCanvasFilters(beforeImageData, 999999999 + Math.floor(Math.random() * 1000), filterConfigurations);
                    // for (let i = 0; i < props.filterIndex; i++) {
                        // beforeImageData = applyCanvasFilter(beforeImageData, canvasFilters[i]);
                    // }
                    beforeEffectCanvasCtx.putImageData(beforeImageData, 0, 0);
                    if (isUseWebGlPreview) {
                        await initializeThreejs(afterEffectCanvas);
                    } else if (afterEffectCanvasCtx) {
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
                            const beforeCanvasCtx = beforeEffectCanvas.value.getContext('2d');
                            let afterCanvasCtx;
                            if (!isUseWebGlPreview) {
                                afterCanvasCtx = afterEffectCanvas.value.getContext('2d') ?? undefined;
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
            });
        });

        onUnmounted(() => {
            cleanupThreejs();
        });

        function getEditConfigMin(editConfig: CanvasFilterEditConfigField) {
            return editConfig.min ?? 0;
        }

        function getEditConfigMax(editConfig: CanvasFilterEditConfigField) {
            return editConfig.max ?? 1;
        }

        async function initializeThreejs(canvas: HTMLCanvasElement) {
            if (!currentFilter.value || !beforeEffectCanvas.value) return;
            const width = canvas.width;
            const height = canvas.height;

            threejsRenderer = new WebGLRenderer({
                alpha: true,
                canvas
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
            });

            const combinedShaderResult = combineShaders([currentFilter.value]);
            previewMaterial = new ShaderMaterial({
                transparent: true,
                depthTest: false,
                vertexShader: combinedShaderResult.vertexShader,
                fragmentShader: combinedShaderResult.fragmentShader,
                side: DoubleSide,
                uniforms: {
                    map: { value: previewTexture },
                    ...combinedShaderResult.uniforms
                }
            });

            previewMesh = new Mesh(previewPlaneGeometry, previewMaterial);
            threejsScene.add(previewMesh);
            threejsRenderer.setSize(width, height, false);
            threejsCamera = new OrthographicCamera(-1, 1, 1, -1, 1, 10000);
            threejsCamera.position.z = 1;
            threejsCamera.left = 0;
            threejsCamera.right = width;
            threejsCamera.top = 0;
            threejsCamera.bottom = height;
            threejsCamera.updateProjectionMatrix();
            threejsRenderer.render(threejsScene, threejsCamera);
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
            const params: Record<string, unknown> = {};
            if (currentFilterEditConfig.value) {
                for (const paramName in currentFilterEditConfig.value) {
                    params[paramName] = formData.filterParams[paramName];
                }
            }
            return params;
        }

        const updatePreview = throttle(function () {
            const beforeCtx = beforeEffectCanvasCtx.value;
            const afterCtx = afterEffectCanvasCtx.value;
            if (!currentFilter.value) return;
            if (isUseWebGlPreview) {
                if (threejsRenderer && previewMaterial) {
                    currentFilter.value.params = buildEditParamsFromFromData();
                    const newUniforms = generateShaderUniforms([currentFilter.value]);
                    for (const uniformName in newUniforms) {
                        previewMaterial.uniforms[uniformName] = newUniforms[uniformName];
                    }
                    threejsRenderer.render(threejsScene, threejsCamera);
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
            emit('close');
        }

        async function onConfirm() {
            if (layer.value && currentFilterConfig.value) {
                let actions = [];
                if ((currentFilterEnabled.value === true) !== ((!currentFilterConfig.value.disabled) === true)) {
                    actions.push(
                        new UpdateLayerFilterDisabledAction(layer.value.id, props.filterIndex, !currentFilterEnabled.value)
                    );
                }
                const newParams = buildEditParamsFromFromData();
                if (isParamsChanged(currentFilterConfig.value.params, newParams)) {
                    actions.push(
                        new UpdateLayerFilterParamsAction(layer.value.id, props.filterIndex, newParams)
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
            onDelete,
            onCancel,
            onConfirm
        };
    }
});
</script>
