<template>
    <div class="flex container items-center justify-center mx-auto">
        <div class="og-toolbar-overlay">
            <div class="og-toolbar-tool-selector">
                <span class="bi bi-stars my-1" aria-hidden="true"></span>
                <span class="og-toolbar-tool-selector__description">
                    {{ t('toolbar.general.settings') }}
                </span>
            </div>
            <el-horizontal-scrollbar-arrows>
                <og-button outline small @click="onClickAddEffect">
                    <span class="bi bi-plus-circle-fill mr-2" aria-hidden="true" /> {{ t('button.addEffect') }}
                </og-button>
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
                        <og-button outline small class="ml-3!">
                            <span class="bi bi-pencil-square mr-2" aria-hidden="true" /> {{ t('button.editEffects') }}
                        </og-button>
                    </template>
                    <div v-if="selectedLayers.length === 0" class="p-4">
                        <el-alert type="error" show-icon :closable="false">
                            {{ t('toolbar.effect.edit.noLayersSelected') }}
                        </el-alert>
                    </div>
                    <template v-else>
                        <h2 class="og-dock-title">
                            {{ t('button.editEffects') }}
                        </h2>
                        <div class="pt-2 px-4 pb-4">
                            <template
                                v-for="layer of selectedLayers"
                                :key="layer.id"
                            >
                                <h3 class="m-0">
                                    <i class="bi bi-layers mr-1" aria-hidden="true"></i>
                                    <span class="og-toolbar--effect__edit-layer-name">
                                        {{ t(layer.name) }}
                                    </span>
                                </h3>
                                <el-alert
                                    v-if="layer.filters.length == 0"
                                    type="warning" class="!my-2" show-icon :closable="false"
                                >
                                    {{ t('toolbar.effect.edit.layerHasNoEffects') }}
                                </el-alert>
                                <div
                                    v-for="(filter, filterIndex) of layer.filters"
                                    :key="filterIndex + '_' + filter.name"
                                    class="flex"
                                >
                                    <el-button
                                        link
                                        class="grow-1 justify-start! p-0! min-h-6!"
                                        :type="filter.disabled ? undefined : 'primary'"
                                        @click="onEditLayerFilter(layer, filterIndex)"
                                    >
                                        <i class="bi bi-pencil-square mr-1" aria-hidden="true"></i>
                                        <span>{{ t(`layerFilter.${filter.name}.name`) }}</span>
                                    </el-button>
                                    <el-button
                                        link type="primary" class="px-2 my-0 ml-0  min-h-6!"
                                        :disabled="filterIndex === 0"
                                        :aria-label="t('app.layerList.moveEffectUp')"
                                        @click="onMoveLayerFilterUp(layer, filterIndex)"
                                    >
                                        <i class="bi bi-chevron-up" aria-hidden="true"></i>
                                    </el-button>
                                    <el-button
                                        link type="primary" class="px-2 my-0 ml-0  min-h-6!"
                                        :disabled="filterIndex === layer.filters.length - 1"
                                        :aria-label="t('app.layerList.moveEffectDown')"
                                        @click="onMoveLayerFilterDown(layer, filterIndex)"
                                    >
                                        <i class="bi bi-chevron-down" aria-hidden="true"></i>
                                    </el-button>
                                    <el-button
                                        link type="danger" class="px-2 my-0 ml-0  min-h-6!"
                                        :aria-label="t('toolbar.effect.edit.deleteEffect')"
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
        <floating-dock v-if="effectSettingsDockVisible" v-model:top="effectSettingsDockTop" v-model:left="effectSettingsDockLeft" :visible="floatingDocksVisible">
            <div class="w-1 h-8">
                <div class="absolute right-4 gap-2 flex flex-row items-center justify-end w-full">
                    <og-button small v-if="isSelectionMaskAvailable" @click="onCreateSelectionMask">
                        <span class="bi bi-mask mr-1" aria-hidden="true" />
                        {{ t('module.layerEffectEdit.useActiveSelectionMask') }}
                    </og-button>
                    <og-button small v-if="isMaskApplied" @click="onClearMask">
                        <span class="bi bi-x-circle mr-1" aria-hidden="true" />
                        {{ t('module.layerEffectEdit.clearSelectionMask') }}
                    </og-button>
                    <og-button solid outline small @click="onCancel">
                        {{ t('button.cancel') }}
                    </og-button>
                    <og-button solid outline primary small @click="onConfirm">
                        {{ t('button.apply') }}
                    </og-button>
                </div>
            </div>
            <el-divider class="my-2!" />
            <div class="flex flex-row items-center justify-between">
                <h2 class="text-md my-0 mr-4">{{ t(currentFilterTitle) }}</h2>
                <div class="flex flex-row items-center shrink-1">
                    <el-switch
                        v-model="editingFilterEnabled"
                        :active-text="t('module.layerEffectEdit.enableToggle')"
                        class="mr-4 el-switch--label-align-fix-sm-above"
                    />
                    <el-button link type="danger" class="el-text-alignment-fix--below" @click="onDelete">
                        <span class="bi bi-trash mr-1 el-text-alignment-fix--above" aria-hidden="true" />
                        <span>{{ t('module.layerEffectEdit.deleteEffect') }}</span>
                    </el-button>
                </div>
            </div>
            <el-form
                v-if="editingFilter"
                ref="form"
                action="javascript:void(0)"
                label-position="left"
                :model="editingFilterParams"
                :rules="editingFormValidationRules"
                novalidate="novalidate"
                hide-required-asterisk
                class="mt-2 w-full max-w-128"
                @submit="onConfirm"
            >
                <el-form-item-group class="el-form-item-group--resetable mb-0!">
                    <template v-for="(editConfigField, paramName) in editingFilterConfig" :key="paramName">
                        <el-form-item v-if="!editConfigField.hidden" :label="t(`layerFilter.${editingFilter.name}.param.${paramName}`)">
                            <template v-if="editConfigField.type === 'percentage'">
                                <el-row>
                                    <el-col :span="20" :xs="18">
                                        <el-slider
                                            v-model="editingFilterParams[paramName] as number"
                                            :min="getEditConfigMin(editConfigField)"
                                            :max="getEditConfigMax(editConfigField)"
                                            :step="0.01"
                                            :show-tooltip="false"
                                        />
                                    </el-col>
                                    <el-col :span="4" :xs="6">
                                        <el-input-number
                                            :modelValue="Math.floor((editingFilterParams[paramName] as number) * 100)"
                                            :min="getEditConfigMin(editConfigField) * 100"
                                            :max="getEditConfigMax(editConfigField) * 100"
                                            :precision="0"
                                            suffixText="%"
                                            class="el-input--text-right"
                                            @update:modelValue="editingFilterParams[paramName] = $event / 100"
                                        >
                                        </el-input-number>
                                    </el-col>
                                </el-row>
                            </template>
                            <template v-if="editConfigField.type === 'percentageRange'">
                                <el-row>
                                    <el-col :span="4" :xs="6">
                                        <el-input-number
                                            :modelValue="Math.floor((editingFilterParams[paramName] as number[])[0] * 100)"
                                            :min="getEditConfigMin(editConfigField) * 100"
                                            :max="getEditConfigMax(editConfigField) * 100"
                                            :precision="0"
                                            suffixText="%"
                                            class="el-input--text-right"
                                            @update:modelValue="(editingFilterParams[paramName] as number[])[0] = $event / 100"
                                        >
                                        </el-input-number>
                                    </el-col>
                                    <el-col :span="16" :xs="12">
                                        <el-slider
                                            v-model="editingFilterParams[paramName] as number"
                                            range
                                            :min="getEditConfigMin(editConfigField)"
                                            :max="getEditConfigMax(editConfigField)"
                                            :step="0.01"
                                            :show-tooltip="false"
                                        />
                                    </el-col>
                                    <el-col :span="4" :xs="6">
                                        <el-input-number
                                            :modelValue="Math.floor((editingFilterParams[paramName] as number[])[1] * 100)"
                                            :min="getEditConfigMin(editConfigField) * 100"
                                            :max="getEditConfigMax(editConfigField) * 100"
                                            :precision="0"
                                            suffixText="%"
                                            class="el-input--text-right"
                                            @update:modelValue="(editingFilterParams[paramName] as number[])[1] = $event / 100"
                                        >
                                        </el-input-number>
                                    </el-col>
                                </el-row>
                            </template>
                            <template v-else-if="editConfigField.type === 'integer' && editConfigField.options">
                                <el-select
                                    v-model="editingFilterParams[paramName] as number"
                                    popper-class="el-select-dropdown--unlocked-option-height"
                                >
                                    <el-option
                                        v-for="option of editConfigField.options"
                                        :key="option.key"
                                        :label="t(`layerFilter.${editingFilter.name}.param.${paramName}Option.${option.key}`)"
                                        :value="option.value"
                                    >
                                        <div style="line-height: 1.4em" class="py-2">
                                            <div>{{ t(`layerFilter.${editingFilter.name}.param.${paramName}Option.${option.key}`) }}</div>
                                            <div v-if="editConfigField.optionsHaveDescriptions" class="has-text-color-placeholder">
                                                {{ t(`layerFilter.${editingFilter.name}.param.${paramName}OptionDescription.${option.key}`) }}
                                            </div>
                                        </div>
                                    </el-option>
                                </el-select>
                            </template>
                            <template v-else-if="editConfigField.type === 'boolean'">
                                <el-switch v-model="editingFilterParams[paramName]" />
                            </template>
                            <template v-else-if="editConfigField.type === 'color'">
                                <el-input-color v-model="editingFilterParams[paramName]" />
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
        </floating-dock>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { Rules } from 'async-validator';

