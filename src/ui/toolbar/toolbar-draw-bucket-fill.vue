<template>
    <div class="flex container items-center justify-center mx-auto">
        <div class="og-toolbar-overlay">
            <div class="og-toolbar-tool-selector">
                <span class="bi bi-paint-bucket my-1" aria-hidden="true"></span>
                <span class="og-toolbar-tool-selector__description">
                    {{ t('toolbar.general.settings') }}
                </span>
            </div>
            <el-horizontal-scrollbar-arrows>
                <og-button v-model:pressed="colorPaletteDockVisible" outline solid small toggle
                    @click="colorPaletteDockLeft = 0; colorPaletteDockTop = 0;">
                    <div class="flex items-center">
                        <i class="bi bi-palette-fill mr-1" aria-hidden="true" />
                        {{ t('toolbar.drawBucketFill.brushColor') }}
                        <div
                            style="background-image: url('../images/transparency-bg.png')"
                            class="rounded-sm ml-2"
                        >
                            <div
                                :style="{
                                    'background': colorPaletteItems[colorPaletteIndex]?.color?.style,
                                }"
                                class="w-4 h-4 rounded-sm"
                            />
                        </div>
                    </div>
                </og-button>
                <og-button v-model:pressed="strengthDockVisible" outline solid small toggle
                    class="ml-3!" @click="strengthDockLeft = 0; strengthDockTop = 0;">
                    <i class="bi bi-plus-circle mr-1" aria-hidden="true" />
                    {{ t('toolbar.drawBucketFill.strength') }}
                </og-button>
                <og-button v-model:pressed="featherDockVisible" outline solid small toggle
                    class="ml-3!" @click="featherDockLeft = 0; featherDockTop = 0;">
                    <i class="bi bi-feather mr-1" aria-hidden="true" />
                    {{ t('toolbar.drawBucketFill.feather') }}
                </og-button>
                <og-button v-model:pressed="settingsDockVisible" outline solid small toggle
                    class="ml-3!" @click="settingsDockLeft = 0; settingsDockTop = 0;">
                    <i class="bi bi-gear-fill mr-1" aria-hidden="true" />
                    {{ t('toolbar.drawBucketFill.settings') }}
                </og-button>
            </el-horizontal-scrollbar-arrows>
        </div>
        <floating-dock v-if="colorPaletteDockVisible" v-model:top="colorPaletteDockTop" v-model:left="colorPaletteDockLeft" :visible="floatingDocksVisible">
            <div class="flex flex-wrap gap-2 max-w-105">
                <og-button
                    v-for="(palette, colorIndex) of colorPaletteItems"
                    solid icon small toggle="active"
                    :pressed="colorIndex === colorPaletteIndex"
                    :aria-label="t('toolbar.drawBucketFill.brushColor')"
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
                            <el-form-item :label="t('toolbar.drawBucketFill.paletteCount')" class="!m-0 !p-0 !max-w-30">
                                <el-input-number
                                    v-model.lazy="colorPaletteCount"
                                    size="small"
                                    :min="1" :max="19" :step="1"
                                    @keydown.enter="showColorPaletteSettings = false"
                                />
                            </el-form-item>
                        </el-form>
                    </div>
                </og-popover>
            </div>
        </floating-dock>
        <floating-dock v-if="strengthDockVisible" v-model:top="strengthDockTop" v-model:left="strengthDockLeft" :visible="strengthDockVisible">
            <label for="toolbar-draw-bucket-fill-strength-slider" class="text-sm mr-4">
                {{ t('toolbar.drawBucketFill.strength') }}
            </label>
            <el-slider
                id="toolbar-draw-bucket-fill-strength-slider"
                v-model="strength"
                :min="0"
                :max="1"
                :step="0.01"
                :format-tooltip="formatStrengthTooltip"
                class="!w-30 !max-w-full"
            />
        </floating-dock>
        <floating-dock v-if="featherDockVisible" v-model:top="featherDockTop" v-model:left="featherDockLeft" :visible="featherDockVisible">
            <label for="toolbar-draw-bucket-fill-feather-slider" class="text-sm mr-4">
                {{ t('toolbar.drawBucketFill.feather') }}
            </label>
            <el-slider
                id="toolbar-draw-bucket-fill-feather-slider"
                v-model="feather"
                :min="0"
                :max="1"
                :step="0.01"
                :format-tooltip="formatFeatherTooltip"
                class="!w-30 !max-w-full"
            />
        </floating-dock>
        <floating-dock v-if="settingsDockVisible" v-model:top="settingsDockTop" v-model:left="settingsDockLeft" :visible="settingsDockVisible">
            <el-form novalidate="novalidate" action="javascript:void(0)">
                <el-form-item class="el-form-item--menu-item el-form-item--has-content-right mb-1" :label="t('toolbar.drawBucketFill.antialias')">
                    <el-switch v-model="antialias" />
                </el-form-item>
            </el-form>
        </floating-dock>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

import { t } from '@/i18n';

import {
    strength, feather, antialias,
    colorPalette, colorPaletteIndex,
    colorPaletteDockVisible, colorPaletteDockTop, colorPaletteDockLeft,
    strengthDockVisible, strengthDockTop, strengthDockLeft,
    featherDockVisible, featherDockTop, featherDockLeft,
    settingsDockVisible, settingsDockTop, settingsDockLeft,
} from '@/canvas/store/draw-bucket-fill-state';

import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElHorizontalScrollbarArrows from '@/ui/el/el-horizontal-scrollbar-arrows.vue';
import ElInputNumber from '@/ui/el/el-input-number.vue';
import ElSlider from 'element-plus/lib/components/slider/index';
import ElSwitch from 'element-plus/lib/components/switch/index';

import OgButton from '@/ui/element/button.vue';
import OgPopover from '@/ui/element/popover.vue';
import FloatingDock from '@/ui/dock/floating-dock.vue';

import appEmitter from '@/lib/emitter';
import { colorToHsla } from '@/lib/color';

import type { RGBAColor } from '@/types';

defineOptions({
    name: 'ToolbarDrawBrush',
});

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

/*--------*\
| Strength |
\*--------*/

function formatStrengthTooltip() {
    const value = strength.value;
    const percentage = value / 1;
    return `${(100 * percentage).toFixed(0)}%`;
}

/*--------*\
| Feather |
\*--------*/

function formatFeatherTooltip() {
    const value = feather.value;
    const percentage = value / 1;
    return `${(100 * percentage).toFixed(0)}%`;
}

</script>
