<template>
    <div class="flex container items-center justify-center mx-auto">
        <div v-if="editingLayers.length > 0 && !showStopDrawer" class="og-toolbar-edit-confirm">
            {{ t('toolbar.drawGradient.editingGradient') }}
            <el-button plain size="small" class="ml-3!" @click="onDoneEditing()">
                <span class="bi bi-check-circle-fill mr-2" aria-hidden="true" /> {{ t('button.done') }}
            </el-button>
        </div>
        <div class="og-toolbar-overlay" :class="{ 'is-active': editingLayers.length > 0 }">
            <div class="og-toolbar-tool-selector">
                <span class="bi bi-shadows my-1" aria-hidden="true"></span>
                <span class="og-toolbar-tool-selector__description">
                    {{ t('toolbar.general.settings') }}
                </span>
            </div>
            <el-horizontal-scrollbar-arrows>
                <!-- Shape -->
                <el-input-group :prepend-tooltip="t('toolbar.drawShape.shapeType.label')">
                    <template #prepend>
                        <span class="bi" aria-hidden="true" :class="{
                            'bi-square': selectedShapeType === 'rectangle',
                            'bi-circle': selectedShapeType === 'ellipse',
                        }" />
                    </template>
                    <el-select :aria-label="t('toolbar.drawShape.shapeType.label')" v-model="selectedShapeType" size="small" style="width: 6rem">
                        <el-option :label="t('toolbar.drawShape.shapeType.rectangle')" value="rectangle">
                            <span class="bi bi-square mr-1" aria-hidden="true" /> {{ t('toolbar.drawShape.shapeType.rectangle') }}
                        </el-option>
                        <el-option :label="t('toolbar.drawShape.shapeType.ellipse')" value="ellipse">
                            <span class="bi bi-circle mr-1" aria-hidden="true" /> {{ t('toolbar.drawShape.shapeType.ellipse') }}
                        </el-option>
                    </el-select>
                </el-input-group>
                <!-- Style -->
                <div class="og-button-group ml-3!">
                    <og-button v-model:pressed="fillStyleDockVisible" outline solid small toggle
                        @click="fillStyleDockLeft = 0; fillStyleDockTop = 0;">
                        <i class="bi bi-palette-fill mr-1" aria-hidden="true" />
                        {{ t('toolbar.drawShape.fillStyle.label') }}
                        <div
                            style="background-image: url('../images/transparency-bg.png')"
                            class="rounded-sm ml-2"
                        >
                            <div
                                :style="{
                                    'background': fillColor?.style,
                                }"
                                class="w-4 h-4 rounded-sm"
                            />
                        </div>
                    </og-button>
                    <og-button v-model:pressed="strokeStyleDockVisible" outline solid small toggle
                        @click="strokeStyleDockLeft = 0; strokeStyleDockTop = 0;">
                        {{ t('toolbar.drawShape.strokeStyle.label') }}
                        <div
                            style="background-image: url('../images/transparency-bg.png')"
                            class="rounded-sm ml-2"
                        >
                            <div
                                :style="{
                                    'background': strokeColor?.style,
                                }"
                                class="w-4 h-4 rounded-sm"
                            />
                        </div>
                    </og-button>
                </div>
            </el-horizontal-scrollbar-arrows>
        </div>
        <!-- Fill Style Dock -->
        <floating-dock v-if="fillStyleDockVisible" v-model:top="fillStyleDockTop" v-model:left="fillStyleDockLeft" :visible="floatingDocksVisible">
            <label for="toolbar-draw-brush-size-slider" class="text-sm mr-4">
                {{ t('toolbar.drawShape.fillStyle.label') }}
            </label>
            <div class="flex flex-wrap gap-2 max-w-105">
                <og-button
                    v-for="(palette, colorIndex) of fillColorPaletteItems"
                    solid icon small toggle="active"
                    :pressed="colorIndex === fillColorPaletteIndex"
                    :aria-label="t('toolbar.drawBrush.brushColor')"
                    class="og-button--color-swatch"
                    :style="{
                        '--og-button-swatch-background': palette.color.style,
                        '--og-button-swatch-color': palette.isLight ? '#000000' : '#ffffff',
                    }"
                    @click="onClickFillColorPalette($event, colorIndex)"
                >
                    <i class="bi bi-palette-fill" aria-hidden="true" />
                </og-button>
                <og-button ref="fillShowColorPaletteSettingsButton" :aria-label="t('button.settings')" small slim @click="onEditFillPaletteSettings()">
                    <span class="bi bi-gear-fill" aria-hidden="true" />
                </og-button>
                <og-popover
                    v-model:visible="fillShowColorPaletteSettings"
                    placement="top" arrow :offset="16"
                    :reference="fillShowColorPaletteSettingsButton?.$el"
                >
                    <div class="og-popover__content">
                        <el-form action="javascript:void(0)" label-position="top">
                            <el-form-item :label="t('toolbar.drawBrush.paletteCount')" class="!m-0 !p-0 !max-w-30">
                                <el-input-number
                                    v-model.lazy="colorPaletteCount"
                                    size="small"
                                    :min="1" :max="19" :step="1"
                                    @keydown.enter="fillShowColorPaletteSettings = false"
                                />
                            </el-form-item>
                        </el-form>
                    </div>
                </og-popover>
            </div>
        </floating-dock>
        <!-- Stroke Style Dock -->
        <floating-dock v-if="strokeStyleDockVisible" v-model:top="strokeStyleDockTop" v-model:left="strokeStyleDockLeft" :visible="floatingDocksVisible">
            <label for="toolbar-draw-brush-size-slider" class="text-sm mr-4">
                {{ t('toolbar.drawShape.strokeStyle.label') }}
            </label>
            <div class="flex flex-wrap gap-2 max-w-105">
                <og-button
                    v-for="(palette, colorIndex) of strokeColorPaletteItems"
                    solid icon small toggle="active"
                    :pressed="colorIndex === strokeColorPaletteIndex"
                    :aria-label="t('toolbar.drawBrush.brushColor')"
                    class="og-button--color-swatch"
                    :style="{
                        '--og-button-swatch-background': palette.color.style,
                        '--og-button-swatch-color': palette.isLight ? '#000000' : '#ffffff',
                    }"
                    @click="onClickStrokeColorPalette($event, colorIndex)"
                >
                    <i class="bi bi-palette-fill" aria-hidden="true" />
                </og-button>
                <og-button ref="strokeShowColorPaletteSettingsButton" :aria-label="t('button.settings')" small slim @click="onEditStrokePaletteSettings()">
                    <span class="bi bi-gear-fill" aria-hidden="true" />
                </og-button>
                <og-popover
                    v-model:visible="strokeShowColorPaletteSettings"
                    placement="top" arrow :offset="16"
                    :reference="strokeShowColorPaletteSettingsButton?.$el"
                >
                    <div class="og-popover__content">
                        <el-form action="javascript:void(0)" label-position="top">
                            <el-form-item :label="t('toolbar.drawBrush.paletteCount')" class="!m-0 !p-0 !max-w-30">
                                <el-input-number
                                    v-model.lazy="colorPaletteCount"
                                    size="small"
                                    :min="1" :max="19" :step="1"
                                    @keydown.enter="strokeShowColorPaletteSettings = false"
                                />
                            </el-form-item>
                        </el-form>
                    </div>
                </og-popover>
            </div>
        </floating-dock>
    </div>