import ElAlert from 'element-plus/lib/components/alert/index';
import ElButton from 'element-plus/lib/components/button/index';
import ElCol from 'element-plus/lib/components/col/index';
import ElDivider from 'element-plus/lib/components/divider/index';
import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElFormItemGroup from '@/ui/el/el-form-item-group.vue';
import ElHorizontalScrollbarArrows from '@/ui/el/el-horizontal-scrollbar-arrows.vue';
import ElInputColor from '@/ui/el/el-input-color.vue';
import ElInputNumber from '@/ui/el/el-input-number.vue';
import ElPopover from '@/ui/el/el-popover.vue';
import ElSlider from 'element-plus/lib/components/slider/index';
import ElSelect, { ElOption } from 'element-plus/lib/components/select/index';
import ElSwitch from 'element-plus/lib/components/switch/index';
import ElRow from 'element-plus/lib/components/row/index';

import OgButton from '@/ui/element/button.vue';
import FloatingDock from '@/ui/dock/floating-dock.vue';

import { BaseAction } from '@/actions/base';
import { BundleAction } from '@/actions/bundle';
import { DeleteLayerFilterAction } from '@/actions/delete-layer-filter';
import { ReorderLayerFiltersAction } from '@/actions/reorder-layer-filters';
import { UpdateLayerFilterDisabledAction } from '@/actions/update-layer-filter-disabled';
import { UpdateLayerFilterMaskAction } from '@/actions/update-layer-filter-mask';
import { UpdateLayerFilterParamsAction } from '@/actions/update-layer-filter-params';

