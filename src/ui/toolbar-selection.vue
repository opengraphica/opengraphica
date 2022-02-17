<template>
    <div class="is-flex container is-align-items-center is-justify-content-center mx-auto">
        <div class="ogr-toolbar-overlay">
            <div class="ogr-toolbar-tool-selector">
                <span class="bi bi-bounding-box mb-1" aria-hidden="true"></span>
                <span class="ogr-toolbar-tool-selector__description">Settings</span>
            </div>
            <el-horizontal-scrollbar-arrows>
                <el-input-group prepend-tooltip="Selection Shape">
                    <template #prepend>
                        <span class="bi bi-bounding-box" aria-hidden="true" />
                    </template>
                    <el-select aria-label="Selection Shape" v-model="selectionMode" size="small" style="width: 6rem">
                        <el-option label="Rectangle" value="rectangle"></el-option>
                        <el-option label="Ellipse" value="ellipse"></el-option>
                        <el-option label="Free" value="free"></el-option>
                        <el-option label="Tonal Area" value="tonalArea"></el-option>
                    </el-select>
                </el-input-group>
            </el-horizontal-scrollbar-arrows>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent, ref, computed, onMounted, toRefs, watch, nextTick } from 'vue';
import ElAlert from 'element-plus/lib/components/alert/index';
import ElButton, { ElButtonGroup } from 'element-plus/lib/components/button/index';
import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElHorizontalScrollbarArrows from '@/ui/el-horizontal-scrollbar-arrows.vue';
import ElInputGroup from '@/ui/el-input-group.vue';
import ElInputNumber from '@/ui/el-input-number.vue';
import ElPopover from '@/ui/el-popover.vue';
import ElSelect, { ElOption } from 'element-plus/lib/components/select/index';
import ElSwitch from 'element-plus/lib/components/switch/index';
import appEmitter from '@/lib/emitter';
import canvasStore from '@/store/canvas';
import { selectionMode } from '@/canvas/store/selection-state';

export default defineComponent({
    name: 'ToolbarFreeTransform',
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
        ElPopover,
        ElSelect,
        ElSwitch
    },
    props: {
        
    },
    emits: [
        'close'
    ],
    setup(props, { emit }) {
        return {
            selectionMode
        };
    }
});
</script>
