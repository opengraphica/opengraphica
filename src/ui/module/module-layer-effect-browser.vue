<template>
    <el-alert
        v-if="filterGenerationErrorMessage"
        type="error"
        show-icon
        :closable="false"
        :title="t(filterGenerationErrorMessage)"
    />
    <template v-else>
        <template v-for="category of categorizedFilters" :key="category.name">
            <h3 class="mb-0! mt-4! px-4!" style="grid-column: 1 / -1;">{{ t(category.name) }}</h3>
            <el-horizontal-scrollbar-arrows
                style="grid-column: 1 / -1;"
                class="h-auto! -mx-4!"
                scroll-content-class="items-stretch! gap-2! py-2 round-2!"
            >
                <template
                    v-for="filter of category.filters"
                    :key="filter.name"
                >
                    <el-card
                        :body-style="{ padding: '0px' }"
                        class="el-card--link w-32"
                        role="button"
                        tabindex="0"
                        style="border-radius: 0.875rem;"
                        @click="onSelectFilter(filter.id)"
                    >
                        <div style="max-height: 10rem; overflow: hidden;">
                            <img
                                v-if="filterPreviewThumbnails[filter.id]"
                                :src="filterPreviewThumbnails[filter.id]"
                                :style="{
                                    'width': '100%',
                                    'height': '100%',
                                    'aspect-ratio': previewImageAspectRatio,
                                    'background-image': 'url(\'' + assetsBasePath + 'images/transparency-bg.png\')',
                                    'background-repeat': 'repeat',
                                    'object-fit': 'cover',
                                }"
                                @dragstart.prevent
                            >
                            <img
                                v-else
                                :src="getStaticThumbnail(filter)"
                                :style="{
                                    'width': '100%',
                                    'height': '100%',
                                    'aspect-ratio': previewImageAspectRatio,
                                }"
                                loading="lazy"
                            >
                        </div>
                        <div class="p-2 flex grow-1 text-center items-center justify-center">{{ t(filter.name) }}</div>
                    </el-card>
                </template>
            </el-horizontal-scrollbar-arrows>
        </template>
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
import ElCard from 'element-plus/lib/components/card/index';
import ElHorizontalScrollbarArrows from '@/ui/el/el-horizontal-scrollbar-arrows.vue';
import ElLoading from 'element-plus/lib/components/loading/index';
import historyStore from '@/store/history';

import editorStore from '@/store/editor';
import preferencesStore from '@/store/preferences';
import workingFileStore, { getCanvasRenderingContext2DSettings, getLayerById, getSelectedLayers } from '@/store/working-file';

import { createImageBlobFromCanvas } from '@/lib/image';
import { camelCaseToKebabCase } from '@/lib/string';

import { getCanvasFilterClass, buildCanvasFilterPreviewParams } from '@/renderers/common/filters';

import { AddLayerFilterAction } from '@/actions/add-layer-filter';
import { BundleAction } from '@/actions/bundle';

import { runModule } from '@/modules';

import { useRenderer } from '@/renderers';

import type { WorkingFileLayerFilter, WorkingFileAnyLayer } from '@/types';

const vLoading = ElLoading.directive;

interface LayerFilterTemplateModel {
    id: string;
    kebabId: string;
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

const assetsBasePath = preferencesStore.state.assetsBasePath;

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
            kebabId: camelCaseToKebabCase(layerFilterName),
            name: layerFilter.name
        });
    }
    for (const pluginFilter of editorStore.get('pluginFilters')) {
        if (!encounteredCategories.has(pluginFilter.group)) {
            categories.push({
                name: `layerFilterGroup.${pluginFilter.group}.name`,
                filters: []
            });
            encounteredCategories.set(pluginFilter.group, categories.length - 1);
        }
        const existingCategory = categories[encounteredCategories.get(pluginFilter.group)];
        existingCategory.filters.push({
            id: pluginFilter.name,
            kebabId: camelCaseToKebabCase(pluginFilter.name),
            name: `layerFilter.${pluginFilter.name}.name`,
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

            const targetWidth = 256;
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

            for (const pluginFilter of editorStore.get('pluginFilters')) {
                loadingLayerFilterNames.value.push(pluginFilter.name);
                const previewThumbnail = pluginFilter.previewThumbnail ?? await pluginFilter.getPreviewThumbnail();
                pluginFilter.previewThumbnail = previewThumbnail;
                newPreviewThumbnails[pluginFilter.name] = URL.createObjectURL(pluginFilter.previewThumbnail);
            }

            previewImageHeight.value = ((targetHeight / targetWidth) * 100) + '%';
            previewImageAspectRatio.value = `1 / 1`;
            filterPreviewThumbnails.value = newPreviewThumbnails;

            generateNextFilterPreview(previewCtx, targetWidth, targetHeight);
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

function getStaticThumbnail(filter: LayerFilterTemplateModel) {
    return `${assetsBasePath}images/module/layer/layer-effect-browser/thumbnail/${filter.kebabId}.png`;
}

async function generateNextFilterPreview(previewCtx: ImageBitmapRenderingContext, targetWidth: number, targetHeight: number) {
    const layerFilterName = loadingLayerFilterNames.value.shift();
    if (!layerFilterName || !selectedLayer.value) return;

    const canvasFilter = new (await getCanvasFilterClass(layerFilterName, editorStore.get('pluginFilters')))();

    const filtersWithPreview: WorkingFileLayerFilter[] = [
        ...selectedLayer.value.filters,
        {
            name: layerFilterName,
            params: buildCanvasFilterPreviewParams(canvasFilter),
        }
    ]
    const layerPreviewBitmap = await renderer.takeSnapshot(targetWidth, targetHeight, {
        layerIds: [selectedLayer.value.id],
        filters: filtersWithPreview,
        // disableBackground: true,  // TODO - renderer generates weird output
    });

    previewCtx.transferFromImageBitmap(layerPreviewBitmap);

    const imageBlob = await createImageBlobFromCanvas(previewCtx.canvas as HTMLCanvasElement);
    filterPreviewThumbnails.value[layerFilterName] = URL.createObjectURL(imageBlob);

    setTimeout(() => {
        generateNextFilterPreview(previewCtx, targetWidth, targetHeight);
    }, 0);
}

async function onSelectFilter(filterName: string) {
    const selectedLayerIds = props.layerId != null ? [props.layerId] : workingFileStore.get('selectedLayerIds');
    const canvasFilter = new (await getCanvasFilterClass(filterName))();
    const addFilterActions: AddLayerFilterAction[] = [];
    for (const id of selectedLayerIds) {
        const filterParams: Record<string, unknown> = {};
        const editParamsConfig = canvasFilter.editConfig ?? canvasFilter.getEditConfig?.()!;
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
