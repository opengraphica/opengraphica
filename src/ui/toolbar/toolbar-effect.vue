<template>
    <div class="flex container items-center justify-center mx-auto">
        <div class="og-toolbar-overlay">
            <div class="og-toolbar-tool-selector">
                <span class="bi bi-stars my-1" aria-hidden="true"></span>
                <span class="og-toolbar-tool-selector__description" v-t="'toolbar.general.settings'" />
            </div>
            <el-horizontal-scrollbar-arrows>
                <el-button size="small" @click="onClickAddEffect">
                    <span class="bi bi-plus-circle-fill mr-2" aria-hidden="true" /> {{ $t('button.addEffect') }}
                </el-button>
                <el-popover
                    v-model:visible="isEditEffectPopoverVisible"
                    placement="top"
                    popper-class="og-dock-popover"
                    trigger="click"
                    :width="250"
                    :popper-options="{
                        modifiers: [
                            {
                                name: 'computeStyles',
                                options: {
                                    adaptive: false,
                                    enabled: false
                                }
                            }
                        ]
                    }"
                >
                    <template #reference>
                        <el-button size="small" class="ml-3">
                            <span class="bi bi-pencil-square mr-2" aria-hidden="true" /> {{ $t('button.editEffects') }}
                        </el-button>
                    </template>
                    <div v-if="selectedLayers.length === 0" class="p-4">
                        <el-alert type="error" show-icon :closable="false">
                            {{ $t('toolbar.effect.edit.noLayersSelected') }}
                        </el-alert>
                    </div>
                    <template v-else>
                        <h2 class="og-dock-title" v-t="'button.editEffects'"></h2>
                        <div class="p-4">
                            <template
                                v-for="layer of selectedLayers"
                                :key="layer.id"
                            >
                                <h3 class="m-0">
                                    <i class="bi bi-layers mr-1" aria-hidden="true"></i>
                                    <span class="og-toolbar--effect__edit-layer-name" v-t="layer.name" />
                                </h3>
                                <el-alert v-if="layer.filters.length == 0" type="warning" class="!my-2" show-icon :closable="false">
                                    {{ $t('toolbar.effect.edit.layerHasNoEffects') }}
                                </el-alert>
                                <div
                                    v-for="(filter, filterIndex) of layer.filters"
                                    :key="filterIndex + '_' + filter.name"
                                    class="flex"
                                >
                                    <el-button
                                        link
                                        class="grow-1 justify-start"
                                        :type="filter.disabled ? undefined : 'primary'"
                                        @click="onEditLayerFilter(layer, filterIndex)"
                                    >
                                        <i class="bi bi-pencil-square mr-1" aria-hidden="true"></i>
                                        <span v-t="`layerFilter.${filter.name}.name`"></span>
                                    </el-button>
                                    <el-button
                                        link type="primary" class="px-2 my-0 ml-0"
                                        :disabled="filterIndex === 0"
                                        :aria-label="$t('app.layerList.moveEffectUp')"
                                        @click="onMoveLayerFilterUp(layer, filterIndex)"
                                    >
                                        <i class="bi bi-chevron-up" aria-hidden="true"></i>
                                    </el-button>
                                    <el-button
                                        link type="primary" class="px-2 my-0 ml-0"
                                        :disabled="filterIndex === layer.filters.length - 1"
                                        :aria-label="$t('app.layerList.moveEffectDown')"
                                        @click="onMoveLayerFilterDown(layer, filterIndex)"
                                    >
                                        <i class="bi bi-chevron-down" aria-hidden="true"></i>
                                    </el-button>
                                    <el-button
                                        link type="danger" class="px-2 my-0 ml-0"
                                        :aria-label="$t('toolbar.effect.edit.deleteEffect')"
                                        @click="onDeleteLayerFilter(layer, filterIndex)"
                                    >
                                        <i class="bi bi-trash-fill" aria-hidden="true"></i>
                                    </el-button>
                                </div>
                            </template>
                        </div>
                    </template>
                </el-popover>
            </el-horizontal-scrollbar-arrows>
        </div>
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, nextTick, ref, toRefs } from 'vue';

