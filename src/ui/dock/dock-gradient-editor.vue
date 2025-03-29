<template>
    <div class="og-dock-content og-toolbar-draw-gradient-stop-drawer">
        <div class="og-toolbar-draw-gradient-stop-drawer__editor-preview-section">
            <div ref="gradientEditorElement" class="og-gradient-editor">
                <div
                    class="og-gradient-editor__preview"
                    :style="{ '--gradient': editingGradientBackground }"
                    @mouseenter="onMouseEnterGradientEditorPreview"
                    @mouseleave="onMouseLeaveGradientEditorPreview"
                    v-pointer.move="onPointerMoveGradientEditorPreview"
                    v-pointer.down="onPointerDownGradientEditorPreview"
                >
                    <div
                        v-if="showStopAddCursor"
                        class="og-gradient-editor__add-position"
                        :style="{
                            left: (addCursorOffset * 100) + '%',
                        }"
                    />
                </div>
                <div
                    v-for="(colorStop, colorStopIndex) in editingColorStops"
                    :key="colorStopIndex"
                    role="button"
                    tabindex="0"
                    class="og-gradient-editor__stop-marker"
                    :class="{
                        'is-active': activeColorStopIndex === colorStopIndex,
                    }"
                    :style="{
                        'left': (colorStop.offset * 100) + '%',
                        '--stop-color': colorStop.color.style,
                    }"
                    :aria-label="colorStop.offset + ' ' + colorStop.color.style"
                    :data-color-stop-index="colorStopIndex"
                    @keydown="onKeydownStopMarker($event, colorStopIndex)"
                    @dblclick="onDoubleClickStopMarker($event, colorStopIndex)"
                    v-pointer.down="onPointerDownStopMarker"
                    v-pointer.move.window="draggingColorStopIndex > -1 ? onPointerMoveStopMarker : undefined"
                    v-pointer.up.window="draggingColorStopIndex > -1 ? onPointerUpStopMarker : undefined"
                >
                    <div class="og-gradient-editor__stop-marker__color" :data-color-stop-index="colorStopIndex" />
                </div>
                <div
                    v-if="showStopAddCursor"
                    class="og-gradient-editor__stop-marker"
                    :style="{
                        'left': (addCursorOffset * 100) + '%',
                        '--stop-color': addCursorColor.style,
                    }"
                    aria-hidden="true"
                >
                    <div class="og-gradient-editor__stop-marker__color">
                        <span class="bi bi-plus" />
                    </div>
                </div>
            </div>
        </div>
        <div
            v-if="activeColorStopIndex > -1 && activeColorStopIndex < editingColorStops.length"
            class="og-toolbar-draw-gradient-stop-drawer__editor-stop-form"
        >
            <div class="og-toolbar-draw-gradient-stop-drawer__editor-stop-form__selection-indicator-container">
                <div
                    class="og-toolbar-draw-gradient-stop-drawer__editor-stop-form__selection-indicator"
                    :style="{ left: (editingColorStops[activeColorStopIndex].offset * 100) + '%' }"
                />
            </div>
            <el-horizontal-scrollbar-arrows>
                <el-input-group>
                    <template #prepend>
                        <span class="is-size-7">{{ t('toolbar.drawGradient.stopDialog.stopColor') }}</span>
                    </template>
                    <el-input-color
                        ref="stopColorPicker"
                        v-model="editingColorStops[activeColorStopIndex].color"
                        :aria-label="t('toolbar.drawGradient.stopDialog.stopColor')"
                        @change="onChangeEditingStopColor()"
                    ></el-input-color>
                </el-input-group>
                <el-input-group  class="ml-3">
                    <template #prepend>
                        <span class="is-size-7">{{ t('toolbar.drawGradient.stopDialog.stopOffset') }}</span>
                    </template>
                    <el-input-number
                        :model-value="Math.floor(editingColorStops[activeColorStopIndex].offset * 100)"
                        size="small"
                        :min="0"
                        :max="100"
                        suffix-text="%"
                        style="width: 3.5rem"
                        :aria-label="t('toolbar.drawGradient.stopDialog.stopOffset')"
                        @update:model-value="editingColorStops[activeColorStopIndex].offset = $event / 100"
                        @change="onChangeEditingStopOffset()"
                    ></el-input-number>
                </el-input-group>
                <el-button-group class="is-flex ml-3">
                    <el-button plain size="small" @click="onDeleteEditingStop()">
                        <span class="bi bi-trash mr-2" aria-hidden="true" /> {{ t('button.delete') }}
                    </el-button>
                    <el-button plain size="small" @click="onReverseStops()">
                        <span class="bi bi-shuffle mr-2" aria-hidden="true" /> {{ t('button.reverse') }}
                    </el-button>
                    <el-button plain size="small" @click="onSaveActivePreset()">
                        <span class="bi bi-plus-circle-fill mr-2" aria-hidden="true" /> {{ t('button.save') }}
                    </el-button>
                </el-button-group>
            </el-horizontal-scrollbar-arrows>
        </div>
        <div class="og-toolbar-draw-gradient-stop-drawer__presets">
            <h3 class="is-size-6">{{ t('toolbar.drawGradient.stopDialog.presets') }}</h3>
            <el-scrollbar>
                <div v-for="(preset, presetIndex) of gradientPresets" :key="presetIndex" class="og-gradient-preset">
                    <button class="og-gradient-preset__activate" @click="onSelectPreset(presetIndex)">
                        <div class="og-gradient-preset__name">{{ preset.name }}</div>
                        <div class="og-gradient_preset__color-stops" :style="{ '--gradient': preset.gradientBackground }" />
                    </button>
                    <el-popover
                        v-model:visible="presetSettingsVisibility[presetIndex]"
                        trigger="click"
                        popper-class="p-0"
                    >
                        <template #reference>
                            <el-button type="primary" link :aria-label="t('toolbar.drawGradient.stopDialog.presetSettings')">
                                <span class="bi bi-three-dots-vertical" aria-hidden="true" />
                            </el-button>
                        </template>
                        <el-menu
                            class="el-menu--medium el-menu--borderless my-1"
                            :default-active="presetSettingsActiveIndex"
                            @select="onPresetSettingsSelect(preset, presetIndex, $event)"
                        >
                            <el-menu-item index="delete">
                                <i class="bi bi-trash"></i>
                                <span>{{ t('app.layerList.delete') }}</span>
                            </el-menu-item>
                        </el-menu>
                    </el-popover>
                </div>
            </el-scrollbar>
        </div>
        <template v-if="isDialog">
            <el-divider class="mt-0" />
            <div class="mt-4 pb-5 has-text-right">
                <el-button @click="onCancel">{{ $t('button.cancel') }}</el-button>
                <el-button @click="onConfirmSelection">{{ $t('button.ok') }}</el-button>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch, type PropType } from 'vue';
