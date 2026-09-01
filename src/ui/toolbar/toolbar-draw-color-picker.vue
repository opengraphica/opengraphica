<template>
    <div class="flex container items-center justify-between mx-auto">
        <div class="py-2 pl-el-scrollbar-arrow-size text-nowrap text-ellipsis">
            <div class="block my-2 text-ellipsis">
                <i class="bi bi-crop" aria-hidden="true" />
                {{ t('toolbar.drawColorPicker.title') }}
            </div>
        </div>
        <div class="py-2 pl-3 pr-el-scrollbar-arrow-size text-nowrap">
            <el-button plain link type="primary" class="px-4 mr-2" :aria-label="t('button.cancel')" @click="onCancel">
                <template v-if="isMobileView">
                    <i class="bi bi-x"></i>
                </template>
                <template v-else>
                    {{ t('button.cancel') }}
                </template>
            </el-button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, toRefs, watch } from 'vue';
import { useI18n } from '@/i18n';

import ElButton from 'element-plus/lib/components/button/index';

import canvasStore from '@/store/canvas';
import { drawColorPickerEmitter } from '@/canvas/store/draw-color-picker-state';

const { t } = useI18n();

const emit = defineEmits([
    'close',
]);

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
</script>
