<template>
    <div class="is-flex container is-align-items-center is-justify-content-center mx-auto">
        <div class="og-toolbar-overlay">
            <div class="og-toolbar-tool-selector">
                <span class="bi bi-eraser my-1" aria-hidden="true"></span>
                <span class="og-toolbar-tool-selector__description" v-t="'toolbar.general.settings'" />
            </div>
            <el-horizontal-scrollbar-arrows>
                <div class="is-flex is-align-items-center px-3">
                    <label for="toolbar-erase-brush-size-slider" v-t="'toolbar.eraseBrush.brushSize'" class="mr-3" />
                    <el-slider
                        id="toolbar-erase-brush-size-slider"
                        v-model="selectionBrushSize"
                        :min="0"
                        :max="1"
                        :step="0.01"
                        :format-tooltip="formatBrushSizeTooltip"
                        style="width: 10rem"
                    />
                </div>
            </el-horizontal-scrollbar-arrows>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, toRefs, watch } from 'vue';
import { brushSize } from '@/canvas/store/erase-brush-state';

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


export default defineComponent({
    name: 'ToolbarErase',
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

        /*----------*\
        | Brush Size |
        \*----------*/

        const minBrushSize = ref(1);
        const maxBrushSize = ref(1000);

        const selectionBrushSize = computed<number>({
            set(value) {
                const easingValue = value * value;
                brushSize.value = Math.round(minBrushSize.value + easingValue * (maxBrushSize.value - minBrushSize.value));
            },
            get() {
                const scaledBrushSize = (brushSize.value - minBrushSize.value) / (maxBrushSize.value - minBrushSize.value);
                return Math.sqrt(scaledBrushSize);
            }
        });

        function formatBrushSizeTooltip() {
            const value = brushSize.value;
            const percentage = (value - minBrushSize.value) / (maxBrushSize.value - minBrushSize.value);
            return `${(100 * percentage).toFixed(0)}% - ${value}px`;
        }

        return {
            selectionBrushSize,
            minBrushSize,
            maxBrushSize,
            formatBrushSizeTooltip,
        };
    }
});
</script>