import { useI18n } from '@/i18n';

import vPointer from '@/directives/pointer';

import { generateCssGradient, sampleGradient } from '@/lib/gradient';

import {
    blendColorSpace, presets, type GradientPreset,
} from '@/canvas/store/draw-gradient-state';

import ElButton, { ElButtonGroup } from 'element-plus/lib/components/button/index';
import ElDivider from 'element-plus/lib/components/divider/index';
import ElHorizontalScrollbarArrows from '@/ui/el/el-horizontal-scrollbar-arrows.vue';
import ElInputColor from '@/ui/el/el-input-color.vue';
import ElInputGroup from '@/ui/el/el-input-group.vue';
import ElInputNumber from '@/ui/el/el-input-number.vue';
import ElMenu, { ElMenuItem } from 'element-plus/lib/components/menu/index';
import ElPopover from '@/ui/el/el-popover.vue';
import ElScrollbar from 'element-plus/lib/components/scrollbar/index';

import type { RGBAColor, WorkingFileGradientColorSpace, WorkingFileGradientColorStop } from '@/types';

const props = defineProps({
    gradient: {
        type: Array as PropType<Array<WorkingFileGradientColorStop<RGBAColor>>>,
        required: true,
    },
    blendColorSpace: {
        type: String as PropType<WorkingFileGradientColorSpace>,
        required: true,
    },
    isDialog: {
        type: Boolean,
        default: false,
    },
});

const emit = defineEmits([
    'close',
    'stops-edited',
    'update:title',
    'update:dialogSize',
    'update:gradient',
]);
emit('update:title', 'toolbar.drawGradient.stopDialog.title');
emit('update:dialogSize', 'medium-large');

const { t } = useI18n();

const gradientEditorElement = ref<HTMLDivElement>();
const stopColorPicker = ref<typeof ElInputColor>();

/*-----*\
| Model |
\*-----*/

