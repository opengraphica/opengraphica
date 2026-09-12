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
                <og-button v-model:pressed="strengthDockVisible" outline solid small toggle class="ml-3!"
                    @click="strengthDockLeft = 0; strengthDockTop = 0;">
                    <i class="bi bi-circle-half mr-1" aria-hidden="true" />
                    {{ t('toolbar.deformBlur.brushStrength') }}
                </og-button>
                <og-button v-model:pressed="sizeDockVisible" outline solid small toggle class="ml-3!"
                    @click="sizeDockLeft = 0; sizeDockTop = 0;">
                    <i class="bi bi-plus-circle mr-1" aria-hidden="true" />
                    {{ t('toolbar.deformBlur.brushSize') }}
                </og-button>
                <og-button v-model:pressed="opacityDockVisible" outline solid small toggle class="ml-3!"
                    @click="opacityDockLeft = 0; opacityDockTop = 0;">
                    <i class="bi bi-transparency mr-1" aria-hidden="true" />
                    {{ t('toolbar.deformBlur.brushOpacity') }}
                </og-button>
                <og-button v-model:pressed="hardnessDockVisible" outline solid small toggle class="ml-3!"
                    @click="hardnessDockLeft = 0; hardnessDockTop = 0;">
                    <i class="bi bi-noise-reduction mr-1" aria-hidden="true" />
                    {{ t('toolbar.deformBlur.brushHardness') }}
                </og-button>
            </el-horizontal-scrollbar-arrows>
        </div>
        <floating-dock v-if="opacityDockVisible" v-model:top="opacityDockTop" v-model:left="opacityDockLeft" :visible="floatingDocksVisible">
            <label for="toolbar-draw-brush-opacity-slider" class="text-sm mr-4">
                {{ t('toolbar.deformBlur.brushOpacity') }}
            </label>
            <el-slider
                id="toolbar-draw-brush-opacity-slider"
                v-model="scaledBrushOpacity"
                :min="0"
                :max="1"
                :step="0.01"
                :format-tooltip="formatBrushOpacityTooltip"
                class="!w-35 !max-w-full"
            />
        </floating-dock>
        <floating-dock v-if="sizeDockVisible" v-model:top="sizeDockTop" v-model:left="sizeDockLeft" :visible="floatingDocksVisible">
            <label for="toolbar-draw-brush-size-slider" class="text-sm mr-4">
                {{ t('toolbar.deformBlur.brushSize') }}
            </label>
            <el-slider
                id="toolbar-draw-brush-size-slider"
                v-model="scaledBrushSize"
                :min="0"
                :max="1"
                :step="0.01"
                :format-tooltip="formatBrushSizeTooltip"
                class="!w-50 !max-w-full"
                @input="onInputScaledBrushSize"
                @change="onChangeScaledBrushSize"
            />
        </floating-dock>
        <floating-dock v-if="strengthDockVisible" v-model:top="strengthDockTop" v-model:left="strengthDockLeft" :visible="floatingDocksVisible">
            <label for="toolbar-draw-brush-strength-slider" class="text-sm mr-4">
                {{ t('toolbar.deformBlur.brushStrength') }}
            </label>
            <el-slider
                id="toolbar-draw-brush-strength-slider"
                v-model="brushStrength"
                :min="0"
                :max="1"
                :step="0.01"
                :format-tooltip="formatBrushStrengthTooltip"
                class="!w-50 !max-w-full"
            />
        </floating-dock>
        <floating-dock v-if="hardnessDockVisible" v-model:top="hardnessDockTop" v-model:left="hardnessDockLeft" :visible="floatingDocksVisible">
            <label for="toolbar-draw-brush-hardness-slider" class="text-sm mr-4">
                {{ t('toolbar.deformBlur.brushHardness') }}
            </label>
            <el-slider
                id="toolbar-draw-brush-hardness-slider"
                v-model="brushHardness"
                :min="0"
                :max="1"
                :step="0.01"
                :format-tooltip="formatBrushHardnessTooltip"
                class="!w-50 !max-w-full"
            />
        </floating-dock>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from '@/i18n';

import appEmitter from '@/lib/emitter';

import {
    brushSize, isPreviewingSize, brushOpacity, brushStrength, brushHardness,
    hardnessDockTop, hardnessDockLeft, hardnessDockVisible,
    opacityDockTop, opacityDockLeft, opacityDockVisible,
    sizeDockTop, sizeDockLeft, sizeDockVisible,
    strengthDockTop, strengthDockLeft, strengthDockVisible,
} from '@/canvas/store/deform-blur-state';

import ElHorizontalScrollbarArrows from '@/ui/el/el-horizontal-scrollbar-arrows.vue';
import ElSlider from 'element-plus/lib/components/slider/index';

import OgButton from '@/ui/element/button.vue';
import FloatingDock from '@/ui/dock/floating-dock.vue';

const { t } = useI18n();

const emit = defineEmits(['close']);

/*------------*\
| Toolbar Swap |
\*------------*/

const floatingDocksVisible = ref<boolean>(true);

onMounted(() => {
    appEmitter.on('editor.tool.toolbarSwapping', onToolbarSwap);
});

onUnmounted(() => {
    appEmitter.off('editor.tool.toolbarSwapping', onToolbarSwap);
});

function onToolbarSwap() {
    floatingDocksVisible.value = false;
}

/*-------------*\
| Brush Opacity |
\*-------------*/

const minBrushOpacity = ref(0);
const maxBrushOpacity = ref(1);

const scaledBrushOpacity = computed<number>({
    set(value) {
        brushOpacity.value = value;
    },
    get() {
        return brushOpacity.value;
    }
});

function formatBrushOpacityTooltip() {
    const value = brushOpacity.value;
    const percentage = (value - minBrushOpacity.value) / (maxBrushOpacity.value - minBrushOpacity.value);
    return `${(100 * percentage).toFixed(0)}%`;
}


/*----------*\
| Brush Size |
\*----------*/

const minBrushSize = ref(1);
const maxBrushSize = ref(1000);

const scaledBrushSize = computed<number>({
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

function onInputScaledBrushSize() {
    isPreviewingSize.value = true;
}

function onChangeScaledBrushSize() {
    isPreviewingSize.value = false;
}

/*--------------*\
| Brush Strength |
\*--------------*/

function formatBrushStrengthTooltip() {
    const value = brushStrength.value;
    const percentage = value / 1;
    return `${(100 * percentage).toFixed(0)}%`;
}

/*--------------*\
| Brush Hardness |
\*--------------*/

function formatBrushHardnessTooltip() {
    const value = brushHardness.value;
    const percentage = value / 1;
    return `${(100 * percentage).toFixed(0)}%`;
}

</script>
