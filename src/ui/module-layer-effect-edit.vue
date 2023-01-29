<template>
    <el-alert v-if="hasError" type="error" show-icon :closable="false" :title="$t('module.layerEffectEdit.generalError')" />
    <div v-else v-loading="loading" :element-loading-text="$t('module.layerEffectEdit.loading')">
        <div class="is-flex is-flex-row is-align-items-center">
            <canvas ref="beforeEffectCanvas" style="width: 100%; height: auto; max-height: 40vh; background-image: url('../images/transparency-bg.png')" />
            <span class="bi bi-arrow-right-short is-flex-shrink-1 is-size-1" aria-hidden="true" />
            <canvas ref="afterEffectCanvas" style="width: 100%; height: auto; max-height: 40vh; background-image: url('../images/transparency-bg.png')" />
        </div>
        <el-divider />
        <div class="is-flex is-flex-row is-align-items-center is-justify-content-space-between">
            <h2 v-t="currentFilterName" class="m-0" />
            <div class="is-flex is-flex-row is-align-items-center is-flex-shrink-1">
                <el-switch
                    v-model="currentFilterEnabled"
                    :active-text="$t('module.layerEffectEdit.enableToggle')"
                    class="mr-4 el-switch--label-align-fix-sm-above"
                />
                <el-button link type="danger" class="el-text-alignment-fix--below">
                    <span class="bi bi-trash mr-1 el-text-alignment-fix--above" aria-hidden="true" />
                    <span v-t="'module.layerEffectEdit.deleteEffect'" />
                </el-button>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import layerFilterList from '@/config/layer-filters.json';
import ElAlert from 'element-plus/lib/components/alert/index';
import ElAutoGrid from './el-auto-grid.vue';
import ElButton from 'element-plus/lib/components/button/index';
import ElCard from 'element-plus/lib/components/card/index';
import ElDivider from 'element-plus/lib/components/divider/index';
import ElLoading from 'element-plus/lib/components/loading/index';
import ElSwitch from 'element-plus/lib/components/switch/index';
import historyStore from '@/store/history';
import workingFileStore, { getLayerById } from '@/store/working-file';
import { notifyInjector } from '@/lib/notify';
import layerRenderers from '@/canvas/renderers';
import { createImageBlobFromCanvas } from '@/lib/image';
import { getCanvasFilterClass, applyCanvasFilter, buildCanvasFilterPreviewParams } from '@/canvas/filters';
import { AddLayerFilterAction } from '@/actions/add-layer-filter';
import { BundleAction } from '@/actions/bundle';

import type { WorkingFileLayerFilter } from '@/types';

interface LayerFilterTemplateModel {
    id: string;
    name: string;
}

interface LayerFilterCategoryTemplateModel {
    name: string;
    filters: LayerFilterTemplateModel[];
}

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
        ElDivider,
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

        const $notify = notifyInjector('$notify');

        const hasError = ref(false);
        const loading = ref(true);
        const beforeEffectCanvas = ref<HTMLCanvasElement>();
        const afterEffectCanvas = ref<HTMLCanvasElement>();

        const currentFilterEnabled = ref(true);

        const layer = computed(() => {
            return getLayerById(props.layerId);
        });

        const currentFilterConfig = computed(() => {
            return layer.value?.filters[props.filterIndex];
        });

        const currentFilterName = computed<string>(() => {
            return `layerFilter.${currentFilterConfig.value?.name}.name`;
        });

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
                            const afterCanvasCtx = afterEffectCanvas.value.getContext('2d');
                            if (!beforeCanvasCtx || !afterCanvasCtx) {
                                throw new Error('module.layerEffectBrowser.generationErrorGeneral');
                            }
                            beforeCanvasCtx.setTransform(selectedLayer.transform.scale(layerWidth / targetWidth, layerHeight / targetHeight).invertSelf());
                            if (layerRenderers['2d'][selectedLayer?.type]) {
                                const layerRenderer = new layerRenderers['2d'][selectedLayer.type]();
                                await layerRenderer.attach(selectedLayer);
                                await layerRenderer.draw(beforeCanvasCtx, selectedLayer, { visible: true, force2dRenderer: true });
                            } else {
                                throw new Error('module.layerEffectBrowser.generationErrorUnsupportedType');
                            }
                            const originalImageData = beforeCanvasCtx.getImageData(0, 0, targetWidth, targetHeight);
                            afterCanvasCtx.putImageData(originalImageData, 0, 0);

                            loading.value = false;
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
        
        function onCancel() {
            emit('close');
        }
        
        return {
            hasError,
            loading,
            beforeEffectCanvas,
            afterEffectCanvas,
            currentFilterConfig,
            currentFilterName,
            currentFilterEnabled,
            onCancel,
        };
    }
});
</script>
