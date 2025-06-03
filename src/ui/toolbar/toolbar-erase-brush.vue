<template>
    <div class="flex container items-center justify-center mx-auto">
        <div class="og-toolbar-overlay">
            <div class="og-toolbar-tool-selector">
                <span class="bi bi-eraser my-1" aria-hidden="true"></span>
                <span class="og-toolbar-tool-selector__description" v-t="'toolbar.general.settings'" />
            </div>
            <el-horizontal-scrollbar-arrows>
                <div
                    role="button"
                    tabindex="0"
                    class="og-gradient-input og-gradient-input--small"
                    aria-haspopup="dialog"
                    :aria-expanded="showBrushDrawer"
                    :aria-controls="showBrushDrawer ? ('toolbar-draw-brush-select-brush-drawer-' + uuid) : undefined"
                    @click="onClickBrushSelect()"
                    @keydown="onKeydownBrushSelect($event)"
                >
                    <img class="og-gradient-input__image" :src="selectedBrushPreviewImage" aria-hidden="true">
                </div>
                <og-button v-model:pressed="opacityDockVisible" outline solid small toggle class="!ml-3"
                    @click="opacityDockLeft = 0; opacityDockTop = 0;">
                    <i class="bi bi-transparency mr-1" aria-hidden="true" />
                    {{ t('toolbar.eraseBrush.brushOpacity') }}
                </og-button>
                <og-button v-model:pressed="sizeDockVisible" outline solid small toggle class="!ml-3"
                    @click="sizeDockLeft = 0; sizeDockTop = 0;">
                    <i class="bi bi-plus-circle mr-1" aria-hidden="true" />
                    {{ t('toolbar.eraseBrush.brushSize') }}
                </og-button>
                <og-button v-model:pressed="smoothingDockVisible" outline solid small toggle class="!ml-3 !mr-3"
                    @click="smoothingDockLeft = 0; smoothingDockTop = 0;">
                    <i class="bi bi-disc mr-1" aria-hidden="true" />
                    {{ t('toolbar.eraseBrush.brushSmoothing') }}
                </og-button>
            </el-horizontal-scrollbar-arrows>
        </div>
        <floating-dock v-if="opacityDockVisible" v-model:top="opacityDockTop" v-model:left="opacityDockLeft" :visible="floatingDocksVisible">
            <label for="toolbar-draw-brush-opacity-slider" v-t="'toolbar.eraseBrush.brushOpacity'" class="mr-4" />
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
            <label for="toolbar-draw-brush-size-slider" v-t="'toolbar.eraseBrush.brushSize'" class="mr-4" />
            <el-slider
                id="toolbar-draw-brush-size-slider"
                v-model="scaledBrushSize"
                :min="0"
                :max="1"
                :step="0.01"
                :format-tooltip="formatBrushSizeTooltip"
                class="!w-50 !max-w-full"
            />
        </floating-dock>
        <floating-dock v-if="smoothingDockVisible" v-model:top="smoothingDockTop" v-model:left="smoothingDockLeft" :visible="floatingDocksVisible">
            <label for="toolbar-draw-brush-smoothing-slider" v-t="'toolbar.drawBrush.brushSmoothing'" class="mr-4" />
            <el-slider
                id="toolbar-draw-brush-smoothing-slider"
                v-model="scaledBrushSmoothing"
                :min="0"
                :max="1"
                :step="0.01"
                :format-tooltip="formatBrushSmoothingTooltip"
                class="!w-30 !max-w-full"
            />
        </floating-dock>
        <div
            v-if="showBrushDrawer"
            :id="'toolbar-draw-brush-select-brush-drawer-' + uuid"
            role="dialog"
            class="og-toolbar-drawer"
            style="max-width: 38rem"
        >
            <dock-brush-editor
                v-model:selected-brush-id="selectedBrush"
                v-model:visible="showBrushDrawer"
                @close="showBrushDrawer = false"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { v4 as uuidv4 } from 'uuid';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import { t } from '@/i18n';

import {
    brushOpacity, brushSize, brushSmoothing, showBrushDrawer,
    opacityDockVisible, opacityDockTop, opacityDockLeft,
    sizeDockVisible, sizeDockTop, sizeDockLeft,
    smoothingDockVisible, smoothingDockTop, smoothingDockLeft,
    selectedBrush, selectedBrushPreview, generateSelectedBrushPreview,
} from '@/canvas/store/erase-brush-state';

import ElHorizontalScrollbarArrows from '@/ui/el/el-horizontal-scrollbar-arrows.vue';
import ElSlider from 'element-plus/lib/components/slider/index';

import OgButton from '@/ui/element/button.vue';
import FloatingDock from '@/ui/dock/floating-dock.vue';
import DockBrushEditor from '@/ui/dock/dock-brush-editor.vue';

import appEmitter from '@/lib/emitter';
import { createImageFromCanvas } from '@/lib/image';

defineOptions({
    name: 'ToolbarErase',
});

const emit = defineEmits(['close']);

const uuid = uuidv4();

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

/*------------*\
| Brush Select |
\*------------*/

const selectedBrushPreviewImage = ref<string>('');

onMounted(() => {
    generateSelectedBrushPreview();
});

watch(() => selectedBrushPreview.value, (selectedBrushPreview) => {
    if (!selectedBrushPreview) return;
    createImageFromCanvas(selectedBrushPreview, { srcType: 'objectUrl' }).then((image) => {
        selectedBrushPreviewImage.value = image.src;
    });
}, { immediate: true });

function onClickBrushSelect() {
    showBrushDrawer.value = !showBrushDrawer.value;
}

function onKeydownBrushSelect(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
        showBrushDrawer.value = !showBrushDrawer.value;
    }
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

/*---------------*\
| Brush Smoothing |
\*---------------*/

const minBrushSmoothing = ref(0.05);
const maxBrushSmoothing = ref(1);

const scaledBrushSmoothing = computed<number>({
    set(value) {
        const easingValue = ((1 - value) * (1 - value) * (1 - value));
        brushSmoothing.value = minBrushSmoothing.value + easingValue * (maxBrushSmoothing.value - minBrushSmoothing.value);
    },
    get() {
        const scaledBrushSmoothing = (brushSmoothing.value - minBrushSmoothing.value) / (maxBrushSmoothing.value - minBrushSmoothing.value);
        return 1 - Math.cbrt(scaledBrushSmoothing);
    }
});

function formatBrushSmoothingTooltip() {
    const value = brushSmoothing.value;
    const percentage = (value - minBrushSmoothing.value) / (maxBrushSmoothing.value - minBrushSmoothing.value);
    return `${(100 * (1 - Math.cbrt(percentage))).toFixed(0)}%`;
}

</script>