const editingColorStops = ref<Array<WorkingFileGradientColorStop<RGBAColor>>>([]);
const hasEditedActiveColorStops = ref(false);
const activeColorStopIndex = ref(-1);

watch(() => props.gradient, (gradient) => {
    editingColorStops.value = gradient;

    activeColorStopIndex.value = Math.min(editingColorStops.value.length - 1, Math.max(0, activeColorStopIndex.value));
}, { immediate: true });

watch(() => hasEditedActiveColorStops.value, (hasEditedActiveColorStops, oldHasEditedActiveColorStops) => {
    if (hasEditedActiveColorStops && !oldHasEditedActiveColorStops) {
        emit('stops-edited');
    }
});

/*------------------*\
| Gradient Rendering |
\*------------------*/

const editingGradientBackground = computed<string>(() => {
    return generateCssGradient(editingColorStops.value, props.blendColorSpace);
});

/*------------*\
| Add New Stop |
\*------------*/

const justAddedCursor = ref(false);
const showStopAddCursor = ref(false);
const addCursorOffset = ref(0);
const addCursorColor = ref<RGBAColor>({
    is: 'color',
    r: 0, g: 0, b: 0, alpha: 1,
    style: '#000000',
});

function onMouseEnterGradientEditorPreview() {
    if (!justAddedCursor.value) {
        showStopAddCursor.value = true;
    }
}

function onMouseLeaveGradientEditorPreview() {
    justAddedCursor.value = false;
    showStopAddCursor.value = false;
}

function onPointerMoveGradientEditorPreview(event: PointerEvent) {
    const gradientEditorClientRect = gradientEditorElement.value?.getBoundingClientRect();
    if (!gradientEditorClientRect) return;
    addCursorOffset.value = (event.clientX - gradientEditorClientRect.x) / gradientEditorClientRect.width;
    addCursorColor.value = sampleGradient(editingColorStops.value, props.blendColorSpace, addCursorOffset.value);
}

function onPointerDownGradientEditorPreview(event: PointerEvent) {
    if (justAddedCursor.value) return;

    const gradientEditorClientRect = gradientEditorElement.value?.getBoundingClientRect();
    if (!gradientEditorClientRect) return;
    editingColorStops.value.push({
        offset: Math.min(1, Math.max(0, (event.clientX - gradientEditorClientRect.x) / gradientEditorClientRect.width)),
        color: sampleGradient(editingColorStops.value, props.blendColorSpace, addCursorOffset.value),
    });
    hasEditedActiveColorStops.value = true;
    justAddedCursor.value = true;
    showStopAddCursor.value = false;
    nextTick(() => {
        activeColorStopIndex.value = editingColorStops.value.length - 1;
        emit('update:gradient', editingColorStops.value);
    });
}

/*---------------------*\
| Drag/move Stop Handle |
\*---------------------*/

const draggingColorStopIndex = ref(-1);
const draggingColorStopStartOffset = ref(0);
const draggingColorStopStartX = ref(0);
const draggingColorStopMaxWidth = ref(1);

function onKeydownStopMarker(event: KeyboardEvent, colorMarkerIndex: number) {
    switch (event.key) {
        case 'Enter': case ' ':
            activeColorStopIndex.value = colorMarkerIndex;
            break;
        case 'ArrowLeft': case 'ArrowRight': case 'ArrowUp': case 'ArrowDown': case 'PageUp': case 'PageDown':
            const stopIndex = parseInt((event?.target as HTMLElement)?.getAttribute('data-color-stop-index') ?? '-1');
            if (stopIndex < 0) return;
            const slideSpeed = event.key === 'PageUp' || event.key === 'PageDown' ? 0.05 : 0.01;
            if (event.key === 'ArrowLeft' || event.key === 'ArrowDown' || event.key === 'PageDown') {
                editingColorStops.value[stopIndex].offset = Math.max(0, editingColorStops.value[stopIndex].offset - slideSpeed);
            } else {
                editingColorStops.value[stopIndex].offset = Math.min(1, editingColorStops.value[stopIndex].offset + slideSpeed);
            }
            hasEditedActiveColorStops.value = true;
            emit('update:gradient', editingColorStops.value);
            break;
    }
}

function onDoubleClickStopMarker(event: MouseEvent, colorMarkerIndex: number) {
    activeColorStopIndex.value = colorMarkerIndex;
    stopColorPicker.value?.$el.click();
}

