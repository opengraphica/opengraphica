<template>
    <div class="is-flex container is-align-items-center is-justify-content-center mx-auto">
        <div class="ogr-toolbar-overlay">
            <div class="ogr-toolbar-tool-selector">
                <span class="bi bi-type my-1" aria-hidden="true"></span>
                <span class="ogr-toolbar-tool-selector__description" v-t="'toolbar.general.settings'" />
            </div>
            <el-horizontal-scrollbar-arrows>
                <el-input-group>
                    <template #prepend>
                        <span class="is-size-7" v-t="'toolbar.text.font'" />
                    </template>
                    <el-select :aria-label="$t('toolbar-text-font')" v-model="family" size="small" style="width: 6rem">
                        <el-option v-for="family of familyList" :key="family" :label="family" :value="family"></el-option>
                    </el-select>
                </el-input-group>
                <el-input-group class="ml-3">
                    <template #prepend>
                        <span class="is-size-7" v-t="'toolbar.text.size'" />
                    </template>
                    <el-input-number :aria-label="$t('toolbar.text.size')" v-model="size" size="small" style="width: 3rem"></el-input-number>
                </el-input-group>
                <el-button-group class="el-button-group--flex ml-3">
                    <el-button :aria-label="$t('toolbar.text.bold')" size="small" plain class="px-3">
                        <span class="bi bi-type-bold" aria-hidden="true"></span>
                    </el-button>
                    <el-button :aria-label="$t('toolbar.text.italic')" size="small" plain class="px-3">
                        <span class="bi bi-type-italic" aria-hidden="true"></span>
                    </el-button>
                    <el-button :aria-label="$t('toolbar.text.strikethrough')" size="small" plain class="px-3">
                        <span class="bi bi-type-strikethrough" aria-hidden="true"></span>
                    </el-button>
                    <el-button :aria-label="$t('toolbar.text.underline')" size="small" plain class="px-3">
                        <span class="bi bi-type-underline" aria-hidden="true"></span>
                    </el-button>
                </el-button-group>
                <el-input-group class="ml-3" :prepend-tooltip="$t('toolbar.text.fillTooltip')">
                    <template #prepend>
                        <span class="is-size-7" v-t="'toolbar.text.fill'">Fill</span>
                    </template>
                    <el-input-color :aria-label="$t('toolbar.text.fill')"></el-input-color>
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
