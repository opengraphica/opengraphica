<template>
    <div class="flex container items-center justify-center mx-auto">
        <div class="og-toolbar-overlay">
            <div class="og-toolbar-tool-selector">
                <span class="bi bi-pencil my-1" aria-hidden="true"></span>
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
                <og-button v-model:pressed="colorPaletteDockVisible" outline solid small toggle class="!ml-3"
                    @click="colorPaletteDockLeft = 0; colorPaletteDockTop = 0;">
                    <i class="bi bi-palette-fill mr-1" aria-hidden="true" />
                    {{ t('toolbar.drawBrush.brushColor') }}
                </og-button>
                <og-button v-model:pressed="sizeDockVisible" outline solid small toggle class="!ml-3"
                    @click="sizeDockLeft = 0; sizeDockTop = 0;">
                    <i class="bi bi-plus-circle mr-1" aria-hidden="true" />
                    {{ t('toolbar.drawBrush.brushSize') }}
                </og-button>
                <og-button v-model:pressed="smoothingDockVisible" outline solid small toggle class="!ml-3 !mr-3"
                    @click="smoothingDockLeft = 0; smoothingDockTop = 0;">
                    <i class="bi bi-disc mr-1" aria-hidden="true" />
                    {{ t('toolbar.drawBrush.brushSmoothing') }}
                </og-button>
            </el-horizontal-scrollbar-arrows>
        </div>
        <floating-dock v-if="colorPaletteDockVisible" v-model:top="colorPaletteDockTop" v-model:left="colorPaletteDockLeft" :visible="floatingDocksVisible">
            <div class="flex flex-wrap gap-2 max-w-105">
                <og-button
                    v-for="(palette, colorIndex) of colorPaletteItems"
                    solid icon small toggle="active"
                    :pressed="colorIndex === colorPaletteIndex"
                    :aria-label="t('toolbar.drawBrush.brushColor')"
                    class="og-button--color-swatch"
                    :style="{
                        '--og-button-swatch-background': palette.color.style,
                        '--og-button-swatch-color': palette.isLight ? '#000000' : '#ffffff',
                    }"
                    @click="onClickColorPalette($event, colorIndex)"
                >
                    <i class="bi bi-palette-fill" aria-hidden="true" />
                </og-button>
                <og-button ref="showColorPaletteSettingsButton" :aria-label="t('button.settings')" small slim @click="onEditPaletteSettings()">
                    <span class="bi bi-gear-fill" aria-hidden="true" />
                </og-button>
                <og-popover
                    v-model:visible="showColorPaletteSettings"
                    placement="top" arrow :offset="16"
                    :reference="showColorPaletteSettingsButton?.$el"
                >
                    <div class="og-popover__content">
                        <el-form action="javascript:void(0)" label-position="top">
                            <el-form-item :label="$t('toolbar.drawBrush.paletteCount')" class="!m-0 !p-0 !max-w-30">
                                <el-input-number
                                    v-model.lazy="colorPaletteCount"
                                    size="small"
                                    :min="1" :max="19" :step="1"
                                />
                            </el-form-item>
                        </el-form>
                    </div>
                </og-popover>
            </div>
        </floating-dock>
        <floating-dock v-if="sizeDockVisible" v-model:top="sizeDockTop" v-model:left="sizeDockLeft" :visible="floatingDocksVisible">
            <label for="toolbar-draw-brush-size-slider" v-t="'toolbar.drawBrush.brushSize'" class="mr-4" />
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';

import { t } from '@/i18n';

import {
    brushSize, brushSmoothing, colorPalette, colorPaletteIndex, showBrushDrawer,
    selectedBrush, selectedBrushPreview, generateSelectedBrushPreview,
    colorPaletteDockVisible, colorPaletteDockTop, colorPaletteDockLeft,
    sizeDockVisible, sizeDockTop, sizeDockLeft,
    smoothingDockVisible, smoothingDockTop, smoothingDockLeft,
} from '@/canvas/store/draw-brush-state';

import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElHorizontalScrollbarArrows from '@/ui/el/el-horizontal-scrollbar-arrows.vue';
import ElInputNumber from '@/ui/el/el-input-number.vue';
import ElSlider from 'element-plus/lib/components/slider/index';

import OgButton from '@/ui/element/button.vue';
import OgPopover from '@/ui/element/popover.vue';
import FloatingDock from '@/ui/dock/floating-dock.vue';
import DockBrushEditor from '@/ui/dock/dock-brush-editor.vue';

import appEmitter from '@/lib/emitter';
import { colorToHsla } from '@/lib/color';
import { createImageFromCanvas } from '@/lib/image';

import type { RGBAColor } from '@/types';

defineOptions({
    name: 'ToolbarDrawBrush',
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
| Color Palette |
\*-------------*/

interface ColorPaletteItem {
    isLight: boolean;
    color: RGBAColor;
}

const showColorPaletteSettingsButton = ref<typeof OgButton>();
const showColorPaletteSettings = ref<boolean>(false);

const colorPaletteCount = computed<number>({
    get() {
        return colorPalette.value.length;
    },
    set(count) {
        count = Math.round(count);
        if (isNaN(count)) return;
        if (colorPaletteIndex.value >= count) {
            colorPaletteIndex.value = 0;
        }
        if (colorPalette.value.length > count) {
            colorPalette.value = colorPalette.value.slice(0, count);
        } else if (colorPalette.value.length < count) {
            for (let i = colorPalette.value.length; i < count; i++) {
                colorPalette.value.push({
                    is: 'color',
                    r: 0,
                    g: 0,
                    b: 0,
                    alpha: 1,
                    style: '#000000'
                });
            }
        }
    }
});

const colorPaletteItems = computed<ColorPaletteItem[]>(() => {
    return colorPalette.value.map((color) => {
        return {
            isLight: colorToHsla(color, 'rgba').l > 0.6,
            color,
        }
    });
});

function onClickColorPalette(e: MouseEvent, index: number) {
    if (index === colorPaletteIndex.value) {
        e.preventDefault();
        appEmitter.emit('app.dialogs.openFromDock', {
            name: 'color-picker',
            props: {
                color: colorPalette.value[index],
            },
            onClose: (event?: any) => {
                if (event?.color) {
                    colorPalette.value[index] = event.color;
                }
            }
        });
    } else {
        colorPaletteIndex.value = index;
    }
}

function onEditPaletteSettings() {
    showColorPaletteSettings.value = !showColorPaletteSettings.value;
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