import ElAlert from 'element-plus/lib/components/alert/index';
import ElButton, { ElButtonGroup } from 'element-plus/lib/components/button/index';
import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElHorizontalScrollbarArrows from '@/ui/el/el-horizontal-scrollbar-arrows.vue';
import ElInput from 'element-plus/lib/components/input/index';
import ElInputGroup from '@/ui/el/el-input-group.vue';
import ElInputNumber from '@/ui/el/el-input-number.vue';
import ElPopover from '@/ui/el/el-popover.vue';
import ElSelect, { ElOption } from 'element-plus/lib/components/select/index';
import ElSlider from 'element-plus/lib/components/slider/index';
import ElTooltip from 'element-plus/lib/components/tooltip/index';

import { ReorderLayerFiltersAction } from '@/actions/reorder-layer-filters';
import { DeleteLayerFilterAction } from '@/actions/delete-layer-filter';

import { appliedSelectionMask, activeSelectionMask } from '@/canvas/store/selection-state';
import historyStore from '@/store/history';
import workingFileStore, { getSelectedLayers } from '@/store/working-file';
import { runModule } from '@/modules';

import appEmitter from '@/lib/emitter';

import type { WorkingFileAnyLayer, ColorModel } from '@/types';

export default defineComponent({
    name: 'ToolbarEffect',
    components: {
        ElAlert,
        ElButton,
        ElButtonGroup,
        ElForm,
        ElFormItem,
        ElHorizontalScrollbarArrows,
        ElInput,
        ElInputGroup,
        ElInputNumber,
        ElOption,
        ElPopover,
        ElSelect,
        ElSlider,
        ElTooltip,
    },
    props: {
        
    },
    emits: [
        'close'
    ],
    setup(props, { emit }) {
        const { selectedLayerIds } = toRefs(workingFileStore.state);

        const selectedLayers = computed(() => {
            return getSelectedLayers(workingFileStore.state.selectedLayerIds);
        });

        const isEditEffectPopoverVisible = ref(false);
       
        function onClickAddEffect() {
            runModule('layer', 'layerEffectBrowser');
        }

        function onEditLayerFilter(layer: WorkingFileAnyLayer<ColorModel>, filterIndex: number) {
            isEditEffectPopoverVisible.value = false;
            runModule('layer', 'layerEffectEdit', {
                layerId: layer.id,
                filterIndex
            });
        }

        function onMoveLayerFilterUp(layer: WorkingFileAnyLayer<ColorModel>, filterIndex: number) {
            historyStore.dispatch('runAction', {
                action: new ReorderLayerFiltersAction(layer.id, [filterIndex], filterIndex - 1, 'before')
            });
        }

        function onMoveLayerFilterDown(layer: WorkingFileAnyLayer<ColorModel>, filterIndex: number) {
            historyStore.dispatch('runAction', {
                action: new ReorderLayerFiltersAction(layer.id, [filterIndex], filterIndex + 1, 'after')
            });
        }

        function onDeleteLayerFilter(layer: WorkingFileAnyLayer<ColorModel>, filterIndex: number) {
            historyStore.dispatch('runAction', {
                action: new DeleteLayerFilterAction(layer.id, filterIndex)
            });

            // Resize popover
            isEditEffectPopoverVisible.value = false;
            nextTick(() => {
                isEditEffectPopoverVisible.value = true;
            });
        }

        return {
            selectedLayerIds,
            selectedLayers,

            isEditEffectPopoverVisible,

            onClickAddEffect,
            onEditLayerFilter,
            onMoveLayerFilterUp,
            onMoveLayerFilterDown,
            onDeleteLayerFilter,
        };
    }
});
</script>
