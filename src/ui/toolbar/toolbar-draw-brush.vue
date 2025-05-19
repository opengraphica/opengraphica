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
                    :style="{ '--gradient': selectedBrushPreviewImage }"
                    aria-haspopup="dialog"
                    :aria-expanded="showBrushDrawer"
                    :aria-controls="showBrushDrawer ? ('toolbar-draw-brush-select-brush-drawer-' + uuid) : undefined"
                    @click="onClickBrushSelect()"
                    @keydown="onKeydownBrushSelect($event)"
                >
                </div>
                <og-button v-model:pressed="colorPaletteDockVisible" outline solid small toggle class="!ml-3"
                    @click="colorPaletteDockLeft = 0; colorPaletteDockTop = 0;">
                    <i class="bi bi-palette-fill mr-1" aria-hidden="true" />
                    {{ $t('toolbar.drawBrush.brushColor') }}
                </og-button>
                <og-button v-model:pressed="sizeDockVisible" outline solid small toggle class="!ml-3"
                    @click="sizeDockLeft = 0; sizeDockTop = 0;">
                    <i class="bi bi-plus-circle mr-1" aria-hidden="true" />
                    {{ $t('toolbar.drawBrush.brushSize') }}
                </og-button>
                <og-button v-model:pressed="smoothingDockVisible" outline solid small toggle class="!ml-3 !mr-3"
                    @click="smoothingDockLeft = 0; smoothingDockTop = 0;">
                    <i class="bi bi-disc mr-1" aria-hidden="true" />
                    {{ $t('toolbar.drawBrush.brushSmoothing') }}
                </og-button>
            </el-horizontal-scrollbar-arrows>
        </div>
        <floating-dock v-if="colorPaletteDockVisible" v-model:top="colorPaletteDockTop" v-model:left="colorPaletteDockLeft" :visible="floatingDocksVisible">
            <el-button
                round
                size="small"
                :aria-label="$t('toolbar.drawBrush.brushColor')"
                :style="{
                    backgroundColor: brushColor.style,
                    color: isBrushColorLight ? '#000000' : '#ffffff',
                    borderColor: isBrushColorLight ? undefined : 'transparent'
                }"
                @click="onPickColor()"
            >
                <i class="bi bi-palette-fill" aria-hidden="true" />
            </el-button>
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
import { defineComponent, ref, computed, onMounted, onUnmounted, toRefs, watch } from 'vue';

import {
    brushColor, brushSize, brushSmoothing, showBrushDrawer, selectedBrush,
    colorPaletteDockVisible, colorPaletteDockTop, colorPaletteDockLeft,
    sizeDockVisible, sizeDockTop, sizeDockLeft,
    smoothingDockVisible, smoothingDockTop, smoothingDockLeft,
} from '@/canvas/store/draw-brush-state';
import { appliedSelectionMask, activeSelectionMask } from '@/canvas/store/selection-state';

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

import OgButton from '@/ui/element/button.vue';
import FloatingDock from '@/ui/dock/floating-dock.vue';
import DockBrushEditor from '@/ui/dock/dock-brush-editor.vue';

import historyStore from '@/store/history';
import workingFileStore, { WorkingFileState } from '@/store/working-file';
import { ClearSelectionAction } from '@/actions/clear-selection';

import { convertUnits } from '@/lib/metrics';
import appEmitter from '@/lib/emitter';
import { colorToHsla } from '@/lib/color';

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

/*---------*\
| Selection |
\*---------*/

const { selectedLayerIds } = toRefs(workingFileStore.state);

const hasSelection = computed<boolean>(() => {
    return !(appliedSelectionMask.value == null && activeSelectionMask.value == null);
});

/*---------*\
| Selection |
\*---------*/

const selectedBrushPreviewImage = ref<string>('');

function onClickBrushSelect() {
    showBrushDrawer.value = !showBrushDrawer.value;
}

function onKeydownBrushSelect(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
        showBrushDrawer.value = !showBrushDrawer.value;
    }
}

/*------------*\
| Color Picker |
\*------------*/

const isBrushColorLight = ref<boolean>(true);

watch(() => brushColor.value, (color) => {
    isBrushColorLight.value = colorToHsla(color, 'rgba').l > 0.6;
}, { immediate: true });

function onPickColor() {
    appEmitter.emit('app.dialogs.openFromDock', {
        name: 'color-picker',
        props: {
            color: brushColor.value
        },
        onClose: (event?: any) => {
            if (event?.color) {
                brushColor.value = event.color;
            }
        }
    });
}

/*-------------*\
| Color Palette |
\*-------------*/


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
