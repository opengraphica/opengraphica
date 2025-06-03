<template>
    <template v-if="!isDialog">
        <h2 class="og-toolbar-drawer__title" v-t="'toolbar.drawBrush.brushDialog.title'" />
        <div class="og-toolbar-drawer__close">
            <el-button
                v-if="view === 'edit'"
                plain
                @click="onBack()"
            >
                <span class="bi bi-chevron-left mr-2" aria-hidden="true" /> <span>{{ t('button.back') }}</span>
            </el-button>
            <el-button
                plain
                @click="onDone()"
            >
                <span class="bi bi-check-circle-fill mr-2" aria-hidden="true" /> <span>{{ t('button.done') }}</span>
            </el-button>
        </div>
    </template>
    <div class="og-dock-content og-toolbar-draw-brush-select-brush-drawer">
        <div ref="brushSelectorView" v-if="view === 'select'" class="og-brush-selector">
            <nav class="og-brush-selector__categories">
                <el-scrollbar>
                    <button
                        v-for="brushCategory of brushesByCategory"
                        class="og-brush_selector__category-link"
                        :class="{
                            'og-brush_selector__category-link--active': brushCategory.id === selectedBrushCategoryId
                        }"
                        @click="selectedBrushCategoryId = brushCategory.id"
                    >
                        <span :class="brushCategory.icon" aria-hidden="true" />
                        {{ t('defaultBrushCategory.' + brushCategory.id) }}
                    </button>
                </el-scrollbar>
            </nav>
            <div class="og-brush-selector__brushes">
                <el-scrollbar>
                    <template v-if="selectedBrushCategory && selectedBrushCategory.brushes.length > 0">
                        <div v-for="(brush, brushIndex) of selectedBrushCategory.brushes" class="og-brush-selector__brush">
                            <button
                                class="og-brush-selector__brush-preview"
                                :class="{
                                    'og-brush-selector__brush-preview--active': selectedBrush?.id === brush.id
                                }"
                                @click="onClickActivateBrush(brush.id)"
                            >
                                <span class="og-brush-selector__brush-preview-name">
                                    {{ brush.name ?? t('defaultBrush.' + brush.id) }}
                                </span>
                                <og-canvas-container
                                    v-if="selectedBrushCategory.brushPreviews[brushIndex]"
                                    :canvas="selectedBrushCategory.brushPreviews[brushIndex]"
                                    class="og-brush-selector__brush-preview-image"
                                />
                            </button>
                            <el-button link type="primary" class="!px-2 !my-1" :aria-label="t('button.editBrush')" @click="onClickEditBrush(brush.id)">
                                <span class="bi bi-pencil-square" aria-hidden="true" />
                            </el-button>
                        </div>
                    </template>
                    <template v-else-if="selectedBrushCategory">
                        <el-alert
                            :title="t('toolbar.drawBrush.brushDialog.noBrushesInCategory.title')"
                            type="warning"
                            show-icon
                            :closable="false">
                            {{ t('toolbar.drawBrush.brushDialog.noBrushesInCategory.message') }}
                        </el-alert>
                    </template>
                    <template v-else>
                        <el-alert
                            :title="t('toolbar.drawBrush.brushDialog.noBrushCategorySelected.title')"
                            type="warning"
                            show-icon
                            :closable="false">
                            {{ t('toolbar.drawBrush.brushDialog.noBrushCategorySelected.message') }}
                        </el-alert>
                    </template>
                </el-scrollbar>
            </div>
        </div>
        <div v-else-if="view === 'edit'" class="og-brush-editor">
            <el-tabs v-model="brushEditorTab" tab-position="left">
                <el-tab-pane name="shape" :label="t('toolbar.drawBrush.brushDialog.editorTab.shape.title')">
                    <el-scrollbar>
                        <h3>{{ t('toolbar.drawBrush.brushDialog.editorTab.shape.title') }}</h3>
                        <el-form novalidate="novalidate" action="javascript:void(0)" label-position="top">
                            <el-form-item>
                                <template #label>
                                    {{ t('toolbar.drawBrush.brushDialog.editorTab.shape.hardness') }}
                                    <og-more-info-icon :message="t('toolbar.drawBrush.brushDialog.editorTab.shape.hardnessDescription')" />
                                </template>
                                <div class="flex gap-2 w-full items-center">
                                    <div class="px-3 grow-1">
                                        <el-slider
                                            v-model="editingBrush.hardness"
                                            :aria-label="t('measurement.percentage')"
                                            :min="0" :max="100" :step="1" :show-tooltip="false"
                                        />
                                    </div>
                                    <div class="grow-0">
                                        <el-input-number
                                            v-model="editingBrush.hardness"
                                            :aria-label="t('measurement.percentage')"
                                            suffix-text="%"
                                            style="width: 5rem"
                                        />
                                    </div>
                                </div>
                            </el-form-item>
                            <el-form-item>
                                <template #label>
                                    {{ t('toolbar.drawBrush.brushDialog.editorTab.shape.angle') }}
                                    <og-more-info-icon :message="t('toolbar.drawBrush.brushDialog.editorTab.shape.angleDescription')" />
                                </template>
                                <div class="flex gap-2 w-full items-center">
                                    <div class="px-3 grow-1">
                                        <el-slider
                                            v-model="editingBrush.angle"
                                            :aria-label="t('measurement.percentage')"
                                            :min="0" :max="360" :step="1" :show-tooltip="false"
                                        />
                                    </div>
                                    <div class="grow-0">
                                        <el-input-number
                                            v-model="editingBrush.angle"
                                            :aria-label="t('measurement.percentage')"
                                            suffix-text="°"
                                            style="width: 5rem"
                                        />
                                    </div>
                                </div>
                            </el-form-item>
                        </el-form>
                    </el-scrollbar>
                </el-tab-pane>
                <el-tab-pane name="strokePath" :label="t('toolbar.drawBrush.brushDialog.editorTab.strokePath.title')">
                    <el-scrollbar>
                        <h3>{{ t('toolbar.drawBrush.brushDialog.editorTab.strokePath.title') }}</h3>
                        <el-form novalidate="novalidate" action="javascript:void(0)" label-position="top">
                            <el-form-item>
                                <template #label>
                                    {{ t('toolbar.drawBrush.brushDialog.editorTab.strokePath.spacing') }}
                                    <og-more-info-icon :message="t('toolbar.drawBrush.brushDialog.editorTab.strokePath.spacingDescription')" />
                                </template>
                                <div class="flex gap-2 w-full items-center">
                                    <div class="px-3 grow-1">
                                        <el-slider
                                            v-model="editingBrush.spacing"
                                            :aria-label="t('measurement.percentage')"
                                            :min="0" :max="100" :step="1" :show-tooltip="false"
                                        />
                                    </div>
                                    <div class="grow-0">
                                        <el-input-number
                                            v-model="editingBrush.spacing"
                                            :aria-label="t('measurement.percentage')"
                                            suffix-text="%"
                                            style="width: 5rem"
                                        />
                                    </div>
                                </div>
                            </el-form-item>
                            <el-form-item>
                                <template #label>
                                    {{ t('toolbar.drawBrush.brushDialog.editorTab.strokePath.jitter') }}
                                    <og-more-info-icon :message="t('toolbar.drawBrush.brushDialog.editorTab.strokePath.jitterDescription')" />
                                </template>
                                <div class="flex gap-2 w-full items-center">
                                    <div class="px-3 grow-1">
                                        <el-slider
                                            v-model="editingBrush.jitter"
                                            :aria-label="t('measurement.percentage')"
                                            :min="0" :max="1000" :step="1" :show-tooltip="false"
                                        />
                                    </div>
                                    <div class="grow-0">
                                        <el-input-number
                                            v-model="editingBrush.jitter"
                                            :aria-label="t('measurement.percentage')"
                                            suffix-text="%"
                                            style="width: 5rem"
                                        />
                                    </div>
                                </div>
                            </el-form-item>
                        </el-form>
                    </el-scrollbar>
                </el-tab-pane>
                <el-tab-pane name="pressure" :label="t('toolbar.drawBrush.brushDialog.editorTab.pressure.title')">
                    <el-scrollbar>
                        <h3>{{ t('toolbar.drawBrush.brushDialog.editorTab.pressure.title') }}</h3>
                        <el-form novalidate="novalidate" action="javascript:void(0)" label-position="top">
                            <el-form-item>
                                <template #label>
                                    {{ t('toolbar.drawBrush.brushDialog.editorTab.pressure.pressureTaper') }}
                                    <og-more-info-icon :message="t('toolbar.drawBrush.brushDialog.editorTab.pressure.pressureTaperDescription')" />
                                </template>
                                <div class="flex gap-2 w-full items-center">
                                    <div class="px-3 grow-1">
                                        <el-slider
                                            v-model="editingBrush.pressureTaper"
                                            :aria-label="t('measurement.percentage')"
                                            :min="0" :max="400" :step="1" :show-tooltip="false"
                                        />
                                    </div>
                                    <div class="flex grow-0 gap-2">
                                        <el-input-number
                                            v-model="editingBrush.pressureTaper"
                                            :aria-label="t('measurement.percentage')"
                                            suffix-text="%"
                                            style="width: 5rem"
                                        />
                                    </div>
                                </div>
                            </el-form-item>
                            <el-form-item>
                                <template #label>
                                    {{ t('toolbar.drawBrush.brushDialog.editorTab.pressure.pressureMinSize') }}
                                    <og-more-info-icon :message="t('toolbar.drawBrush.brushDialog.editorTab.pressure.pressureMinSizeDescription')" />
                                </template>
                                <div class="flex gap-2 w-full items-center">
                                    <div class="px-3 grow-1">
                                        <el-slider
                                            v-model="editingBrush.pressureMinSize"
                                            :aria-label="t('measurement.percentage')"
                                            :min="0" :max="100" :step="1" :show-tooltip="false"
                                        />
                                    </div>
                                    <div class="grow-0">
                                        <el-input-number
                                            v-model="editingBrush.pressureMinSize"
                                            :aria-label="t('measurement.percentage')"
                                            suffix-text="%"
                                            style="width: 5rem"
                                        />
                                    </div>
                                </div>
                            </el-form-item>
                        </el-form>
                    </el-scrollbar>
                </el-tab-pane>
                <el-tab-pane name="blending" :label="t('toolbar.drawBrush.brushDialog.editorTab.blending.title')">
                    <el-scrollbar>
                        <h3>{{ t('toolbar.drawBrush.brushDialog.editorTab.blending.title') }}</h3>
                        <el-form novalidate="novalidate" action="javascript:void(0)" label-position="top">
                            <el-form-item>
                                <template #label>
                                    {{ t('toolbar.drawBrush.brushDialog.editorTab.blending.density') }}
                                    <og-more-info-icon :message="t('toolbar.drawBrush.brushDialog.editorTab.blending.densityDescription')" />
                                </template>
                                <div class="flex gap-2 w-full items-center">
                                    <div class="px-3 grow-1">
                                        <el-slider
                                            v-model="editingBrush.pressureDensityRange"
                                            range
                                            :aria-label="t('measurement.percentage')"
                                            :min="0" :max="100" :step="1" :show-tooltip="false"
                                        />
                                    </div>
                                    <div class="flex grow-0 gap-2">
                                        <el-input-number
                                            v-model="editingBrush.pressureDensityRange[0]"
                                            :aria-label="t('toolbar.drawBrush.brushDialog.editorTab.blending.pressureMinDensity')"
                                            suffix-text="%"
                                            style="width: 4rem"
                                        />
                                        <el-input-number
                                            v-model="editingBrush.pressureDensityRange[1]"
                                            :aria-label="t('toolbar.drawBrush.brushDialog.editorTab.blending.pressureMaxDensity')"
                                            suffix-text="%"
                                            style="width: 4rem"
                                        />
                                    </div>
                                </div>
                            </el-form-item>
                            <el-form-item>
                                <template #label>
                                    {{ t('toolbar.drawBrush.brushDialog.editorTab.blending.colorBlendingStrength') }}
                                    <og-more-info-icon :message="t('toolbar.drawBrush.brushDialog.editorTab.blending.colorBlendingStrengthDescription')" />
                                </template>
                                <div class="flex gap-2 w-full items-center">
                                    <div class="px-3 grow-1">
                                        <el-slider
                                            v-model="editingBrush.colorBlendingStrengthRange"
                                            range
                                            :aria-label="t('measurement.percentage')"
                                            :min="0" :max="100" :step="1" :show-tooltip="false"
                                        />
                                    </div>
                                    <div class="flex grow-0 gap-2">
                                        <el-input-number
                                            v-model="editingBrush.colorBlendingStrengthRange[0]"
                                            :aria-label="t('toolbar.drawBrush.brushDialog.editorTab.blending.pressureMinColorBlendingStrength')"
                                            suffix-text="%"
                                            style="width: 4rem"
                                        />
                                        <el-input-number
                                            v-model="editingBrush.colorBlendingStrengthRange[1]"
                                            :aria-label="t('toolbar.drawBrush.brushDialog.editorTab.blending.pressureMaxColorBlendingStrength')"
                                            suffix-text="%"
                                            style="width: 4rem"
                                        />
                                    </div>
                                </div>
                            </el-form-item>
                            <el-form-item>
                                <template #label>
                                    {{ t('toolbar.drawBrush.brushDialog.editorTab.blending.colorBlendingPersistence') }}
                                    <og-more-info-icon :message="t('toolbar.drawBrush.brushDialog.editorTab.blending.colorBlendingPersistenceDescription')" />
                                </template>
                                <div class="flex gap-2 w-full items-center">
                                    <div class="px-3 grow-1">
                                        <el-slider
                                            v-model="editingBrush.colorBlendingPersistence"
                                            :aria-label="t('measurement.percentage')"
                                            :min="0" :max="100" :step="1" :show-tooltip="false"
                                        />
                                    </div>
                                    <div class="grow-0">
                                        <el-input-number
                                            v-model="editingBrush.colorBlendingPersistence"
                                            :aria-label="t('measurement.percentage')"
                                            suffix-text="%"
                                            style="width: 5rem"
                                        />
                                    </div>
                                </div>
                            </el-form-item>
                            <!--el-form-item>
                                <template #label>
                                    {{ t('toolbar.drawBrush.brushDialog.editorTab.blending.concentration') }}
                                    <og-more-info-icon :message="t('toolbar.drawBrush.brushDialog.editorTab.blending.concentrationDescription')" />
                                </template>
                                <div class="flex gap-2 w-full items-center">
                                    <div class="px-3 grow-1">
                                        <el-slider
                                            v-model="editingBrush.concentrationRange"
                                            range
                                            :aria-label="t('measurement.percentage')"
                                            :min="0" :max="100" :step="1" :show-tooltip="false"
                                        />
                                    </div>
                                    <div class="flex grow-0 gap-2">
                                        <el-input-number
                                            v-model="editingBrush.concentrationRange[0]"
                                            :aria-label="t('toolbar.drawBrush.brushDialog.editorTab.blending.pressureMinConcentration')"
                                            suffix-text="%"
                                            style="width: 4rem"
                                        />
                                        <el-input-number
                                            v-model="editingBrush.concentrationRange[1]"
                                            :aria-label="t('toolbar.drawBrush.brushDialog.editorTab.blending.pressureMaxConcentration')"
                                            suffix-text="%"
                                            style="width: 4rem"
                                        />
                                    </div>
                                </div>
                            </el-form-item-->
                        </el-form>
                    </el-scrollbar>
                </el-tab-pane>
            </el-tabs>
        </div>
        <template v-if="isDialog">
            <el-divider class="mt-0" />
            <div class="mt-4 pb-5 text-right">
                <el-button @click="onCancel">{{ t('button.cancel') }}</el-button>
                <el-button @click="onConfirmSelection">{{ t('button.ok') }}</el-button>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch, type PropType } from 'vue';
