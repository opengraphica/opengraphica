<template>
    <el-alert
        v-if="filterGenerationErrorMessage"
        type="error"
        show-icon
        :closable="false"
        :title="t(filterGenerationErrorMessage)"
    />
    <template v-else>
        <el-auto-grid item-width="8rem" :breakpoints="[{ maxWidth: 525, itemWidth: '6rem' }]">
            <template v-for="category of categorizedFilters" :key="category.name">
                <h3 class="mb-0 mt-2" style="grid-column: 1 / -1;">{{ t(category.name) }}</h3>
                <template
                    v-for="filter of category.filters"
                    :key="filter.name"
                >
                    <el-card
                        :body-style="{ padding: '0px' }"
                        class="el-card--link"
                        role="button"
                        tabindex="0"
                        style="border-radius: 0.875rem; max-width: 15rem"
                        @click="onSelectFilter(filter.id)"
                    >
                        <div style="max-height: 10rem; overflow: hidden;">
                            <img
                                v-if="filterPreviewThumbnails[filter.id]"
                                :src="filterPreviewThumbnails[filter.id]"
                                :style="{
                                    'width': '100%',
                                    'height': previewImageHeight,
                                    'aspect-ratio': previewImageAspectRatio,
                                    'background-image': 'url(\'../images/transparency-bg.png\')',
                                    'background-repeat': 'repeat'
                                }"
                            >
                            <img
                                v-else
                                src="images/transparency-bg.png"
                                :style="{
                                    'width': '100%',
                                    'height': previewImageHeight,
                                    'aspect-ratio': previewImageAspectRatio,
                                }"
                            >
                        </div>
                        <div class="p-2 text-center">{{ t(filter.name) }}</div>
                    </el-card>
                </template>
            </template>
        </el-auto-grid>
    </template>
</template>

<script lang="ts">
export default {
    name: 'ModuleLayerEffectBrowser',
    inheritAttrs: false,
};
</script>
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useI18n } from '@/i18n';
import layerFilterList from '@/config/layer-filters.json';
import ElAlert from 'element-plus/lib/components/alert/index';
import ElAutoGrid from '@/ui/el/el-auto-grid.vue';
import ElCard from 'element-plus/lib/components/card/index';
import ElLoading from 'element-plus/lib/components/loading/index';
import historyStore from '@/store/history';
import workingFileStore, { getCanvasRenderingContext2DSettings, getLayerById, getSelectedLayers } from '@/store/working-file';
import { createImageBlobFromCanvas } from '@/lib/image';
import { getCanvasFilterClass, buildCanvasFilterPreviewParams } from '@/canvas/filters';
import { AddLayerFilterAction } from '@/actions/add-layer-filter';
import { BundleAction } from '@/actions/bundle';
import { runModule } from '@/modules';
import { useRenderer } from '@/renderers';

import type { WorkingFileLayerFilter, WorkingFileAnyLayer } from '@/types';

const vLoading = ElLoading.directive;

interface LayerFilterTemplateModel {
    id: string;
    name: string;
}

interface LayerFilterCategoryTemplateModel {
    name: string;
    filters: LayerFilterTemplateModel[];
}

const props = defineProps({
    layerId: {
        type: Number,
        default: undefined,
    }
});

const emit = defineEmits([
    'update:title',
    'update:dialogSize',
    'close'
]);

emit('update:title', 'module.layerEffectBrowser.title');
emit('update:dialogSize', 'big');

const { t } = useI18n();
const renderer = await useRenderer();

const filterGenerationErrorMessage = ref();
const filterPreviewThumbnails = ref<Record<string, string>>({});
const previewImageHeight = ref<string>('auto');
const previewImageAspectRatio = ref<string>('auto');
const loadingLayerFilterNames = ref<string[]>([]);
const selectedLayer = ref<WorkingFileAnyLayer | null>(null);

const selectedLayerWidth = computed<number>(() => {
    return selectedLayer.value?.type === 'group' ? workingFileStore.state.width : selectedLayer.value?.width ?? 0;
});

const selectedLayerHeight = computed<number>(() => {
    return selectedLayer.value?.type === 'group' ? workingFileStore.state.height : selectedLayer.value?.height ?? 0;
});

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
            selectedLayer.value = props.layerId != null ? getLayerById(props.layerId) : getSelectedLayers()[0];
            if (!selectedLayer.value) {
                throw new Error('module.layerEffectBrowser.generationErrorNoLayer');
            }

            const targetWidth = 200;
            const targetHeight = targetWidth * (selectedLayerHeight.value / selectedLayerWidth.value);

            const previewCanvas = document.createElement('canvas');
            previewCanvas.width = targetWidth;
            previewCanvas.height = targetHeight;
            const previewCtx = previewCanvas.getContext('bitmaprenderer', getCanvasRenderingContext2DSettings());
            if (!previewCtx) {
                throw new Error('module.layerEffectBrowser.generationErrorGeneral');
            }

            const newPreviewThumbnails: Record<string, string> = {};
            loadingLayerFilterNames.value = Object.keys(layerFilterList);

            previewImageHeight.value = ((targetHeight / targetWidth) * 100) + '%';
            previewImageAspectRatio.value = `${targetWidth} / ${targetHeight}`;
            filterPreviewThumbnails.value = newPreviewThumbnails;

            generateNextFilterPreview(previewCtx);
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
    loadingLayerFilterNames.value = [];
    for (const filterName in filterPreviewThumbnails.value) {
        URL.revokeObjectURL(filterPreviewThumbnails.value[filterName]);
    }
});

async function generateNextFilterPreview(previewCtx: ImageBitmapRenderingContext) {
    const layerFilterName = loadingLayerFilterNames.value.shift();
    if (!layerFilterName || !selectedLayer.value) return;

    const canvasFilter = new (await getCanvasFilterClass(layerFilterName))();

    const filtersWithPreview: WorkingFileLayerFilter[] = [
        ...selectedLayer.value.filters,
        {
            name: layerFilterName,
            params: buildCanvasFilterPreviewParams(canvasFilter)
        }
    ]
    const layerPreviewBitmap = await renderer.takeSnapshot(selectedLayerWidth.value, selectedLayerHeight.value, {
        layerIds: [selectedLayer.value.id],
        filters: filtersWithPreview,
    });

    previewCtx.transferFromImageBitmap(layerPreviewBitmap);

    const imageBlob = await createImageBlobFromCanvas(previewCtx.canvas as HTMLCanvasElement);
    filterPreviewThumbnails.value[layerFilterName] = URL.createObjectURL(imageBlob);

    setTimeout(() => {
        generateNextFilterPreview(previewCtx);
    }, 0);
}

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
</script>
