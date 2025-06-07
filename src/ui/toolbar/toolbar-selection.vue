<template>
    <div class="flex container items-center justify-center mx-auto">
        <div class="og-toolbar-overlay">
            <div class="og-toolbar-tool-selector">
                <span class="bi bi-bounding-box my-1" aria-hidden="true"></span>
                <span class="og-toolbar-tool-selector__description" v-t="'toolbar.general.settings'" />
            </div>
            <el-horizontal-scrollbar-arrows>
                <el-input-group :prepend-tooltip="$t('toolbar.selection.selectionShape.label')">
                    <template #prepend>
                        <span class="bi" aria-hidden="true" :class="{
                            'bi-square': selectionAddShape === 'rectangle',
                            'bi-circle': selectionAddShape === 'ellipse',
                            'bi-hexagon': selectionAddShape === 'freePolygon',
                            'bi-lasso': selectionAddShape === 'lasso',
                            'bi-magic': selectionAddShape === 'tonalArea'
                        }" />
                    </template>
                    <el-select :aria-label="$t('toolbar.selection.selectionShape.label')" v-model="selectionAddShape" size="small" style="width: 6rem">
                        <el-option :label="$t('toolbar.selection.selectionShape.rectangle')" value="rectangle">
                            <span class="bi bi-square mr-1" aria-hidden="true" /> {{ $t('toolbar.selection.selectionShape.rectangle') }}
                        </el-option>
                        <el-option :label="$t('toolbar.selection.selectionShape.ellipse')" value="ellipse">
                            <span class="bi bi-circle mr-1" aria-hidden="true" /> {{ $t('toolbar.selection.selectionShape.ellipse') }}
                        </el-option>
                        <el-option :label="$t('toolbar.selection.selectionShape.freePolygonShort')" value="freePolygon">
                            <span class="bi bi-hexagon mr-1" aria-hidden="true" /> {{ $t('toolbar.selection.selectionShape.freePolygon') }}
                        </el-option>
                        <el-option :label="$t('toolbar.selection.selectionShape.lasso')" value="lasso">
                            <span class="bi bi-lasso mr-1" aria-hidden="true" /> {{ $t('toolbar.selection.selectionShape.lasso') }}
                        </el-option>
                        <el-option :label="$t('toolbar.selection.selectionShape.tonalArea')" value="tonalArea">
                            <span class="bi bi-magic mr-1" aria-hidden="true" /> {{ $t('toolbar.selection.selectionShape.tonalArea') }}
                        </el-option>
                    </el-select>
                </el-input-group>
                <el-input-group :prepend-tooltip="$t('toolbar.selection.selectionCombineMode.label')" class="ml-3">
                    <template #prepend>
                        <span class="bi" aria-hidden="true" :class="{
                            'bi-plus-circle': selectionCombineModeComputed === 'add',
                            'bi-dash-circle': selectionCombineModeComputed === 'subtract',
                            'bi-intersect': selectionCombineModeComputed === 'intersect'
                        }" />
                    </template>
                    <el-select aria-label="Selection Shape" v-model="selectionCombineModeComputed" size="small" style="width: 5.5rem">
                        <el-option label="Add" value="add">
                            <span class="bi bi-plus-circle mr-1" aria-hidden="true" /> {{ $t('toolbar.selection.selectionCombineMode.add') }}
                        </el-option>
                        <el-option label="Subtract" value="subtract">
                            <span class="bi bi-dash-circle mr-1" aria-hidden="true" /> {{ $t('toolbar.selection.selectionCombineMode.subtract') }}
                        </el-option>
                        <el-option label="Intersect" value="intersect">
                            <span class="bi bi-intersect mr-1" aria-hidden="true" /> {{ $t('toolbar.selection.selectionCombineMode.intersect') }}
                        </el-option>
                    </el-select>
                </el-input-group>
                <el-button-group class="!flex !ml-3">
                    <el-button size="small" :disabled="!canClearSelection" @click="onClickClear">
                        <span class="bi bi-x-circle-fill mr-2" aria-hidden="true" /> {{ $t('button.clear') }}
                    </el-button>
                    <el-button size="small" :disabled="!canApplySelection" @click="onClickApply">
                        <span class="bi bi-check-circle-fill mr-2" aria-hidden="true" /> {{ $t('button.apply') }}
                    </el-button>
                </el-button-group>
            </el-horizontal-scrollbar-arrows>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent, ref, computed, onMounted, toRefs, watch, nextTick } from 'vue';
import ElAlert from 'element-plus/lib/components/alert/index';
import ElButton, { ElButtonGroup } from 'element-plus/lib/components/button/index';
import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElHorizontalScrollbarArrows from '@/ui/el/el-horizontal-scrollbar-arrows.vue';
import ElInputGroup from '@/ui/el/el-input-group.vue';
import ElInputNumber from '@/ui/el/el-input-number.vue';
import ElPopover from '@/ui/el/el-popover.vue';
import { ElRadioGroup, ElRadioButton } from 'element-plus/lib/components/radio/index';
import ElSelect, { ElOption } from 'element-plus/lib/components/select/index';
import ElTooltip from 'element-plus/lib/components/tooltip/index';
import { appliedSelectionMask, selectionAddShape, selectionCombineMode, selectionEmitter, activeSelectionPath } from '@/canvas/store/selection-state';

export default defineComponent({
    name: 'ToolbarSelection',
    components: {
        ElAlert,
        ElButton,
        ElButtonGroup,
        ElForm,
        ElFormItem,
        ElHorizontalScrollbarArrows,
        ElInputGroup,
        ElInputNumber,
        ElOption,
        ElRadioButton,
        ElRadioGroup,
        ElPopover,
        ElSelect,
        ElTooltip
    },
    props: {
        
    },
    emits: [
        'close'
    ],
    setup(props, { emit }) {

        const canClearSelection = computed<boolean>(() => {
            return activeSelectionPath.value.length > 0 || appliedSelectionMask.value != null;
        });

        const canApplySelection = computed<boolean>(() => {
            return activeSelectionPath.value.length > 0;
        });

        const selectionCombineModeComputed = computed<'replace' | 'add' | 'subtract' | 'intersect'>({
            get() {
                return selectionCombineMode.value;
            },
            async set(value) {
                if (activeSelectionPath.value.length > 0) {
                    selectionEmitter.emit('applyActiveSelection');
                }
                selectionEmitter.emit('updateSelectionCombineMode', value);
            }
        });

        function onClickClear() {
            selectionEmitter.emit('clearSelection');
        }

        function onClickApply() {
            selectionEmitter.emit('applyActiveSelection');
        }

        return {
            selectionAddShape,
            selectionCombineModeComputed,
            canClearSelection,
            canApplySelection,
            onClickClear,
            onClickApply
        };
    }
});
</script>