import { useI18n } from '@/i18n';

import vPointer from '@/directives/pointer';

import { generateCssGradient, sampleGradient } from '@/lib/gradient';

import {
    brushEditorTab, brushesByCategory, getBrushById, addCustomBrush, generateBrushPreview
} from '@/canvas/store/brush-library-state';

import ElAlert from 'element-plus/lib/components/alert/index';
import ElButton, { ElButtonGroup } from 'element-plus/lib/components/button/index';
import ElDivider from 'element-plus/lib/components/divider/index';
import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElHorizontalScrollbarArrows from '@/ui/el/el-horizontal-scrollbar-arrows.vue';
import ElInputColor from '@/ui/el/el-input-color.vue';
import ElInputGroup from '@/ui/el/el-input-group.vue';
import ElInputNumber from '@/ui/el/el-input-number.vue';
import ElMenu, { ElMenuItem } from 'element-plus/lib/components/menu/index';
import ElPopover from '@/ui/el/el-popover.vue';
import ElScrollbar from 'element-plus/lib/components/scrollbar/index';
import ElSlider from 'element-plus/lib/components/slider/index';
import ElTabs, { ElTabPane } from 'element-plus/lib/components/tabs/index';

import OgCanvasContainer from '@/ui/element/canvas-container.vue';
import OgMoreInfoIcon from '@/ui/element/more-info-icon.vue';

