<template>
    <div class="is-flex container is-align-items-center is-justify-content-center mx-auto">
        <div v-if="editingLayers.length > 0" class="ogr-toolbar-edit-confirm">
            {{ $t('toolbar.drawGradient.editingGradient') }}
            <el-button plain size="small" class="ml-3" @click="onDoneEditing()">
                <span class="bi bi-check-circle-fill mr-2" aria-hidden="true" /> {{ $t('button.done') }}
            </el-button>
        </div>
        <div class="ogr-toolbar-overlay" :class="{ 'is-active': editingLayers.length > 0 }">
            <div class="ogr-toolbar-tool-selector">
                <span class="bi bi-shadows my-1" aria-hidden="true"></span>
                <span class="ogr-toolbar-tool-selector__description" v-t="'toolbar.general.settings'" />
            </div>
            <el-horizontal-scrollbar-arrows>
                <div
                    role="button"
                    tabindex="0"
                    class="ogr-toolbar-draw-gradient__step-selection"
                    :style="{ '--gradient': selectedGradientBackground }"
                >
                </div>
                <el-radio-group v-model="fillType" size="small" class="ml-3" @change="onChangeFillType()">
                    <el-radio-button label="linear">
                        {{ $t('toolbar.drawGradient.fillType.linear') }}
                    </el-radio-button>
                    <el-radio-button label="radial">
                        {{ $t('toolbar.drawGradient.fillType.radial') }}
                    </el-radio-button>
                </el-radio-group>
                <el-input-group :prepend-tooltip="$t('toolbar.drawGradient.blendColorSpace.label')" class="ml-3">
                    <template #prepend>
                        <span class="bi bi-rainbow" aria-hidden="true" />
                    </template>
                    <el-select :aria-label="$t('toolbar.drawGradient.blendColorSpace.label')" v-model="blendColorSpace" size="small" style="width: 6.25rem" @change="onChangeBlendColorSpace()">
                        <el-option :label="$t('toolbar.drawGradient.blendColorSpace.oklab')" value="oklab" />
                        <el-option :label="$t('toolbar.drawGradient.blendColorSpace.srgb')" value="srgb" />
                        <el-option :label="$t('toolbar.drawGradient.blendColorSpace.linearSrgb')" value="linearSrgb" />
                    </el-select>
                </el-input-group>
                <el-input-group :prepend-tooltip="$t('toolbar.drawGradient.spreadMethod.label')" class="ml-3">
                    <template #prepend>
                        <span class="bi bi-bullseye" aria-hidden="true" />
                    </template>
                    <el-select :aria-label="$t('toolbar.drawGradient.spreadMethod.label')" v-model="spreadMethod" size="small" style="width: 5.5rem" @change="onChangeSpreadMethod()">
                        <el-option :label="$t('toolbar.drawGradient.spreadMethod.pad')" value="pad" />
                        <el-option :label="$t('toolbar.drawGradient.spreadMethod.repeat')" value="repeat" />
                        <el-option :label="$t('toolbar.drawGradient.spreadMethod.reflect')" value="reflect" />
                        <el-option :label="$t('toolbar.drawGradient.spreadMethod.truncate')" value="truncate" />
                    </el-select>
                </el-input-group>
            </el-horizontal-scrollbar-arrows>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, toRefs, watch } from 'vue';

import { BundleAction } from '@/actions/bundle';
import { UpdateLayerAction } from '@/actions/update-layer';

import { activeColorStops, blendColorSpace, editingLayers, fillType, spreadMethod } from '@/canvas/store/draw-gradient-state';
import { appliedSelectionMask, activeSelectionMask } from '@/canvas/store/selection-state';
import historyStore from '@/store/history';
import workingFileStore, { WorkingFileState } from '@/store/working-file';

import ElAlert from 'element-plus/lib/components/alert/index';
import ElButton, { ElButtonGroup } from 'element-plus/lib/components/button/index';
import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElHorizontalScrollbarArrows from '@/ui/el/el-horizontal-scrollbar-arrows.vue';
import ElInput from 'element-plus/lib/components/input/index';
import ElInputGroup from '@/ui/el/el-input-group.vue';
import ElInputNumber from '@/ui/el/el-input-number.vue';
import ElPopover from '@/ui/el/el-popover.vue';
import { ElRadioGroup, ElRadioButton } from 'element-plus/lib/components/radio/index';
import ElSelect, { ElOption } from 'element-plus/lib/components/select/index';
import ElSlider from 'element-plus/lib/components/slider/index';
import ElTooltip from 'element-plus/lib/components/tooltip/index';

import { srgbaToLinearSrgba, linearSrgbaToOklab } from '@/lib/color';
import appEmitter from '@/lib/emitter';
import { UpdateGradientLayerOptions } from '@/types';

export default defineComponent({
    name: 'ToolbarDrawGradient',
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
        ElRadioGroup,
        ElRadioButton,
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

        const selectedGradientBackground = computed<string>(() => {
            let previewGradient = '';
            if (blendColorSpace.value === 'oklab') {
                previewGradient = 'linear-gradient(in oklab 90deg, ' + activeColorStops.value.map((colorStop) => {
                    const { l, a, b, alpha } = linearSrgbaToOklab(srgbaToLinearSrgba(colorStop.color));
                    return `oklab(${l * 100}% ${a} ${b} / ${alpha}) ${colorStop.offset * 100}%`
                }).join(', ') + ')';
            } else if (blendColorSpace.value === 'linearSrgb') { 
                previewGradient = 'linear-gradient(in srgb-linear 90deg, ' + activeColorStops.value.map((colorStop) => {
                    return `${colorStop.color.style} ${colorStop.offset * 100}%`
                }).join(', ') + ')';
            }
            if (!window?.CSS?.supports || !window.CSS.supports('background-image', previewGradient)) {
                previewGradient = 'linear-gradient(90deg, ' + activeColorStops.value.map((colorStop) => {
                    return `${colorStop.color.style} ${colorStop.offset * 100}%`
                }).join(', ') + ')';
            }
            return previewGradient;
        });

        const hasSelection = computed<boolean>(() => {
            return !(appliedSelectionMask.value == null && activeSelectionMask.value == null);
        });

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

        function onDoneEditing() {
            editingLayers.value = [];
        }

        return {
            selectedGradientBackground,
            selectedLayerIds,
            hasSelection,

            blendColorSpace,
            editingLayers,
            fillType,
            spreadMethod,

            onChangeFillType,
            onChangeBlendColorSpace,
            onChangeSpreadMethod,
            onDoneEditing,
        };
    }
});
</script>
