<template>
    <div class="is-flex container is-align-items-center is-justify-content-center mx-auto">
        <div class="ogr-toolbar-overlay">
            <div class="ogr-toolbar-tool-selector">
                <span class="bi bi-pencil my-1" aria-hidden="true"></span>
                <span class="ogr-toolbar-tool-selector__description" v-t="'toolbar.general.settings'" />
            </div>
            <el-horizontal-scrollbar-arrows>
                <el-tooltip
                    :content="$t('toolbar.draw.brushColor')"
                    placement="top"
                >
                    <el-button
                        round
                        size="small"
                        :aria-label="$t('toolbar.draw.brushColor')"
                        :style="{
                            backgroundColor: brushColor.style,
                            color: isBrushColorLight ? '#000000' : '#ffffff',
                            borderColor: isBrushColorLight ? undefined : 'transparent'
                        }"
                        @click="onPickColor()"
                    >
                        <i class="bi bi-palette-fill" aria-hidden="true" />
                    </el-button>
                </el-tooltip>
                <div class="is-flex is-align-items-center px-3">
                    <label for="toolbar-draw-brush-size-slider" v-t="'toolbar.draw.brushSize'" class="mr-3" />
                    <el-slider
                        id="toolbar-draw-brush-size-slider"
                        v-model="brushSize"
                        :min="minBrushSize"
                        :max="maxBrushSize"
                        :format-tooltip="formatBrushSizeTooltip"
                        style="width: 10rem"
                    />
                </div>
            </el-horizontal-scrollbar-arrows>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent, ref, computed, onMounted, toRefs, watch, nextTick } from 'vue';
import { brushColor, brushSize } from '@/canvas/store/draw-state';
import { appliedSelectionMask, activeSelectionMask } from '@/canvas/store/selection-state';
import ElAlert from 'element-plus/lib/components/alert/index';
import ElButton, { ElButtonGroup } from 'element-plus/lib/components/button/index';
import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElHorizontalScrollbarArrows from '@/ui/el-horizontal-scrollbar-arrows.vue';
import ElInput from 'element-plus/lib/components/input/index';
import ElInputGroup from '@/ui/el-input-group.vue';
import ElInputNumber from '@/ui/el-input-number.vue';
import ElPopover from '@/ui/el-popover.vue';
import ElSelect, { ElOption } from 'element-plus/lib/components/select/index';
import ElSlider from 'element-plus/lib/components/slider/index';
import ElTooltip from 'element-plus/lib/components/tooltip/index';
import historyStore from '@/store/history';
import workingFileStore, { WorkingFileState } from '@/store/working-file';
import { ClearSelectionAction } from '@/actions/clear-selection';

import { convertUnits } from '@/lib/metrics';
import appEmitter from '@/lib/emitter';
import { colorToHsla } from '@/lib/color';

export default defineComponent({
    name: 'ToolbarFreeTransform',
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

        const hasSelection = computed<boolean>(() => {
            return !(appliedSelectionMask.value == null && activeSelectionMask.value == null);
        });
        
        /*------------*\
        | Color Picker |
        \*------------*/

        const isBrushColorLight = ref<boolean>(true);

        watch(() => brushColor.value, (color) => {
            isBrushColorLight.value = colorToHsla(color, 'rgba').l > 0.6;
        }, { immediate: true });

        function onPickColor() {
            appEmitter.emit('app.dialogs.openFromDock', {
                name: 'color-picker',
                props: {
                    color: brushColor.value
                },
                onClose: (event?: any) => {
                    if (event?.color) {
                        brushColor.value = event.color;
                    }
                }
            })
        }

        /*----------*\
        | Brush Size |
        \*----------*/

        const minBrushSize = ref(1);
        const maxBrushSize = ref(500);

        function formatBrushSizeTooltip(value: number) {
            const percentage = (value - minBrushSize.value) / (maxBrushSize.value - minBrushSize.value);
            return `${(100 * percentage).toFixed(0)}% - ${value}px`;
        }

        return {
            selectedLayerIds,
            hasSelection,

            brushColor,
            isBrushColorLight,
            onPickColor,

            brushSize,
            minBrushSize,
            maxBrushSize,
            formatBrushSizeTooltip,
        };
    }
});
</script>
