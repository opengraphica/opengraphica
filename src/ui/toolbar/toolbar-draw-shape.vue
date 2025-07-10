<template>
    <div class="flex container items-center justify-center mx-auto">
        <div v-if="editingLayers.length > 0 && !showStopDrawer" class="og-toolbar-edit-confirm">
            {{ $t('toolbar.drawGradient.editingGradient') }}
            <el-button plain size="small" class="!ml-3" @click="onDoneEditing()">
                <span class="bi bi-check-circle-fill mr-2" aria-hidden="true" /> {{ $t('button.done') }}
            </el-button>
        </div>
        <div class="og-toolbar-overlay" :class="{ 'is-active': editingLayers.length > 0 }">
            <div class="og-toolbar-tool-selector">
                <span class="bi bi-shadows my-1" aria-hidden="true"></span>
                <span class="og-toolbar-tool-selector__description" v-t="'toolbar.general.settings'" />
            </div>
            <el-horizontal-scrollbar-arrows>
                <el-input-group :prepend-tooltip="t('toolbar.drawShape.shapeType.label')">
                    <template #prepend>
                        <span class="bi" aria-hidden="true" :class="{
                            'bi-square': selectedShapeType === 'rectangle',
                            'bi-circle': selectedShapeType === 'ellipse',
                        }" />
                    </template>
                    <el-select :aria-label="t('toolbar.drawShape.shapeType.label')" v-model="selectedShapeType" size="small" style="width: 6rem">
                        <el-option :label="t('toolbar.drawShape.shapeType.rectangle')" value="rectangle">
                            <span class="bi bi-square mr-1" aria-hidden="true" /> {{ t('toolbar.drawShape.shapeType.rectangle') }}
                        </el-option>
                        <el-option :label="t('toolbar.drawShape.shapeType.ellipse')" value="ellipse">
                            <span class="bi bi-circle mr-1" aria-hidden="true" /> {{ t('toolbar.drawShape.shapeType.ellipse') }}
                        </el-option>
                    </el-select>
                </el-input-group>
                <og-button v-model:pressed="styleDockVisible" outline solid small toggle class="!ml-3"
                    @click="styleDockLeft = 0; styleDockTop = 0;">
                    <i class="bi bi-palette-fill mr-1" aria-hidden="true" />
                    {{ t('toolbar.drawShape.style.label') }}
                </og-button>
            </el-horizontal-scrollbar-arrows>
        </div>
        <floating-dock v-if="styleDockVisible" v-model:top="styleDockTop" v-model:left="styleDockLeft" :visible="floatingDocksVisible">
            <div class="flex flex-wrap gap-2 max-w-105">
                asdf
            </div>
        </floating-dock>
    </div>
</template>

<script setup lang="ts">
import { v4 as uuidv4 } from 'uuid';
import { ref, computed, onMounted, onUnmounted, toRefs, watch } from 'vue';
import { useI18n } from '@/i18n';

import { BundleAction } from '@/actions/bundle';
import { UpdateLayerAction } from '@/actions/update-layer';

import {
    activeColorStops, blendColorSpace, editingLayers, fillType, showStopDrawer, spreadMethod,
} from '@/canvas/store/draw-gradient-state';

import {
    selectedShapeType,
    styleDockVisible, styleDockLeft, styleDockTop,
} from '@/canvas/store/draw-shape-state';

import { appliedSelectionMask, activeSelectionMask } from '@/canvas/store/selection-state';
import historyStore from '@/store/history';
import workingFileStore from '@/store/working-file';

import ElButton from 'element-plus/lib/components/button/index';
import ElHorizontalScrollbarArrows from '@/ui/el/el-horizontal-scrollbar-arrows.vue';
import ElInputGroup from '@/ui/el/el-input-group.vue';
import ElSelect, { ElOption } from 'element-plus/lib/components/select/index';

import OgButton from '@/ui/element/button.vue';
import OgPopover from '@/ui/element/popover.vue';
import FloatingDock from '@/ui/dock/floating-dock.vue';

import appEmitter from '@/lib/emitter';
import { generateCssGradient } from '@/lib/gradient';
import { UpdateGradientLayerOptions, WorkingFileGradientColorStop, RGBAColor } from '@/types';

defineOptions({
    name:'ToolbarDrawShape',
})

const emit = defineEmits(['close']);

const { selectedLayerIds } = toRefs(workingFileStore.state);

const { t } = useI18n();

const uuid = uuidv4();