import type { BrushDefinition, RGBAColor, WorkingFileGradientColorSpace, WorkingFileGradientColorStop } from '@/types';

const props = defineProps({
    selectedBrushId: {
        type: String,
        required: true,
    },
    visible: {
        type: Boolean,
        required: true,
    },
    isDialog: {
        type: Boolean,
        default: false,
    },
});

const emit = defineEmits([
    'close',
    'update:title',
    'update:dialogSize',
    'update:selectedBrushId',
]);
emit('update:title', 'toolbar.drawGradient.stopDialog.title');
emit('update:dialogSize', 'medium-large');

const { t } = useI18n();

/*--------------*\
| View Switching |
\*--------------*/

const view = ref<'select' | 'edit'>('select');

/*--------------*\
| Selected Brush |
\*--------------*/

const brushSelectorView = ref<HTMLDivElement>();
const selectedBrush = ref<BrushDefinition>();
const selectedBrushCategoryId = ref<string>();

const selectedBrushCategory = computed(() => {
    return brushesByCategory.value.find((category) => selectedBrushCategoryId.value === category.id);
});

onMounted(() => {
    if (brushSelectorView.value) {
        brushSelectorView.value.querySelector('.og-brush-selector__brush-preview--active')?.scrollIntoView();
    }
});

watch(() => props.selectedBrushId, (selectedBrushId) => {
    selectedBrush.value = getBrushById(selectedBrushId);
    selectedBrushCategoryId.value = selectedBrush.value?.categories[0];
}, { immediate: true });

