<template>
    <div class="flex container items-center justify-center mx-auto">
        <div class="og-toolbar-overlay">
            <div class="og-toolbar-tool-selector">
                <span class="bi bi-cursor my-1" aria-hidden="true"></span>
                <span class="og-toolbar-tool-selector__description" v-t="'toolbar.general.settings'" />
            </div>
            <el-horizontal-scrollbar-arrows>
                <el-button v-if="hasSelection" size="small" @click="onClickClearSelection">
                    <span class="bi bi-x-circle-fill mr-2" aria-hidden="true" /> {{ $t('toolbar.freeTransform.clearSelection') }}
                </el-button>
                <el-input-group v-else :prepend-tooltip="$t('toolbar.freeTransform.pickLayer.label')">
                    <template #prepend>
                        <span class="bi bi-cursor" aria-hidden="true" />
                    </template>
                    <el-select :aria-label="$t('toolbar.freeTransform.pickLayer.label')" v-model="layerPickMode" size="small" style="width: 5rem">
                        <el-option :label="$t('toolbar.freeTransform.pickLayer.auto')" value="auto" />
                        <el-option :label="$t('toolbar.freeTransform.pickLayer.current')" value="current" />
                    </el-select>
                </el-input-group>
                <el-popover
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
                        <el-button size="small" class="!ml-3">
                            <span class="bi bi-magnet-fill mr-2" aria-hidden="true" /> {{ $t('toolbar.freeTransform.snapping.title') }}
                        </el-button>
                    </template>
                    <h2 class="og-dock-title" v-t="'toolbar.freeTransform.snapping.title'" />
                    <el-form novalidate="novalidate" action="javascript:void(0)">
                        <el-form-item class="el-form-item--menu-item el-form-item--has-content-right mb-1" :label="$t('toolbar.freeTransform.snapping.rotationSnap')">
                            <el-switch v-model="useRotationSnapping" />
                        </el-form-item>
                    </el-form>
                </el-popover>
                <el-popover
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
                        <el-button size="small" class="!ml-3">
                            <span class="bi bi-clipboard-data-fill mr-2" aria-hidden="true" /> {{ $t('toolbar.freeTransform.metrics.title') }}
                        </el-button>
                    </template>
                    <h2 class="og-dock-title" v-t="'toolbar.freeTransform.metrics.title'" />
                    <template v-if="selectedLayerIds.length > 0">
                        <el-form novalidate="novalidate" action="javascript:void(0)" style="max-width: 15rem;">
                            <div class="px-5 my-3 flex">
                                <el-input-number
                                    v-model="inputLeft" :aria-label="'X ' + $t('toolbar.freeTransform.metrics.position')" size="small"
                                    class="el-input-group--plain grow-1" :suffix-text="measuringUnits" :blur-on-enter="true" @focus="onFocusAnyMetricInput()" @input="onInputLeft($event)" @blur="onChangeDragResizeInput()">
                                    <template #prepend>X</template>
                                </el-input-number>
                                <el-input-number
                                    v-model="inputTop" :aria-label="'Y ' + $t('toolbar.freeTransform.metrics.position')" size="small"
                                    class="el-input-group--plain grow-1 ml-3" :suffix-text="measuringUnits" :blur-on-enter="true" @focus="onFocusAnyMetricInput()" @input="onInputTop($event)" @blur="onChangeDragResizeInput()">
                                    <template #prepend>Y</template>
                                </el-input-number>
                            </div>
                            <el-form-item class="el-form-item--menu-item mb-1" :label="$t('toolbar.freeTransform.metrics.width')">
                                <el-input-number
                                    v-model="inputWidth" style="width: 6rem" size="small"
                                    :suffix-text="measuringUnits" :blur-on-enter="true" :disabled="!isResizeEnabled && !isUnevenScalingEnabled"
                                    @focus="onFocusAnyMetricInput()" @input="onInputWidth($event)" @blur="onChangeDragResizeInput()"
                                />
                            </el-form-item>
                            <el-form-item class="el-form-item--menu-item mb-1" :label="$t('toolbar.freeTransform.metrics.height')">
                                <el-input-number
                                    v-model="inputHeight" style="width: 6rem" size="small"
                                    :suffix-text="measuringUnits" :blur-on-enter="true" :disabled="!isResizeEnabled && !isUnevenScalingEnabled"
                                    @focus="onFocusAnyMetricInput()" @input="onInputHeight($event)" @blur="onChangeDragResizeInput()"
                                />
                            </el-form-item>
                            <el-form-item class="el-form-item--menu-item mb-1" :label="$t('toolbar.freeTransform.metrics.rotation')">
                                <el-input-number v-model="inputRotation" style="width: 6rem" size="small" suffix-text="°" :blur-on-enter="true" @focus="onFocusAnyMetricInput()" @input="onInputRotation($event)" @blur="onChangeRotationInput()">
                                    <template #append>
                                        <el-button size="small" :aria-label="$t('toolbar.freeTransform.metrics.resetRotation')" @click="onResetRotation()">
                                            <span class="bi bi-arrow-repeat" aria-hidden="true"></span>
                                        </el-button>
                                    </template>
                                </el-input-number>
                            </el-form-item>
                        </el-form>
                    </template>
                    <template v-else>
                        <div class="px-5 my-3">
                            <el-alert
                                type="info"
                                :title="$t('toolbar.freeTransform.metrics.noLayers')"
                                show-icon
                                :closable="false">
                            </el-alert>
                        </div>
                    </template>
                </el-popover>
                <el-popover
                    v-model:visible="isActionPopoverVisible"
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
                        <el-button size="small" class="!ml-3">
                            <span class="bi bi-gear-fill mr-2" aria-hidden="true" /> {{ $t('toolbar.freeTransform.actions.title') }}
                        </el-button>
                    </template>
                    <el-menu class="el-menu--medium el-menu--medium-icons el-menu--borderless my-1" :default-active="actionActiveIndex" @select="onActionSelect($event)">
                        <el-menu-item index="applyTransform">
                            <i class="bi bi-check-circle-fill"></i>
                            <span v-t="'toolbar.freeTransform.actions.applyTransform'"></span>
                        </el-menu-item>
                        <el-menu-item index="expandToImageSize">
                            <i class="bi bi-fullscreen"></i>
                            <span v-t="'toolbar.freeTransform.actions.expandToImageSize'"></span>
                        </el-menu-item>
                        <el-menu-item index="trimEmptySpace">
                            <i class="bi bi-scissors"></i>
                            <span v-t="'toolbar.freeTransform.actions.trimEmptySpace'"></span>
                        </el-menu-item>
                    </el-menu>
                </el-popover>
            </el-horizontal-scrollbar-arrows>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, toRefs, watch, nextTick } from 'vue';

