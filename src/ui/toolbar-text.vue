<template>
    <div class="is-flex container is-align-items-center is-justify-content-center mx-auto">
        <div class="ogr-toolbar-overlay">
            <div class="ogr-toolbar-tool-selector">
                <span class="bi bi-type my-1" aria-hidden="true"></span>
                <span class="ogr-toolbar-tool-selector__description">Settings</span>
            </div>
            <el-horizontal-scrollbar-arrows>
                <el-input-group>
                    <template #prepend>
                        <span>Font</span>
                    </template>
                    <el-select aria-label="Font" v-model="family" size="small" style="width: 6rem">
                        <el-option v-for="family of familyList" :key="family" :label="family" :value="family"></el-option>
                    </el-select>
                </el-input-group>
                <el-input-group class="ml-3">
                    <template #prepend>
                        <span>Size</span>
                    </template>
                    <el-input-number aria-label="Size" v-model="size" size="small" style="width: 3rem"></el-input-number>
                </el-input-group>
                <el-button-group class="el-button-group--flex ml-3">
                    <el-button aria-label="Bold" size="small" plain>
                        <span class="bi bi-type-bold" aria-hidden="true"></span>
                    </el-button>
                    <el-button aria-label="Italic" size="small" plain>
                        <span class="bi bi-type-italic" aria-hidden="true"></span>
                    </el-button>
                    <el-button aria-label="Strikethrough" size="small" plain>
                        <span class="bi bi-type-strikethrough" aria-hidden="true"></span>
                    </el-button>
                    <el-button aria-label="Underline" size="small" plain>
                        <span class="bi bi-type-underline" aria-hidden="true"></span>
                    </el-button>
                </el-button-group>
                <el-input-group class="ml-3" prepend-tooltip="Color that shows inside the edges of the letter(s)">
                    <template #prepend>
                        <span>Fill</span>
                    </template>
                    <el-input-color aria-label="Size"></el-input-color>
                </el-input-group>
            </el-horizontal-scrollbar-arrows>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent, ref, computed, onMounted, toRefs, watch, nextTick } from 'vue';
import ElButton, { ElButtonGroup } from 'element-plus/lib/components/button/index';
import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElHorizontalScrollbarArrows from '@/ui/el-horizontal-scrollbar-arrows.vue';
import ElInputColor from '@/ui/el-input-color.vue';
import ElInputGroup from '@/ui/el-input-group.vue';
import ElInputNumber from '@/ui/el-input-number.vue';
import ElPopover from '@/ui/el-popover.vue';
import ElSelect, { ElOption } from 'element-plus/lib/components/select/index';
import { textMetaDefaults } from '@/canvas/store/text-state';
import appEmitter from '@/lib/emitter';
import canvasStore from '@/store/canvas';

export default defineComponent({
    name: 'ToolbarText',
    components: {
        ElButton,
        ElButtonGroup,
        ElForm,
        ElFormItem,
        ElHorizontalScrollbarArrows,
        ElInputColor,
        ElInputGroup,
        ElInputNumber,
        ElOption,
        ElPopover,
        ElSelect
    },
    props: {
        
    },
    emits: [
        'close'
    ],
    setup(props, { emit }) {

        const family = ref<string>(textMetaDefaults.family);
        const familyList = ref<string[]>([textMetaDefaults.family]);
        const size = ref<number>(textMetaDefaults.size);

        return {
            family,
            familyList,
            size
        };
    }
});
</script>