</template>

<script setup lang="ts">
import { v4 as uuidv4 } from 'uuid';
import { ref, computed, onMounted, onUnmounted, toRefs, watch } from 'vue';
import { useI18n } from '@/i18n';

import { BundleAction } from '@/actions/bundle';
import { UpdateLayerAction } from '@/actions/update-layer';

import {
    activeColorStops, blendColorSpace, editingLayers, fillType, showStopDrawer, spreadMethod,
} from '@/canvas/store/draw-gradient-state';

import {
    colorPalette,
    fillColorPaletteIndex, fillColor,
    strokeColorPaletteIndex, strokeColor,
    drawShapeToolbarEmitter, selectedShapeType,
    fillStyleDockVisible, fillStyleDockLeft, fillStyleDockTop,
    strokeStyleDockVisible, strokeStyleDockLeft, strokeStyleDockTop,
} from '@/canvas/store/draw-shape-state';

import { appliedSelectionMask, activeSelectionMask } from '@/canvas/store/selection-state';
import historyStore from '@/store/history';
import workingFileStore from '@/store/working-file';

import ElButton from 'element-plus/lib/components/button/index';
import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElHorizontalScrollbarArrows from '@/ui/el/el-horizontal-scrollbar-arrows.vue';
import ElInputGroup from '@/ui/el/el-input-group.vue';
import ElInputNumber from '@/ui/el/el-input-number.vue';
import ElSelect, { ElOption } from 'element-plus/lib/components/select/index';

