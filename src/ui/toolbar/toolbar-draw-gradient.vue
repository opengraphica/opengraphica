<template>
    <div class="is-flex container is-align-items-center is-justify-content-center mx-auto">
        <div class="ogr-toolbar-overlay">
            <div class="ogr-toolbar-tool-selector">
                <span class="bi bi-shadows my-1" aria-hidden="true"></span>
                <span class="ogr-toolbar-tool-selector__description" v-t="'toolbar.general.settings'" />
            </div>
            <el-horizontal-scrollbar-arrows>
                <el-radio-group v-model="fillType">
                    <el-radio-button label="linear">
                        {{ $t('toolbar.drawGradient.fillType.linear') }}
                    </el-radio-button>
                    <el-radio-button label="radial">
                        {{ $t('toolbar.drawGradient.fillType.radial') }}
                    </el-radio-button>
                </el-radio-group>
                <el-input-group :prepend-tooltip="$t('toolbar.drawGradient.colorSpace.label')" class="ml-3">
                    <template #prepend>
                        <span class="bi bi-rainbow" aria-hidden="true" />
                    </template>
                    <el-select :aria-label="$t('toolbar.drawGradient.colorSpace.label')" v-model="colorSpace" size="small" style="width: 6.25rem">
                        <el-option :label="$t('toolbar.drawGradient.colorSpace.oklab')" value="oklab" />
                        <el-option :label="$t('toolbar.drawGradient.colorSpace.perceptualRgb')" value="perceptualRgb" />
                        <el-option :label="$t('toolbar.drawGradient.colorSpace.linearRgb')" value="linearRgb" />
                    </el-select>
                </el-input-group>
                <el-input-group :prepend-tooltip="$t('toolbar.drawGradient.spreadMethod.label')" class="ml-3">
                    <template #prepend>
                        <span class="bi bi-bullseye" aria-hidden="true" />
                    </template>
                    <el-select :aria-label="$t('toolbar.drawGradient.spreadMethod.label')" v-model="spreadMethod" size="small" style="width: 5rem">
                        <el-option :label="$t('toolbar.drawGradient.spreadMethod.pad')" value="pad" />
                        <el-option :label="$t('toolbar.drawGradient.spreadMethod.repeat')" value="repeat" />
                        <el-option :label="$t('toolbar.drawGradient.spreadMethod.reflect')" value="reflect" />
                    </el-select>
                </el-input-group>
            </el-horizontal-scrollbar-arrows>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, toRefs, watch } from 'vue';

import { colorSpace, fillType, spreadMethod } from '@/canvas/store/draw-gradient-state';
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

import appEmitter from '@/lib/emitter';

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

        const hasSelection = computed<boolean>(() => {
            return !(appliedSelectionMask.value == null && activeSelectionMask.value == null);
        });

        return {
            selectedLayerIds,
            hasSelection,

            colorSpace,
            fillType,
            spreadMethod,
        };
    }
});
</script>
