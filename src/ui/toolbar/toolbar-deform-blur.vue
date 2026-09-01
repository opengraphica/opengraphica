<template>
    <div class="flex container items-center justify-center mx-auto">
        <div class="og-toolbar-overlay">
            <div class="og-toolbar-tool-selector">
                <span class="bi bi-droplet my-1" aria-hidden="true"></span>
                <span class="og-toolbar-tool-selector__description">
                    {{ t('toolbar.general.settings') }}
                </span>
            </div>
            <el-horizontal-scrollbar-arrows>
                <div class="flex items-center px-3">
                    <label for="toolbar-deform-blur-size-slider" class="mr-3">
                        {{ t('toolbar.deformBlur.brushSize') }}
                    </label>
                    <el-slider
                        id="toolbar-deform-blur-size-slider"
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

<script setup lang="ts">
import { computed, defineComponent, ref } from 'vue';
import { useI18n } from '@/i18n';
import { brushSize } from '@/canvas/store/deform-blur-state';

import ElHorizontalScrollbarArrows from '@/ui/el/el-horizontal-scrollbar-arrows.vue';
import ElSlider from 'element-plus/lib/components/slider/index';

const { t } = useI18n();

const emit = defineEmits(['close']);

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
</script>
