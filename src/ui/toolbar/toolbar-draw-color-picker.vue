<template>
    <div class="is-flex container is-align-items-center is-justify-content-space-between mx-auto">
        <div class="py-2 pl-el-scrollbar-arrow-size is-text-nowrap is-text-ellipsis">
            <div class="is-block my-2 is-text-ellipsis">
                <i class="bi bi-crop" aria-hidden="true" />
                {{ $t('toolbar.drawColorPicker.title') }}
            </div>
        </div>
        <div class="py-2 pl-3 pr-el-scrollbar-arrow-size is-text-nowrap">
            <el-button plain link type="primary" class="px-4 mr-2" :aria-label="$t('button.cancel')" @click="onCancel">
                <template v-if="isMobileView">
                    <i class="bi bi-x"></i>
                </template>
                <template v-else>
                    {{ $t('button.cancel') }}
                </template>
            </el-button>
        </div>
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, onUnmounted, ref, toRefs, watch } from 'vue';

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

import canvasStore from '@/store/canvas';
import { drawColorPickerEmitter } from '@/canvas/store/draw-color-picker-state';

export default defineComponent({
    name: 'ToolbarDeformBlur',
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

        const isMobileView = ref<boolean>(false);
        const { viewWidth: viewportWidth } = toRefs(canvasStore.state);

        watch([viewportWidth], () => {
            toggleMobileView();
        });

        onMounted(() => {
            toggleMobileView();
            drawColorPickerEmitter.on('colorPicked', onCancel);
        });

        onUnmounted(() => {
            drawColorPickerEmitter.off('colorPicked', onCancel);
        });

        function toggleMobileView() {
            isMobileView.value = viewportWidth.value < 500;
        }

        function onCancel() {
            drawColorPickerEmitter.emit('close');
            emit('close');
        }

        return {
            isMobileView,
            onCancel,
        };
    }
});
</script>
