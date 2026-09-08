<template>
    <div class="flex container items-center justify-between mx-auto">
        <div class="py-2 pl-el-scrollbar-arrow-size text-nowrap text-ellipsis">
            <div class="block my-2 text-ellipsis">
                <i class="bi bi-droplet-half" aria-hidden="true" />
                {{ t('toolbar.layerOpacity.title') }}
            </div>
        </div>
        <div class="py-2 pl-3 pr-el-scrollbar-arrow-size text-nowrap">
            <el-button plain link type="primary" class="px-4! mr-2!" :aria-label="t('button.cancel')" @click="onCancel">
                <template v-if="isMobileView">
                    <i class="bi bi-x"></i>
                </template>
                <template v-else>
                    {{ t('button.cancel') }}
                </template>
            </el-button>
            <el-button :aria-label="t('button.done')" plain type="primary" class="ml-0!" @click="onDone">
                <template v-if="isMobileView">
                    <i class="bi bi-check"></i>
                </template>
                <template v-else>
                    {{ t('button.done') }}
                </template>
            </el-button>
        </div>
    </div>
    <div style="background: var(--og-background-color)">
        <div class="container mx-auto">
            <el-horizontal-scrollbar-arrows>
                <el-form-item :label="t('toolbar.layerOpacity.opacity')" class="el-form-item--small-label">
                    <div class="flex gap-6">
                        <el-slider
                            v-model="previewOpacity"
                            :aria-label="t('measurement.percentage')"
                            :min="0" :max="1" :step="0.01" :show-tooltip="false"
                            style="width: 8rem"
                        />
                        <el-input-number
                            v-model="previewOpacityPercentage"
                            :aria-label="t('measurement.percentage')"
                            size="small"
                            suffix-text="%"
                            style="width: 5rem"
                        />
                    </div>
                </el-form-item>
            </el-horizontal-scrollbar-arrows>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRefs, watch } from 'vue';
import { useI18n } from '@/i18n';

import ElButton from 'element-plus/lib/components/button/index';
import ElHorizontalScrollbarArrows from '@/ui/el/el-horizontal-scrollbar-arrows.vue';
import { ElFormItem } from 'element-plus/lib/components/form/index';
import ElInputNumber from '@/ui/el/el-input-number.vue';
import ElSlider from 'element-plus/lib/components/slider/index';

import canvasStore from '@/store/canvas';
import { layerOpacityEmitter, previewOpacity } from '@/canvas/store/layer-opacity-state';

const { t } = useI18n();

const emit = defineEmits([
    'close',
]);

const isMobileView = ref<boolean>(false);
const { viewWidth: viewportWidth } = toRefs(canvasStore.state);

const previewOpacityPercentage = computed({
    get() {
        return Math.round(previewOpacity.value * 100);
    },
    set(opacity) {
        previewOpacity.value = Math.round(opacity / 100);
    }
});

watch([viewportWidth], () => {
    toggleMobileView();
});

onMounted(() => {
    toggleMobileView();
    layerOpacityEmitter.on('cancel', onClose);
    layerOpacityEmitter.on('done', onClose);
});

onUnmounted(() => {
    layerOpacityEmitter.off('cancel', onClose);
    layerOpacityEmitter.off('done', onClose);
});

function toggleMobileView() {
    isMobileView.value = viewportWidth.value < 500;
}

function onClose() {
    emit('close');
}

function onCancel() {
    layerOpacityEmitter.emit('cancel');
}

function onDone() {
    layerOpacityEmitter.emit('done');
}
</script>
