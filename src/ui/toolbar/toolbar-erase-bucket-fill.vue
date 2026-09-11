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
                <og-button v-model:pressed="opacityDockVisible" outline solid small toggle
                    class="ml-3!" @click="opacityDockLeft = 0; opacityDockTop = 0;">
                    <i class="bi bi-plus-circle mr-1" aria-hidden="true" />
                    {{ t('toolbar.eraseBucketFill.opacity') }}
                </og-button>
                <og-button v-model:pressed="strengthDockVisible" outline solid small toggle
                    class="ml-3!" @click="strengthDockLeft = 0; strengthDockTop = 0;">
                    <i class="bi bi-plus-circle mr-1" aria-hidden="true" />
                    {{ t('toolbar.eraseBucketFill.strength') }}
                </og-button>
                <og-button v-model:pressed="featherDockVisible" outline solid small toggle
                    class="ml-3!" @click="featherDockLeft = 0; featherDockTop = 0;">
                    <i class="bi bi-feather mr-1" aria-hidden="true" />
                    {{ t('toolbar.eraseBucketFill.feather') }}
                </og-button>
                <og-button v-model:pressed="settingsDockVisible" outline solid small toggle
                    class="ml-3!" @click="settingsDockLeft = 0; settingsDockTop = 0;">
                    <i class="bi bi-gear-fill mr-1" aria-hidden="true" />
                    {{ t('toolbar.eraseBucketFill.settings') }}
                </og-button>
            </el-horizontal-scrollbar-arrows>
        </div>
        <floating-dock v-if="opacityDockVisible" v-model:top="opacityDockTop" v-model:left="opacityDockLeft" :visible="opacityDockVisible">
            <label for="toolbar-draw-bucket-fill-opacity-slider" class="text-sm mr-4">
                {{ t('toolbar.eraseBucketFill.opacity') }}
            </label>
            <el-slider
                id="toolbar-draw-bucket-fill-opacity-slider"
                v-model="opacity"
                :min="0"
                :max="1"
                :step="0.01"
                :format-tooltip="formatOpacityTooltip"
                class="!w-35 !max-w-full"
            />
        </floating-dock>
        <floating-dock v-if="strengthDockVisible" v-model:top="strengthDockTop" v-model:left="strengthDockLeft" :visible="strengthDockVisible">
            <label for="toolbar-draw-bucket-fill-strength-slider" class="text-sm mr-4">
                {{ t('toolbar.eraseBucketFill.strength') }}
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
                {{ t('toolbar.eraseBucketFill.feather') }}
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
                <el-form-item class="el-form-item--menu-item el-form-item--has-content-right mb-1" :label="t('toolbar.eraseBucketFill.antialias')">
                    <el-switch v-model="antialias" />
                </el-form-item>
            </el-form>
        </floating-dock>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

import { t } from '@/i18n';

import {
    strength, feather, antialias, opacity,
    opacityDockVisible, opacityDockTop, opacityDockLeft,
    strengthDockVisible, strengthDockTop, strengthDockLeft,
    featherDockVisible, featherDockTop, featherDockLeft,
    settingsDockVisible, settingsDockTop, settingsDockLeft,
} from '@/canvas/store/erase-bucket-fill-state';

import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElHorizontalScrollbarArrows from '@/ui/el/el-horizontal-scrollbar-arrows.vue';
import ElSlider from 'element-plus/lib/components/slider/index';
import ElSwitch from 'element-plus/lib/components/switch/index';

import OgButton from '@/ui/element/button.vue';
import FloatingDock from '@/ui/dock/floating-dock.vue';

import appEmitter from '@/lib/emitter';

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

/*-------*\
| Opacity |
\*-------*/

function formatOpacityTooltip() {
    const value = opacity.value;
    const percentage = value / 1;
    return `${(100 * percentage).toFixed(0)}%`;
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