watch(() => selectedBrushCategory.value, (selectedBrushCategory) => {
    if (!selectedBrushCategory) return;

    for (let i = 0; i < selectedBrushCategory.brushes.length; i++) {
        if (!selectedBrushCategory.brushPreviews[i]) {
            generateBrushPreview(selectedBrushCategory.brushes[i].id);
        }
    }
}, { immediate: true });

function onClickActivateBrush(brushId: string) {
    emit('update:selectedBrushId', brushId);
}

function onClickEditBrush(brushId: string) {
    const brush = getBrushById(brushId);
    if (!brush) return;

    editingBrush.value = {
        categories: brush.categories,
        id: brush.id,
        name: brush.name,
        shape: brush.shape,
        hardness: brush.hardness * 100,
        spacing: Math.round(brush.spacing * 100),
        jitter: Math.round(brush.jitter * 100),
        angle: Math.round(brush.angle * Math.RADIANS_TO_DEGREES),
        pressureTaper: Math.round((brush.pressureTaper - 1) * 100),
        pressureMinSize: Math.round(brush.pressureMinSize * 100),
        pressureDensityRange: [Math.round(brush.pressureMinDensity * 100), Math.round(brush.density * 100)],
        density: 0,
        pressureMinDensity: 0,
        colorBlendingStrengthRange: [Math.round(brush.pressureMinColorBlendingStrength * 100), Math.round(brush.colorBlendingStrength * 100)],
        colorBlendingStrength: 0,
        pressureMinColorBlendingStrength: 0,
        colorBlendingPersistence: Math.round(brush.colorBlendingPersistence * 100),
        concentrationRange: [Math.round(brush.pressureMinConcentration * 100), Math.round(brush.concentration * 100)],
        concentration: 0,
        pressureMinConcentration: 0,
    };
    view.value = 'edit';
}