import historyStore from '@/store/history';
import { createStoredImage, deleteStoredImage, getStoredImageOrCanvas } from '@/store/image';
import workingFileStore, { getLayerById, getLayerGlobalTransform, getSelectedLayers } from '@/store/working-file';
import {
    effectEmitter, isToolbarVisible,
    effectSettingsDockVisible, effectSettingsDockTop, effectSettingsDockLeft,
} from '@/canvas/store/effect-state';
import {
    activeSelectionMask, appliedSelectionMask, activeSelectionMaskCanvasOffset,
    appliedSelectionMaskCanvasOffset, resampleSelectionMaskInLayerBounds,
} from '@/canvas/store/selection-state';

import appEmitter, { type AppEmitterEvents } from '@/lib/emitter';
import { generateCssGradient } from '@/lib/gradient';
import { generateImageHash } from '@/lib/hash';
import { notifyInjector } from '@/lib/notify';
import { throttle } from '@/lib/timing';

import { buildCanvasFilterParamsFromFormData, getCanvasFilterClass } from '@/canvas/filters';

import { runModule } from '@/modules';
import { useRenderer } from '@/renderers';

import type {
    ColorModel,
    WorkingFileAnyLayer, WorkingFileLayerFilter, WorkingFileGradientColorSpace,
    CanvasFilterEditConfig, CanvasFilterEditConfigField, CanvasFilterEditConfigGradient,
    Webgl2RendererCanvasFilter,
    RendererFrontend,
} from '@/types';
import { t } from '@/i18n';

const $notify = notifyInjector('$notify');
let renderer: RendererFrontend;

defineOptions({
    name: 'ToolbarEffect',  
});

const emit = defineEmits(['close']);

onMounted(() => {
    useRenderer().then((frontend) => {
        renderer = frontend;
    });
});

/*------------*\
| Toolbar Swap |
\*------------*/

const floatingDocksVisible = ref<boolean>(true);

