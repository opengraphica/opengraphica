<template>
    <el-alert v-if="filterGenerationErrorMessage" type="error" show-icon :closable="false" :title="$t(filterGenerationErrorMessage)" />
    <div v-else-if="!hasFilterPreviewThumbnails" v-loading="true" :element-loading-text="$t('module.layerEffectBrowser.loading')" style="height: 15rem" />
    <template v-else>
        <el-auto-grid item-width="8rem" :breakpoints="[{ maxWidth: 525, itemWidth: '6rem' }]">
            <template v-for="category of categorizedFilters" :key="category.name">
                <h3 class="mb-0 mt-2" style="grid-column: 1 / -1;">{{ t(category.name) }}</h3>
                <template
                    v-for="filter of category.filters"
                    :key="filter.name"
                >
                    <el-card :body-style="{ padding: '0px' }" class="el-card--link" role="button" tabindex="0" style="border-radius: 0.875rem; max-width: 15rem" @click="onSelectFilter(filter.id)">
                        <div style="max-height: 10rem; overflow: hidden;">
                            <img
                                :src="filterPreviewThumbnails[filter.id]"
                                :style="{
                                    'width': '100%',
                                    'height': previewImageHeight,
                                    'background-image': 'url(\'../images/transparency-bg.png\')',
                                    'background-repeat': 'repeat'
                                }"
                            />
                        </div>
                        <div class="p-2 text-center">{{ t(filter.name) }}</div>
                    </el-card>
                </template>
            </template>
        </el-auto-grid>
    </template>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, onUnmounted, nextTick, type PropType } from 'vue';