function applyBrushEdits() {
    const brushDefinition: BrushDefinition = {
        categories: editingBrush.value.categories,
        id: editingBrush.value.id,
        name: editingBrush.value.name,
        shape: editingBrush.value.shape,
        hardness: editingBrush.value.hardness / 100,
        spacing: editingBrush.value.spacing / 100,
        jitter: editingBrush.value.jitter / 100,
        angle: editingBrush.value.angle * Math.DEGREES_TO_RADIANS,
        pressureTaper: (editingBrush.value.pressureTaper / 100) + 1,
        pressureMinSize: editingBrush.value.pressureMinSize / 100,
        density: editingBrush.value.pressureDensityRange[1] / 100,
        pressureMinDensity: editingBrush.value.pressureDensityRange[0] / 100,
        colorBlendingStrength: editingBrush.value.colorBlendingStrengthRange[1] / 100,
        pressureMinColorBlendingStrength: editingBrush.value.colorBlendingStrengthRange[0] / 100,
        colorBlendingPersistence: editingBrush.value.colorBlendingPersistence / 100,
        concentration: editingBrush.value.concentrationRange[1] / 100,
        pressureMinConcentration: editingBrush.value.concentrationRange[1] / 100,
    }
    addCustomBrush(brushDefinition);
    generateBrushPreview(brushDefinition.id);
    emit('update:selectedBrushId', 'default');
    nextTick(() => {
        emit('update:selectedBrushId', brushDefinition.id);
    });
}

/*----------*\
| Edit Brush |
\*----------*/

const editingBrush = ref<BrushDefinition & {
    pressureDensityRange: number[];
    colorBlendingStrengthRange: number[];
    concentrationRange: number[];
}>({} as never);

/*---------------*\
| Dialog Controls |
\*---------------*/

function onBack() {
    view.value = 'select';
}

function onDone() {
    if (view.value === 'edit') {
        applyBrushEdits();
        view.value = 'select';
    } else {
        emit('close');
    }
}

function onCancel() {
    emit('close');
}

function onConfirmSelection() {
    emit('close');
}

</script>