function onPointerDownStopMarker(event: PointerEvent) {
    if (!event.target || !gradientEditorElement.value) return;
    const colorStopIndex = (event.target as Element).getAttribute('data-color-stop-index');
    if (colorStopIndex == null) return;

    draggingColorStopIndex.value = parseInt(colorStopIndex);
    activeColorStopIndex.value = draggingColorStopIndex.value;
    draggingColorStopStartOffset.value = editingColorStops.value[draggingColorStopIndex.value].offset;
    draggingColorStopStartX.value = event.pageX;
    const gradientEditorClientRect = gradientEditorElement.value?.getBoundingClientRect();
    draggingColorStopMaxWidth.value = gradientEditorClientRect?.width ?? 1;
}
function onPointerMoveStopMarker(event: PointerEvent) {
    if (draggingColorStopIndex.value < 0) return;

    editingColorStops.value[draggingColorStopIndex.value].offset = Math.max(0, Math.min(1,
        draggingColorStopStartOffset.value +
        (event.pageX - draggingColorStopStartX.value) / draggingColorStopMaxWidth.value
    ));
    hasEditedActiveColorStops.value = true;
    emit('update:gradient', editingColorStops.value);
}
function onPointerUpStopMarker() {
    draggingColorStopIndex.value = -1;
}

/*---------------------*\
| Gradient Stop Editing |
\*---------------------*/

function onChangeEditingStopColor() {
    hasEditedActiveColorStops.value = true;
    emit('update:gradient', editingColorStops.value);
}

function onChangeEditingStopOffset() {
    hasEditedActiveColorStops.value = true;
    emit('update:gradient', editingColorStops.value);
}

function onDeleteEditingStop() {
    if (activeColorStopIndex.value < 0) return;
    editingColorStops.value.splice(activeColorStopIndex.value, 1);
    activeColorStopIndex.value = editingColorStops.value.length - 1;
    hasEditedActiveColorStops.value = true;
    emit('update:gradient', editingColorStops.value);
}

function onReverseStops() {
    for (const stop of editingColorStops.value) {
        stop.offset = 1.0 - stop.offset;
    }
    hasEditedActiveColorStops.value = true;
    emit('update:gradient', editingColorStops.value);
}

/*----------------*\
| Gradient Presets |
\*----------------*/

interface GradientPresetDisplay extends GradientPreset {
    gradientBackground: string;
}

const gradientPresets = ref<GradientPresetDisplay[]>([]);

const presetSettingsVisibility = ref<boolean[]>([]);
const presetSettingsActiveIndex = ref('');

watch([presets, blendColorSpace], () => {
    gradientPresets.value = presets.value.map((preset) => ({
        name: preset.name,
        stops: preset.stops,
        gradientBackground: generateCssGradient(preset.stops, blendColorSpace.value),
    }));
}, { immediate: true, deep: true });

async function onPresetSettingsSelect(preset: GradientPreset, presetIndex: number, action: string) {
    if (action === 'delete') {
        presets.value.splice(presetIndex, 1);
    }
    presetSettingsActiveIndex.value = ' ';
    await nextTick();
    presetSettingsActiveIndex.value = '';
    presetSettingsVisibility.value[presetIndex] = false;
}

function onSelectPreset(presetIndex: number) {
    editingColorStops.value = JSON.parse(JSON.stringify(gradientPresets.value[presetIndex].stops));
    activeColorStopIndex.value = 0;
    hasEditedActiveColorStops.value = true;
    emit('update:gradient', editingColorStops.value);
}

async function onSaveActivePreset() {
    const colorNamer = (await import('color-namer')).default;
    const colorNames = new Set<string>();
    for (const stop of editingColorStops.value) {
        const colorName = (colorNamer(stop.color.style, { pick: ['ntc'] }).ntc[0]?.name ?? '');
        colorNames.add(
            colorName.slice(0, 1).toUpperCase() + colorName.slice(1)
        );
        if (stop.color.alpha < 0.1) colorNames.add('Transparent');
    }
    presets.value.unshift({
        name: Array.from(colorNames).join(', '),
        stops: JSON.parse(JSON.stringify(editingColorStops.value)),
    })
}

/*---------------*\
| Dialog Controls |
\*---------------*/

function onCancel() {
    emit('close');
}

function onConfirmSelection() {
    emit('close', { gradient: JSON.parse(JSON.stringify(editingColorStops.value)) });
}

</script>