const hasSelection = computed<boolean>(() => {
    return !(appliedSelectionMask.value == null && activeSelectionMask.value == null);
});

/*------------*\
| Toolbar Swap |
\*------------*/

const floatingDocksVisible = ref<boolean>(true);

onMounted(() => {
    appEmitter.on('editor.tool.toolbarSwapping', onToolbarSwap);
});

onUnmounted(() => {
    appEmitter.off('editor.tool.toolbarSwapping', onToolbarSwap);
});

function onToolbarSwap() {
    floatingDocksVisible.value = false;
}

/*----------------------*\
| Gradient Stop Selector |
\*----------------------*/

const selectedGradientBackground = computed<string>(() => {
    return generateCssGradient(activeColorStops.value as WorkingFileGradientColorStop<RGBAColor>[], blendColorSpace.value);
});

function onClickStopGradientSelect() {
    showStopDrawer.value = !showStopDrawer.value;
}

function onKeydownStopGradientSelect(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
        showStopDrawer.value = !showStopDrawer.value;
    }
}

const editingColorStops = ref<Array<WorkingFileGradientColorStop<RGBAColor>>>([]);
const hasEditedColorStops = ref<boolean>(false);

watch([showStopDrawer], ([show]) => {
    if (show) {
        editingColorStops.value = JSON.parse(JSON.stringify(activeColorStops.value));
        hasEditedColorStops.value = false;
    } else {
        if (hasEditedColorStops.value) {
            activeColorStops.value = JSON.parse(JSON.stringify(editingColorStops.value));
            hasEditedColorStops.value = false;
            onChangeActiveColorStops();
        }
    }
});

/*-----------------------------------*\
| Editing Dropdowns / History Updates |
\*-----------------------------------*/

function onChangeFillType() {
    if (editingLayers.value.length === 0) return;
    const updateLayerActions: UpdateLayerAction<UpdateGradientLayerOptions>[] = [];
    for (const layer of editingLayers.value) {
        updateLayerActions.push(new UpdateLayerAction({
            id: layer.id,
            data: {
                ...JSON.parse(JSON.stringify(layer.data)),
                fillType: fillType.value,
            }
        }));
    }
    historyStore.dispatch('runAction', {
        action: new BundleAction('updateDrawGradientLayerFillType', 'action.updateDrawGradientLayerFillType', updateLayerActions),
    });
}

function onChangeBlendColorSpace() {
    if (editingLayers.value.length === 0) return;
    const updateLayerActions: UpdateLayerAction<UpdateGradientLayerOptions>[] = [];
    for (const layer of editingLayers.value) {
        updateLayerActions.push(new UpdateLayerAction({
            id: layer.id,
            data: {
                ...JSON.parse(JSON.stringify(layer.data)),
                blendColorSpace: blendColorSpace.value,
            }
        }));
    }
    historyStore.dispatch('runAction', {
        action: new BundleAction('updateDrawGradientLayerBlendColorSpace', 'action.updateDrawGradientLayerBlendColorSpace', updateLayerActions),
    });
}

function onChangeSpreadMethod() {
    if (editingLayers.value.length === 0) return;
    const updateLayerActions: UpdateLayerAction<UpdateGradientLayerOptions>[] = [];
    for (const layer of editingLayers.value) {
        updateLayerActions.push(new UpdateLayerAction({
            id: layer.id,
            data: {
                ...JSON.parse(JSON.stringify(layer.data)),
                spreadMethod: spreadMethod.value,
            }
        }));
    }
    historyStore.dispatch('runAction', {
        action: new BundleAction('updateDrawGradientLayerSpreadMethod', 'action.updateDrawGradientLayerSpreadMethod', updateLayerActions),
    });
}

function onChangeActiveColorStops() {
    if (editingLayers.value.length === 0) return;
    const updateLayerActions: UpdateLayerAction<UpdateGradientLayerOptions>[] = [];
    for (const layer of editingLayers.value) {
        updateLayerActions.push(new UpdateLayerAction({
            id: layer.id,
            data: {
                ...JSON.parse(JSON.stringify(layer.data)),
                stops: JSON.parse(JSON.stringify(activeColorStops.value)),
            }
        }));
    }
    historyStore.dispatch('runAction', {
        action: new BundleAction('updateDrawGradientLayerStops', 'action.updateDrawGradientLayerStops', updateLayerActions),
    });
}

/*-----------------------*\
| Finished Editing Button |
\*-----------------------*/

function onDoneEditing() {
    editingLayers.value = [];
}
</script>