import { useI18n } from '@/i18n';
import layerFilterList from '@/config/layer-filters.json';
import ElAlert from 'element-plus/lib/components/alert/index';
import ElAutoGrid from '@/ui/el/el-auto-grid.vue';
import ElCard from 'element-plus/lib/components/card/index';
import ElLoading from 'element-plus/lib/components/loading/index';
import historyStore from '@/store/history';
import workingFileStore, { getCanvasRenderingContext2DSettings, getLayerById, getSelectedLayers } from '@/store/working-file';
import { notifyInjector } from '@/lib/notify';
import layerRenderers from '@/canvas/renderers';
import { createImageBlobFromCanvas } from '@/lib/image';
import { getCanvasFilterClass, applyCanvasFilter, buildCanvasFilterPreviewParams } from '@/canvas/filters';
import { AddLayerFilterAction } from '@/actions/add-layer-filter';
import { BundleAction } from '@/actions/bundle';
import { runModule } from '@/modules';
import { useRenderer } from '@/renderers';

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
    name: 'ModuleLayerEffectBrowser',
    inheritAttrs: false,
    directives: {
        loading: ElLoading.directive
    },
    components: {
        ElAlert,
        ElAutoGrid,
        ElCard
    },
    emits: [
        'update:title',
        'update:dialogSize',
        'close'
    ],
    props: {
        layerId: {
            type: Number,
            default: undefined,
        }
    },
    setup(props, { emit }) {
        emit('update:title', 'module.layerEffectBrowser.title');
        emit('update:dialogSize', 'big');

        const { t } = useI18n();
        const $notify = notifyInjector('$notify');

        const filterGenerationErrorMessage = ref();
        const filterPreviewThumbnails = ref<Record<string, string>>({});
        const previewImageHeight = ref<string>('auto');

        const hasFilterPreviewThumbnails = computed<boolean>(() => {
            return Object.keys(filterPreviewThumbnails.value).length > 0;
        });

        const categorizedFilters = computed<LayerFilterCategoryTemplateModel[]>(() => {
            const encounteredCategories = new Map();
            const categories: LayerFilterCategoryTemplateModel[] = [];
            for (const layerFilterName in layerFilterList) {
                const layerFilter = layerFilterList[layerFilterName as keyof typeof layerFilterList];
                if (!encounteredCategories.has(layerFilter.group)) {
                    categories.push({
                        name: `layerFilterGroup.${layerFilter.group}.name`,
                        filters: []
                    });
                    encounteredCategories.set(layerFilter.group, categories.length - 1);
                }
                const existingCategory = categories[encounteredCategories.get(layerFilter.group)];
                existingCategory.filters.push({
                    id: layerFilterName,
                    name: layerFilter.name
                });
            }
            return categories;
        });

        onMounted(() => {
            nextTick(async () => {
                try {
                    const selectedLayer = props.layerId != null ? getLayerById(props.layerId) : getSelectedLayers()[0];
                    if (!selectedLayer) {
                        throw new Error('module.layerEffectBrowser.generationErrorNoLayer');
                    }

                    const layerWidth = selectedLayer.type === 'group' ? workingFileStore.state.width : selectedLayer.width;
                    const layerHeight = selectedLayer.type === 'group' ? workingFileStore.state.height : selectedLayer.height;
                    const targetWidth = 200;
                    const targetHeight = targetWidth * (layerHeight / layerWidth);

                    const previewCanvas = document.createElement('canvas');
                    previewCanvas.width = targetWidth;
                    previewCanvas.height = targetHeight;
                    const previewCtx = previewCanvas.getContext('2d', getCanvasRenderingContext2DSettings());
                    if (!previewCtx) {
                        throw new Error('module.layerEffectBrowser.generationErrorGeneral');
                    }

                    const renderer = await useRenderer();
                    const layerBitmap = await renderer.takeSnapshot(layerWidth, layerHeight, { layerIds: [selectedLayer.id] });
                    previewCtx.drawImage(layerBitmap, 0, 0);

                    const originalImageData = previewCtx.getImageData(0, 0, targetWidth, targetHeight);
                    const newPreviewThumbnails: Record<string, string> = {};
                    for (const layerFilterName in layerFilterList) {
                        const canvasFilter = new (await getCanvasFilterClass(layerFilterName))();

                        // const appliedImageData = applyCanvasFilter(originalImageData, canvasFilter, buildCanvasFilterPreviewParams(canvasFilter));
                        // previewCtx.putImageData(appliedImageData, 0, 0);
                        previewCtx.putImageData(originalImageData, 0, 0);

                        const imageBlob = await createImageBlobFromCanvas(previewCanvas);
                        newPreviewThumbnails[layerFilterName] = URL.createObjectURL(imageBlob);
                    }
                    previewImageHeight.value = ((targetHeight / targetWidth) * 100) + '%';
                    filterPreviewThumbnails.value = newPreviewThumbnails;
                } catch (error) {
                    console.error(error);
                    emit('update:dialogSize', 'medium');
                    if ((error as Error)?.message?.startsWith('module.')) {
                        filterGenerationErrorMessage.value = (error as Error).message;
                    } else {
                        filterGenerationErrorMessage.value = 'module.layerEffectBrowser.generationErrorGeneral';
                    }
                }
            });
        });

        onUnmounted(() => {
            for (const filterName in filterPreviewThumbnails.value) {
                URL.revokeObjectURL(filterPreviewThumbnails.value[filterName]);
            }
        });

        async function onSelectFilter(filterName: string) {
            const selectedLayerIds = props.layerId != null ? [props.layerId] : workingFileStore.get('selectedLayerIds');
            const canvasFilter = new (await getCanvasFilterClass(filterName))();
            const addFilterActions: AddLayerFilterAction[] = [];
            for (const id of selectedLayerIds) {
                const filterParams: Record<string, unknown> = {};
                const editParamsConfig = canvasFilter.getEditConfig();
                for (const paramName in editParamsConfig) {
                    filterParams[paramName] = editParamsConfig[paramName].preview ?? editParamsConfig[paramName].default;
                }
                const filter: WorkingFileLayerFilter = {
                    name: filterName,
                    params: filterParams
                };
                addFilterActions.push(new AddLayerFilterAction(id, filter));
            }
            await historyStore.dispatch('runAction', {
                action: new BundleAction('addLayerFilterMultiple', 'action.addLayerFilterMultiple', addFilterActions)
            });
            setTimeout(() => {
                runModule('layer', 'layerEffectEdit', {
                    isFilterJustAdded: true,
                    layerId: selectedLayerIds[0],
                    filterIndex: (getLayerById(selectedLayerIds[0])?.filters.length ?? 1) - 1
                });
            }, 0)
            emit('close');
        }
        
        function onCancel() {
            emit('close');
        }
        
        return {
            t,
            hasFilterPreviewThumbnails,
            filterPreviewThumbnails,
            filterGenerationErrorMessage,
            previewImageHeight,
            categorizedFilters,
            onSelectFilter,
            onCancel,
        };
    }
});
</script>