onMounted(() => {
    appEmitter.on('editor.tool.toolbarSwapping', onToolbarSwap);
    appEmitter.on('editor.history.beforeStep', onHistoryBeforeStep);
    appEmitter.on('editor.history.step', onHistoryStep);
});

onUnmounted(() => {
    appEmitter.off('editor.tool.toolbarSwapping', onToolbarSwap);
    appEmitter.off('editor.history.beforeStep', onHistoryBeforeStep);
    appEmitter.off('editor.history.step', onHistoryStep);
    effectSettingsDockVisible.value = false;
});

function onToolbarSwap() {
    floatingDocksVisible.value = false;
}

function onHistoryBeforeStep(event?: AppEmitterEvents['editor.history.beforeStep']) {
    if (event?.trigger === 'undo' || event?.trigger === 'redo') {
        onCancel();
    }
}

function onHistoryStep(event?: AppEmitterEvents['editor.history.step']) {
    if ([
        'createNewFile', 'openFile',
    ].includes(event?.action.id as string)) {
        closeEffectSettings();
    }
}

/*-----------------*\
| Layer Effect List |
\*-----------------*/

const selectedLayers = computed(() => {
    return getSelectedLayers(workingFileStore.state.selectedLayerIds);
});

const isEditEffectPopoverVisible = ref(false);

function onClickAddEffect() {
    onCancel();
    runModule('layer', 'layerEffectBrowser');
}

async function onEditLayerFilter(layer: WorkingFileAnyLayer<ColorModel>, filterIndex: number) {
    isEditEffectPopoverVisible.value = false;
    effectSettingsDockVisible.value = false;

    await nextTick();

    generatedMaskId.value = undefined;
    removedMaskId.value = undefined;
    editingLayer.value = layer;
    editingFilter.value = layer.filters[filterIndex];
    editingFilterIndex.value = filterIndex;
    editingFilterEnabled.value = !editingFilter.value.disabled;
    editingFilterRendererClass.value = new (await getCanvasFilterClass(editingFilter.value.name))();
    editingFilterConfig.value = editingFilterRendererClass.value.getEditConfig();

    for (const paramName in editingFilterParams) {
        if (editingFilterParams.hasOwnProperty(paramName)) {
            delete editingFilterParams[paramName];
        }
    }
    
    for (const paramName in editingFilterConfig.value) {
        const paramConfig = editingFilterConfig.value[paramName];
        editingFilterParams[paramName] = editingFilter.value.params[paramName] ?? paramConfig.default;
    }

    if (!effectSettingsDockVisible.value) {
        effectSettingsDockTop.value = 0;
        effectSettingsDockLeft.value = 0;
    }
    effectSettingsDockVisible.value = true;
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
    if (layer.id === editingLayer.value?.id && filterIndex === editingFilterIndex.value) {
        onCancel();
    }

    historyStore.dispatch('runAction', {
        action: new DeleteLayerFilterAction(layer.id, filterIndex)
    });

    // Resize popover
    isEditEffectPopoverVisible.value = false;
    nextTick(() => {
        isEditEffectPopoverVisible.value = true;
    });
}

/*---------------------*\
| Edit Effect - General |
\*---------------------*/

const isFilterJustAdded = ref<boolean>(false);
const editingLayer = ref<WorkingFileAnyLayer>();
const editingFilter = ref<WorkingFileLayerFilter<ColorModel>>();
const editingFilterIndex = ref<number>(-1);
const editingFilterEnabled = ref(true);
const editingFilterParams = reactive<Record<string, any>>({});
const editingFilterRendererClass = ref<Webgl2RendererCanvasFilter>();
const editingFilterConfig = ref<CanvasFilterEditConfig>();
const editingFormValidationRules = ref<Rules>({});

const currentFilterTitle = computed<string>(() => {
    return `layerFilter.${editingFilter.value?.name}.name`;
});

watch(() => editingFilter.value, () => {
    if (!editingFilter.value) {
        effectSettingsDockVisible.value = false;
    }
});

function onEditFilterEmitted(options?: { layerId: number, filterIndex: number }) {
    const layer = getLayerById(options?.layerId ?? -1);
    if (layer == null || options?.filterIndex == null) return;
    onEditLayerFilter(layer, options.filterIndex);
}

onMounted(() => {
    effectEmitter.on('editFilter', onEditFilterEmitted);
    isToolbarVisible.value = true;
})