import OgButton from '@/ui/element/button.vue';
import OgPopover from '@/ui/element/popover.vue';
import FloatingDock from '@/ui/dock/floating-dock.vue';

import appEmitter from '@/lib/emitter';
import { colorToHsla } from '@/lib/color';
import { UpdateGradientLayerOptions, RGBAColor } from '@/types';

defineOptions({
    name:'ToolbarDrawShape',
})

const emit = defineEmits(['close']);

const { selectedLayerIds } = toRefs(workingFileStore.state);

const { t } = useI18n();

const uuid = uuidv4();

const hasSelection = computed<boolean>(() => {
    return !(appliedSelectionMask.value == null && activeSelectionMask.value == null);
});

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

const colorPaletteCount = computed<number>({
    get() {
        return colorPalette.value.length;
    },
    set(count) {
        count = Math.round(count);
        if (isNaN(count)) return;
        if (fillColorPaletteIndex.value >= count) {
            fillColorPaletteIndex.value = 0;
        }
        if (strokeColorPaletteIndex.value >= count) {
            strokeColorPaletteIndex.value = 0;
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

/*----------*\
| Fill Color |
\*----------*/

const fillShowColorPaletteSettingsButton = ref<typeof OgButton>();
const fillShowColorPaletteSettings = ref<boolean>(false);

const fillColorPaletteItems = computed<ColorPaletteItem[]>(() => {
    return colorPalette.value.map((color) => {
        return {
            isLight: colorToHsla(color, 'rgba').l > 0.6,
            color,
        }
    });
});

watch(() => fillColor.value, (newFillColor) => {
    const currentPalette = colorPalette.value[fillColorPaletteIndex.value];
    if (currentPalette
        && currentPalette.r === newFillColor.r
        && currentPalette.g === newFillColor.g
        && currentPalette.b === newFillColor.b
        && currentPalette.alpha === newFillColor.alpha
    ) {
        return;
    }

    let palleteIndex = -1;
    for (let [index, color] of colorPalette.value.entries()) {
        if (
            color.r === newFillColor.r
            && color.g === newFillColor.g
            && color.b === newFillColor.b
            && color.alpha === newFillColor.alpha
        ) {
            palleteIndex = index;
            break;
        }
    }
    fillColorPaletteIndex.value = palleteIndex;
});

function onClickFillColorPalette(e: MouseEvent, index: number) {
    if (index === fillColorPaletteIndex.value) {
        e.preventDefault();
        appEmitter.emit('app.dialogs.openFromDock', {
            name: 'color-picker',
            props: {
                color: colorPalette.value[index],
            },
            onClose: (event?: any) => {
                if (event?.color) {
                    colorPalette.value[index] = event.color;
                    fillColor.value = colorPalette.value[index];
                    drawShapeToolbarEmitter.emit('fillColorChanged', fillColor.value);
                }
            }
        });
    } else {
        fillColorPaletteIndex.value = index;
        fillColor.value = colorPalette.value[index];
        drawShapeToolbarEmitter.emit('fillColorChanged', fillColor.value);
    }
}

function onEditFillPaletteSettings() {
    fillShowColorPaletteSettings.value = !fillShowColorPaletteSettings.value;
}

/*------------*\
| Stroke Color |
\*------------*/

const strokeShowColorPaletteSettingsButton = ref<typeof OgButton>();
const strokeShowColorPaletteSettings = ref<boolean>(false);

const strokeColorPaletteItems = computed<ColorPaletteItem[]>(() => {
    return colorPalette.value.map((color) => {
        return {
            isLight: colorToHsla(color, 'rgba').l > 0.6,
            color,
        }
    });
});

watch(() => strokeColor.value, (newStrokeColor) => {
    const currentPalette = colorPalette.value[strokeColorPaletteIndex.value];
    if (currentPalette
        && currentPalette.r === newStrokeColor.r
        && currentPalette.g === newStrokeColor.g
        && currentPalette.b === newStrokeColor.b
        && currentPalette.alpha === newStrokeColor.alpha
    ) {
        return;
    }

    let palleteIndex = -1;
    for (let [index, color] of colorPalette.value.entries()) {
        if (
            color.r === newStrokeColor.r
            && color.g === newStrokeColor.g
            && color.b === newStrokeColor.b
            && color.alpha === newStrokeColor.alpha
        ) {
            palleteIndex = index;
            break;
        }
    }
    strokeColorPaletteIndex.value = palleteIndex;
});

function onClickStrokeColorPalette(e: MouseEvent, index: number) {
    if (index === strokeColorPaletteIndex.value) {
        e.preventDefault();
        appEmitter.emit('app.dialogs.openFromDock', {
            name: 'color-picker',
            props: {
                color: colorPalette.value[index],
            },
            onClose: (event?: any) => {
                if (event?.color) {
                    colorPalette.value[index] = event.color;
                    strokeColor.value = colorPalette.value[index];
                    drawShapeToolbarEmitter.emit('strokeColorChanged', strokeColor.value);
                }
            }
        });
    } else {
        strokeColorPaletteIndex.value = index;
        strokeColor.value = colorPalette.value[index];
        drawShapeToolbarEmitter.emit('strokeColorChanged', strokeColor.value);
    }
}

function onEditStrokePaletteSettings() {
    strokeShowColorPaletteSettings.value = !strokeShowColorPaletteSettings.value;
}

/*-----------------------------------*\
| Editing Dropdowns / History Updates |
\*-----------------------------------*/

function onChangeFillType() {
    if (editingLayers.value.length === 0) return;
    const updateLayerActions: UpdateLayerAction<UpdateGradientLayerOptions>[] = [];
    for (const layer of editingLayers.value) {
        updateLayerActions.push(new UpdateLayerAction({
            id: layer.id,
            data: {
                ...JSON.parse(JSON.stringify(layer.data)),
                fillType: fillType.value,
            }
        }));
    }
    historyStore.dispatch('runAction', {
        action: new BundleAction('updateDrawGradientLayerFillType', 'action.updateDrawGradientLayerFillType', updateLayerActions),
    });
}

function onChangeBlendColorSpace() {
    if (editingLayers.value.length === 0) return;
    const updateLayerActions: UpdateLayerAction<UpdateGradientLayerOptions>[] = [];
    for (const layer of editingLayers.value) {
        updateLayerActions.push(new UpdateLayerAction({
            id: layer.id,
            data: {
                ...JSON.parse(JSON.stringify(layer.data)),
                blendColorSpace: blendColorSpace.value,
            }
        }));
    }
    historyStore.dispatch('runAction', {
        action: new BundleAction('updateDrawGradientLayerBlendColorSpace', 'action.updateDrawGradientLayerBlendColorSpace', updateLayerActions),
    });
}

function onChangeSpreadMethod() {
    if (editingLayers.value.length === 0) return;
    const updateLayerActions: UpdateLayerAction<UpdateGradientLayerOptions>[] = [];
    for (const layer of editingLayers.value) {
        updateLayerActions.push(new UpdateLayerAction({
            id: layer.id,
            data: {
                ...JSON.parse(JSON.stringify(layer.data)),
                spreadMethod: spreadMethod.value,
            }
        }));
    }
    historyStore.dispatch('runAction', {
        action: new BundleAction('updateDrawGradientLayerSpreadMethod', 'action.updateDrawGradientLayerSpreadMethod', updateLayerActions),
    });
}

function onChangeActiveColorStops() {
    if (editingLayers.value.length === 0) return;
    const updateLayerActions: UpdateLayerAction<UpdateGradientLayerOptions>[] = [];
    for (const layer of editingLayers.value) {
        updateLayerActions.push(new UpdateLayerAction({
            id: layer.id,
            data: {
                ...JSON.parse(JSON.stringify(layer.data)),
                stops: JSON.parse(JSON.stringify(activeColorStops.value)),
            }
        }));
    }
    historyStore.dispatch('runAction', {
        action: new BundleAction('updateDrawGradientLayerStops', 'action.updateDrawGradientLayerStops', updateLayerActions),
    });
}

/*-----------------------*\
| Finished Editing Button |
\*-----------------------*/

function onDoneEditing() {
    editingLayers.value = [];
}
</script>