import {
    freeTransformEmitter, layerPickMode, useRotationSnapping, top, left, width, height, rotation,
    applyTransform, trimEmptySpace, layerToImageBounds, isResizeEnabled, isUnevenScalingEnabled,
} from '@/canvas/store/free-transform-state';
import { appliedSelectionMask, activeSelectionMask } from '@/canvas/store/selection-state';
import historyStore from '@/store/history';
import workingFileStore, { getSelectedLayers, WorkingFileState } from '@/store/working-file';

import ElAlert from 'element-plus/lib/components/alert/index';
import ElButton, { ElButtonGroup } from 'element-plus/lib/components/button/index';
import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElHorizontalScrollbarArrows from '@/ui/el/el-horizontal-scrollbar-arrows.vue';
import ElInput from 'element-plus/lib/components/input/index';
import ElInputGroup from '@/ui/el/el-input-group.vue';
import ElInputNumber from '@/ui/el/el-input-number.vue';
import ElMenu, { ElMenuItem } from 'element-plus/lib/components/menu/index';
import ElPopover from '@/ui/el/el-popover.vue';
import ElSelect, { ElOption } from 'element-plus/lib/components/select/index';
import ElSwitch from 'element-plus/lib/components/switch/index';

import { convertUnits } from '@/lib/metrics';
import { ClearSelectionAction } from '@/actions/clear-selection';

const emit = defineEmits<{
    (e: 'close'): void;
}>();

const { selectedLayerIds } = toRefs(workingFileStore.state);
const measuringUnits = ref<WorkingFileState['measuringUnits']>(workingFileStore.get('measuringUnits'));
const resolutionX = ref<number>(workingFileStore.get('resolutionX'));
const resolutionY = ref<number>(workingFileStore.get('resolutionY'));
const resolutionUnits = ref<WorkingFileState['resolutionUnits']>(workingFileStore.get('resolutionUnits'));
const dimensionLockRatio = ref<number | null>(null);

const actionActiveIndex = ref<string>('');
const isActionPopoverVisible = ref<boolean>(false);

let disableInputUpdate: boolean = false;