onUnmounted(() => {
    effectEmitter.off('editFilter', onEditFilterEmitted);
    isToolbarVisible.value = false;
})

/*----------------------------*\
| Edit Effect - Selection Mask |
\*----------------------------*/

const generatedSelectionMaskUuid = ref<string>();
const generatedMaskId = ref<number>();
const removedMaskId = ref<number>();

const isSelectionMaskAvailable = computed<boolean>(() => {
    return !!(activeSelectionMask.value || appliedSelectionMask.value);
});

const isMaskApplied = computed<boolean>(() => {
    return editingFilter.value?.maskId != null;
});

async function onCreateSelectionMask() {
    const selectionMask = activeSelectionMask.value || appliedSelectionMask.value;
    const selectionMaskCanvasOffset = selectionMask === activeSelectionMask.value
        ? activeSelectionMaskCanvasOffset.value : appliedSelectionMaskCanvasOffset.value;
    const activeLayer = editingLayer.value;
    if (selectionMask && activeLayer && editingFilter.value) {
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
            if (editingFilter.value) {
                if (removedMaskId.value != null) {
                    removedMaskId.value = editingFilter.value.maskId;
                }
                editingFilter.value.maskId = generatedMaskId.value;
            }
        } else {
            deleteStoredImage(generatedSelectionMaskUuid.value);
        }
    }
}

function onClearMask() {
    if (editingFilter.value?.maskId != null) {
        if (editingFilter.value.maskId !== generatedMaskId.value) {
            removedMaskId.value = editingFilter.value.maskId;
        }
        editingFilter.value.maskId = undefined;
    }
}

/*-------------------------*\
| Edit Effect - Form Fields |
\*-------------------------*/

function getEditConfigMin(editConfig: CanvasFilterEditConfigField) {
    return editConfig.min ?? 0;
}

function getEditConfigMax(editConfig: CanvasFilterEditConfigField) {
    return editConfig.max ?? 1;
}


function isFilterParamDefault(fieldName: string, editConfig: CanvasFilterEditConfigField) {
    return editingFilterParams[fieldName] === editConfig.default;
}

function resetFilterParam(fieldName: string, editConfig: CanvasFilterEditConfigField) {
    editingFilterParams[fieldName] = editConfig.default;
}

/*----------------------------*\
| Edit Effect - Gradient Input |
\*----------------------------*/

const gradientBackgrounds = computed<Record<string, string>>(() => {
    const backgrounds: Record<string, string> = {};
    if (!editingFilterConfig.value) return backgrounds;
    for (const paramKey of Object.keys(editingFilterConfig.value)) {
        if (editingFilterConfig.value[paramKey]?.type === 'gradient') {
            const colorSpaceFieldName = editingFilterConfig.value[paramKey].colorSpaceFieldName;
            backgrounds[paramKey] = generateCssGradient(
                editingFilterParams[paramKey] as never,
                editingFilterParams[colorSpaceFieldName] as WorkingFileGradientColorSpace,
            );
        }
    }
    return backgrounds;
})

async function onClickStopGradientSelect(fieldName: string) {
    const colorSpaceFieldName = (editingFilterConfig.value?.[fieldName] as CanvasFilterEditConfigGradient).colorSpaceFieldName;
    const blendColorSpace = editingFilterParams[colorSpaceFieldName];
    appEmitter.emit('app.dialogs.openFromDock', {
        name: 'gradient-editor',
        props: {
            isDialog: true,
            gradient: JSON.parse(JSON.stringify(editingFilterParams[fieldName])),
            blendColorSpace: {
                0: 'oklab',
                1: 'srgb',
                2: 'linearSrgb',
            }[blendColorSpace as number] ?? blendColorSpace,
        },
        onClose: (event?: any) => {
            if (event?.gradient) {
                editingFilterParams[fieldName] = event.gradient;
            }
        }
    });
}

function onKeydownStopGradientSelect(event: KeyboardEvent, fieldName: string) {
    if (event.key === 'Enter' || event.key === ' ') {
        onClickStopGradientSelect(fieldName);
    }
}

/*--------------------------*\
| Edit Effect - Live Preview |
\*--------------------------*/

watch(() => editingFilterEnabled.value, (enabled) => {
    updatePreview();
});

watch(() => editingFilterParams, () => {
    updatePreview();
}, { deep: true });

const updatePreview = throttle(function () {
    if (!renderer || !editingLayer.value || !editingFilter.value) return;

    if (editingFilterEnabled.value) {
        renderer.overrideLayerFilterParams(
            editingLayer.value.id,
            editingFilterIndex.value,
            buildEditParamsFromFromData(),
        );
    } else {
        renderer.overrideLayerFilterParams(
            editingLayer.value.id,
            editingFilterIndex.value,
            null,
        );
    }
}, 20);

/*-------------*\
| Delete Effect |
\*-------------*/

function onDelete() {
    if (isFilterJustAdded.value) {
        onCancel();
        return;
    }
    if (editingLayer.value) {

        renderer.overrideLayerFilterParams(
            editingLayer.value.id,
            editingFilterIndex.value,
            undefined,
        );

        historyStore.dispatch('runAction', {
            action: new DeleteLayerFilterAction(editingLayer.value.id, editingFilterIndex.value)
        })
        closeEffectSettings();
    } else {
        $notify({
            type: 'error',
            message: t('module.layerEffectEdit.deleteFilterError')
        })
    }
}

/*----------------------*\
| Edit Effect Submission |
\*----------------------*/

function closeEffectSettings() {
    effectSettingsDockVisible.value = false;

    if (!editingFilter.value) return;
    isFilterJustAdded.value = false;
    editingLayer.value = undefined;
    editingFilter.value = undefined;
    editingFilterIndex.value = -1;
    editingFilterEnabled.value = true;
    editingFilterRendererClass.value = undefined;
    editingFilterConfig.value = undefined;
    editingFormValidationRules.value = {};
}

function onCancel() {
    const layerId = editingLayer.value?.id;
    const filterIndex = editingFilterIndex.value;

    if (editingFilter.value) {
        if (removedMaskId.value != null) {
            editingFilter.value.maskId = removedMaskId.value;
            removedMaskId.value = undefined;
        } else if (generatedMaskId.value != null) {
            editingFilter.value.maskId = undefined;
        }
    }

    closeEffectSettings();

    if (layerId == null || filterIndex == -1) return;

    renderer.overrideLayerFilterParams(
        layerId,
        filterIndex,
        undefined,
    );
}

function buildEditParamsFromFromData(overrideParams?: Record<string, unknown>): Record<string, unknown> {
    if (editingFilterRendererClass.value) {
        return buildCanvasFilterParamsFromFormData(
            editingFilterRendererClass.value,
            overrideParams ?? editingFilterParams
        );
    } else {
        return {};
    }
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

async function onConfirm() {
    if (editingLayer.value && editingFilter.value && editingFilterIndex.value > -1) {
        const layerId = editingLayer.value.id;

        renderer.overrideLayerFilterParams(
            layerId,
            editingFilterIndex.value,
            undefined,
        );

        let actions: BaseAction[] = [];
        if ((editingFilterEnabled.value === true) !== ((!editingFilter.value.disabled) === true)) {
            actions.push(
                new UpdateLayerFilterDisabledAction(layerId, editingFilterIndex.value, !editingFilterEnabled.value)
            );
        }
        const newParams = buildEditParamsFromFromData();
        if (isParamsChanged(editingFilter.value.params, newParams)) {
            actions.push(
                new UpdateLayerFilterParamsAction(layerId, editingFilterIndex.value, newParams)
            );
        }

        if (generatedMaskId.value != null && editingFilter.value.maskId === generatedMaskId.value) {
            editingFilter.value.maskId = removedMaskId.value ?? undefined;
            actions.push(
                new UpdateLayerFilterMaskAction(layerId, editingFilterIndex.value, generatedMaskId.value)
            );
            generatedMaskId.value = undefined;
        } else if (removedMaskId.value != null && editingFilter.value.maskId == null) {
            editingFilter.value.maskId = removedMaskId.value ?? undefined;
            actions.push(
                new UpdateLayerFilterMaskAction(layerId, editingFilterIndex.value, undefined)
            );
        }
        removedMaskId.value = undefined;

        if (actions.length > 0) {
            await historyStore.dispatch('runAction', {
                action: new BundleAction('applyLayerFilterChanges', 'action.updateLayerFilterParams', actions)
            });
        }

        closeEffectSettings();
    } else {
        $notify({
            type: 'error',
            message: t('module.layerEffectEdit.applyFilterError')
        })
    }
}

</script>

<style scoped>
.el-select :deep(.el-input__wrapper) {
    contain: size;
}
.el-input :deep(.el-input__wrapper) {
    contain: size;
}
</style>