const inputLeft = ref<number>(0);
const inputTop = ref<number>(0);
const inputWidth = ref<number>(1);
const inputHeight = ref<number>(1);
const inputRotation = ref<number>(0);

const hasSelection = computed<boolean>(() => {
    return !(appliedSelectionMask.value == null && activeSelectionMask.value == null);
});

watch([left], ([left]) => {
    if (!disableInputUpdate) {
        inputLeft.value = parseFloat(convertUnits(left, 'px', measuringUnits.value, resolutionX.value, resolutionUnits.value).toFixed(2));
    }
}, { immediate: true });
watch([top], ([top]) => {
    if (!disableInputUpdate) {
        inputTop.value = parseFloat(convertUnits(top, 'px', measuringUnits.value, resolutionX.value, resolutionUnits.value).toFixed(2));
    }
}, { immediate: true });
watch([width, height], ([width, height]) => {
    if (!disableInputUpdate) {
        inputWidth.value = parseFloat(convertUnits(width, 'px', measuringUnits.value, resolutionX.value, resolutionUnits.value).toFixed(measuringUnits.value === 'px' ? 0 : 2));
        inputHeight.value = parseFloat(convertUnits(height, 'px', measuringUnits.value, resolutionY.value, resolutionUnits.value).toFixed(measuringUnits.value === 'px' ? 0 : 2));
    }
}, { immediate: true });
watch([rotation], ([rotation]) => {
    if (!disableInputUpdate) {
        inputRotation.value = parseFloat((rotation * Math.RADIANS_TO_DEGREES).toFixed(2));
    }
}, { immediate: true });

function onToggleDimensionLockRatio() {
    if (dimensionLockRatio.value == null) {
        dimensionLockRatio.value = width.value / height.value;
    } else {
        dimensionLockRatio.value = null;
    }
}

function onFocusAnyMetricInput() {
    freeTransformEmitter.emit('storeTransformStart');
    disableInputUpdate = true;
}

function onInputLeft(left: number) {
    freeTransformEmitter.emit('previewDragResizeChange', {
        transform: {
            left: convertUnits(left, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value),
            top: convertUnits(inputTop.value, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value),
            width: convertUnits(inputWidth.value, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value),
            height: convertUnits(inputHeight.value, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value)
        }
    });
}

function onInputTop(top: number) {
    freeTransformEmitter.emit('previewDragResizeChange', {
        transform: {
            left: convertUnits(inputLeft.value, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value),
            top: convertUnits(top, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value),
            width: convertUnits(inputWidth.value, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value),
            height: convertUnits(inputHeight.value, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value)
        }
    });
}

function onInputWidth(width: number) {
    freeTransformEmitter.emit('previewDragResizeChange', {
        transform: {
            left: convertUnits(inputLeft.value, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value),
            top: convertUnits(inputTop.value, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value),
            width: convertUnits(width, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value),
            height: convertUnits(inputHeight.value, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value)
        }
    });
}

function onInputHeight(height: number) {
    freeTransformEmitter.emit('previewDragResizeChange', {
        transform: {
            left: convertUnits(inputLeft.value, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value),
            top: convertUnits(inputTop.value, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value),
            width: convertUnits(inputWidth.value, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value),
            height: convertUnits(height, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value)
        }
    });
}

function onInputRotation(rotation: number) {
    freeTransformEmitter.emit('previewRotationChange', {
        rotation: rotation * Math.DEGREES_TO_RADIANS
    });
}

function onChangeDragResizeInput() {
    disableInputUpdate = false;
    freeTransformEmitter.emit('commitTransforms');
}

function onChangeRotationInput() {
    disableInputUpdate = false;
    freeTransformEmitter.emit('commitTransforms');
}

function onResetRotation() {
    freeTransformEmitter.emit('storeTransformStart');
    freeTransformEmitter.emit('previewRotationChange', {
        rotation: 0
    });
    freeTransformEmitter.emit('commitTransforms');
}

async function onClickClearSelection() {
    await historyStore.dispatch('runAction', {
        action: new ClearSelectionAction()
    });
}

async function onActionSelect(action: string) {
    if (action === 'applyTransform') {
        await applyTransform();
    } else if (action === 'expandToImageSize') {
        await layerToImageBounds();
    } else if (action === 'trimEmptySpace') {
        await trimEmptySpace();
    }
    actionActiveIndex.value = ' ';
    await nextTick();
    actionActiveIndex.value = '';
    isActionPopoverVisible.value = false;
}

</script>
