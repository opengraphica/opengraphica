<template>
    <div class="is-flex container is-align-items-center is-justify-content-center mx-auto">
        <div v-if="editingLayers.length > 0 && !showStopDrawer" class="ogr-toolbar-edit-confirm">
            {{ $t('toolbar.drawGradient.editingGradient') }}
            <el-button plain size="small" class="ml-3" @click="onDoneEditing()">
                <span class="bi bi-check-circle-fill mr-2" aria-hidden="true" /> {{ $t('button.done') }}
            </el-button>
        </div>
        <div class="ogr-toolbar-overlay" :class="{ 'is-active': editingLayers.length > 0 }">
            <div class="ogr-toolbar-tool-selector">
                <span class="bi bi-shadows my-1" aria-hidden="true"></span>
                <span class="ogr-toolbar-tool-selector__description" v-t="'toolbar.general.settings'" />
            </div>
            <el-horizontal-scrollbar-arrows>
                <div
                    role="button"
                    tabindex="0"
                    class="ogr-toolbar-draw-gradient__stop-selection"
                    :style="{ '--gradient': selectedGradientBackground }"
                    aria-haspopup="dialog"
                    :aria-expanded="showStopDrawer"
                    :aria-controls="showStopDrawer ? ('toolbar-draw-gradient-stop-drawer-' + uuid) : undefined"
                    @click="onClickStopGradientSelect()"
                    @keydown="onKeydownStopGradientSelect($event)"
                >
                </div>
                <el-radio-group v-model="fillType" size="small" class="ml-3" @change="onChangeFillType()">
                    <el-radio-button label="linear">
                        {{ $t('toolbar.drawGradient.fillType.linear') }}
                    </el-radio-button>
                    <el-radio-button label="radial">
                        {{ $t('toolbar.drawGradient.fillType.radial') }}
                    </el-radio-button>
                </el-radio-group>
                <el-input-group :prepend-tooltip="$t('toolbar.drawGradient.blendColorSpace.label')" class="ml-3">
                    <template #prepend>
                        <span class="bi bi-rainbow" aria-hidden="true" />
                    </template>
                    <el-select :aria-label="$t('toolbar.drawGradient.blendColorSpace.label')" v-model="blendColorSpace" size="small" style="width: 6.25rem" @change="onChangeBlendColorSpace()">
                        <el-option :label="$t('toolbar.drawGradient.blendColorSpace.oklab')" value="oklab" />
                        <el-option :label="$t('toolbar.drawGradient.blendColorSpace.srgb')" value="srgb" />
                        <el-option :label="$t('toolbar.drawGradient.blendColorSpace.linearSrgb')" value="linearSrgb" />
                    </el-select>
                </el-input-group>
                <el-input-group :prepend-tooltip="$t('toolbar.drawGradient.spreadMethod.label')" class="ml-3">
                    <template #prepend>
                        <span class="bi bi-bullseye" aria-hidden="true" />
                    </template>
                    <el-select :aria-label="$t('toolbar.drawGradient.spreadMethod.label')" v-model="spreadMethod" size="small" style="width: 5.5rem" @change="onChangeSpreadMethod()">
                        <el-option :label="$t('toolbar.drawGradient.spreadMethod.pad')" value="pad" />
                        <el-option :label="$t('toolbar.drawGradient.spreadMethod.repeat')" value="repeat" />
                        <el-option :label="$t('toolbar.drawGradient.spreadMethod.reflect')" value="reflect" />
                        <el-option :label="$t('toolbar.drawGradient.spreadMethod.truncate')" value="truncate" />
                    </el-select>
                </el-input-group>
            </el-horizontal-scrollbar-arrows>
        </div>
        <div
            v-if="showStopDrawer"
            :id="'toolbar-draw-gradient-stop-drawer-' + uuid"
            role="dialog"
            class="ogr-toolbar-drawer"
            style="max-width: 38rem"
        >
            <h2 class="ogr-toolbar-drawer__title" v-t="'toolbar.drawGradient.stopDialog.title'" />
            <el-button
                plain
                class="ogr-toolbar-drawer__close"
                :aria-label="$t('toolbar.drawGradient.stopDialog.close')"
                @click="showStopDrawer = false"
            >
                <span class="bi bi-check-circle-fill mr-2" aria-hidden="true" /> <span>{{ $t('button.done') }}</span>
            </el-button>
            <div class="ogr-toolbar-draw-gradient-stop-drawer__editor-preview-section">
                <div ref="gradientEditorElement" class="ogr-gradient-editor">
                    <div
                        class="ogr-gradient-editor__preview"
                        :style="{ '--gradient': editingGradientBackground }"
                        @mouseenter="onMouseEnterGradientEditorPreview"
                        @mouseleave="onMouseLeaveGradientEditorPreview"
                        v-pointer.move="onPointerMoveGradientEditorPreview"
                        v-pointer.down="onPointerDownGradientEditorPreview"
                    >
                        <div
                            v-if="showStopAddCursor"
                            class="ogr-gradient-editor__add-position"
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
                        class="ogr-gradient-editor__stop-marker"
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
                        v-pointer.down="onPointerDownStopMarker"
                        v-pointer.move.window="draggingColorStopIndex > -1 ? onPointerMoveStopMarker : undefined"
                        v-pointer.up.window="draggingColorStopIndex > -1 ? onPointerUpStopMarker : undefined"
                    >
                        <div class="ogr-gradient-editor__stop-marker__color" :data-color-stop-index="colorStopIndex" />
                    </div>
                    <div
                        v-if="showStopAddCursor"
                        class="ogr-gradient-editor__stop-marker"
                        :style="{
                            'left': (addCursorOffset * 100) + '%',
                            '--stop-color': addCursorColor.style,
                        }"
                        aria-hidden="true"
                    >
                        <div class="ogr-gradient-editor__stop-marker__color">
                            <span class="bi bi-plus" />
                        </div>
                    </div>
                </div>
            </div>
            <div
                v-if="activeColorStopIndex > -1 && activeColorStopIndex < editingColorStops.length"
                class="ogr-toolbar-draw-gradient-stop-drawer__editor-stop-form"
            >
                <div class="ogr-toolbar-draw-gradient-stop-drawer__editor-stop-form__selection-indicator-container">
                    <div
                        class="ogr-toolbar-draw-gradient-stop-drawer__editor-stop-form__selection-indicator"
                        :style="{ left: (editingColorStops[activeColorStopIndex].offset * 100) + '%' }"
                    />
                </div>
                <el-horizontal-scrollbar-arrows>
                    <el-input-group>
                        <template #prepend>
                            <span class="is-size-7">{{ $t('toolbar.drawGradient.stopDialog.stopColor') }}</span>
                        </template>
                        <el-input-color
                            v-model="editingColorStops[activeColorStopIndex].color"
                            :aria-label="$t('toolbar.drawGradient.stopDialog.stopColor')"
                            @change="onChangeEditingStopColor()"
                        ></el-input-color>
                    </el-input-group>
                    <el-input-group  class="ml-3">
                        <template #prepend>
                            <span class="is-size-7">{{ $t('toolbar.drawGradient.stopDialog.stopOffset') }}</span>
                        </template>
                        <el-input-number
                            :model-value="parseInt(editingColorStops[activeColorStopIndex].offset * 100)"
                            size="small"
                            :min="0"
                            :max="100"
                            suffix-text="%"
                            style="width: 3.5rem"
                            :aria-label="$t('toolbar.drawGradient.stopDialog.stopOffset')"
                            @update:model-value="editingColorStops[activeColorStopIndex].offset = $event / 100"
                            @change="onChangeEditingStopOffset()"
                        ></el-input-number>
                    </el-input-group>
                    <el-button-group class="is-flex ml-3">
                        <el-button plain size="small" @click="onDeleteEditingStop()">
                            <span class="bi bi-trash mr-2" aria-hidden="true" /> {{ $t('button.delete') }}
                        </el-button>
                        <el-button plain size="small" @click="onReverseStops()">
                            <span class="bi bi-shuffle mr-2" aria-hidden="true" /> {{ $t('button.reverse') }}
                        </el-button>
                    </el-button-group>
                </el-horizontal-scrollbar-arrows>
            </div>
            <div class="ogr-toolbar-draw-gradient-stop-drawer__presets">
                <h3 v-t="'toolbar.drawGradient.stopDialog.presets'" class="is-size-6" />
                <el-scrollbar>
                    <div v-for="(preset, presetIndex) of gradientPresets" :key="presetIndex" class="ogr-gradient-preset">
                        <button class="ogr-gradient-preset__activate" @click="onSelectPreset(presetIndex)">
                            <div class="ogr-gradient-preset__name">{{ preset.name }}</div>
                            <div class="ogr-gradient_preset__color-stops" :style="{ '--gradient': preset.gradientBackground }" />
                        </button>
                        <el-popover
                            v-model:visible="presetSettingsVisibility[presetIndex]"
                            trigger="click"
                            popper-class="p-0"
                        >
                            <template #reference>
                                <el-button type="primary" link :aria-label="$t('toolbar.drawGradient.stopDialog.presetSettings')">
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
                                    <span v-t="'app.layerList.delete'"></span>
                                </el-menu-item>
                            </el-menu>
                        </el-popover>
                    </div>
                </el-scrollbar>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { v4 as uuidv4 } from 'uuid';
import { defineComponent, ref, computed, nextTick, toRefs, watch } from 'vue';

import { BundleAction } from '@/actions/bundle';
import { UpdateLayerAction } from '@/actions/update-layer';

import {
    activeColorStops, blendColorSpace, editingLayers, fillType, presets, showStopDrawer, spreadMethod,
    type GradientPreset,
} from '@/canvas/store/draw-gradient-state';
import { appliedSelectionMask, activeSelectionMask } from '@/canvas/store/selection-state';
import historyStore from '@/store/history';
import workingFileStore, { WorkingFileState } from '@/store/working-file';

import pointerDirective from '@/directives/pointer';

import ElAlert from 'element-plus/lib/components/alert/index';
import ElButton, { ElButtonGroup } from 'element-plus/lib/components/button/index';
import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElHorizontalScrollbarArrows from '@/ui/el/el-horizontal-scrollbar-arrows.vue';
import ElInput from 'element-plus/lib/components/input/index';
import ElInputColor from '@/ui/el/el-input-color.vue';
import ElInputGroup from '@/ui/el/el-input-group.vue';
import ElInputNumber from '@/ui/el/el-input-number.vue';
import ElMenu, { ElMenuItem } from 'element-plus/lib/components/menu/index';
import ElPopover from '@/ui/el/el-popover.vue';
import { ElRadioGroup, ElRadioButton } from 'element-plus/lib/components/radio/index';
import ElScrollbar from 'element-plus/lib/components/scrollbar/index';
import ElSelect, { ElOption } from 'element-plus/lib/components/select/index';
import ElSlider from 'element-plus/lib/components/slider/index';
import ElTooltip from 'element-plus/lib/components/tooltip/index';

import { srgbaToLinearSrgba, linearSrgbaToOklab } from '@/lib/color';
import { sampleGradient } from '@/lib/gradient';
import { UpdateGradientLayerOptions, WorkingFileGradientColorStop, WorkingFileGradientColorSpace, RGBAColor } from '@/types';

export default defineComponent({
    name: 'ToolbarDrawGradient',
    directives: {
        pointer: pointerDirective
    },
    components: {
        ElAlert,
        ElButton,
        ElButtonGroup,
        ElForm,
        ElFormItem,
        ElHorizontalScrollbarArrows,
        ElInput,
        ElInputColor,
        ElInputGroup,
        ElInputNumber,
        ElMenu,
        ElMenuItem,
        ElOption,
        ElPopover,
        ElRadioGroup,
        ElRadioButton,
        ElScrollbar,
        ElSelect,
        ElSlider,
        ElTooltip,
    },
    props: {
        
    },
    emits: [
        'close'
    ],
    setup(props, { emit }) {
        const { selectedLayerIds } = toRefs(workingFileStore.state);

        const uuid = uuidv4();

        const hasSelection = computed<boolean>(() => {
            return !(appliedSelectionMask.value == null && activeSelectionMask.value == null);
        });

        /*----------------------*\
        | Gradient Stop Selector |
        \*----------------------*/

        const selectedGradientBackground = computed<string>(() => {
            return generatePreviewCssGradient(activeColorStops.value as WorkingFileGradientColorStop<RGBAColor>[], blendColorSpace.value);
        });

        function onClickStopGradientSelect() {
            showStopDrawer.value = !showStopDrawer.value;
        }
        
        function onKeydownStopGradientSelect(event: KeyboardEvent) {
            if (event.key === 'Enter' || event.key === ' ') {
                showStopDrawer.value = !showStopDrawer.value;
            }
        }

        watch([showStopDrawer], ([show]) => {
            if (show) {
                editingColorStops.value = JSON.parse(JSON.stringify(activeColorStops.value));
                activeColorStopIndex.value = Math.min(editingColorStops.value.length - 1, Math.max(0, activeColorStopIndex.value));
            } else {
                if (hasEditedActiveColorStops.value) {
                    activeColorStops.value = JSON.parse(JSON.stringify(editingColorStops.value));
                    hasEditedActiveColorStops.value = false;
                    onChangeActiveColorStops();
                }
            }
        })

        /*------------------*\
        | Gradient Stop Edit |
        \*------------------*/

        const hasEditedActiveColorStops = ref(false);
        const gradientEditorElement = ref<HTMLDivElement>();
        const editingColorStops = ref<WorkingFileGradientColorStop<RGBAColor>[]>([]);
        const activeColorStopIndex = ref(-1);

        const showStopAddCursor = ref(false);
        const addCursorOffset = ref(0);
        const addCursorColor = ref<RGBAColor>({
            is: 'color',
            r: 0, g: 0, b: 0, alpha: 1,
            style: '#000000',
        });
        const justAddedCursor = ref(false);

        const draggingColorStopIndex = ref(-1);
        const draggingColorStopStartOffset = ref(0);
        const draggingColorStopStartX = ref(0);
        const draggingColorStopMaxWidth = ref(1);

        const editingGradientBackground = computed<string>(() => {
            return generatePreviewCssGradient(editingColorStops.value, blendColorSpace.value);
        });

        function generatePreviewCssGradient(colorStops: WorkingFileGradientColorStop<RGBAColor>[], blendColorSpace: WorkingFileGradientColorSpace): string {
            let previewGradient = '';
            let handledOffsets = new Set<number>();
            let sampledColorStops: WorkingFileGradientColorStop<RGBAColor>[] = [];
            for (const stop of colorStops) {
                sampledColorStops.push(stop);
                handledOffsets.add(stop.offset);
            }
            for (let i = 0; i <= 100; i += 10) {
                const sampleOffset = i / 100;
                if (handledOffsets.has(sampleOffset)) continue;
                sampledColorStops.push({
                    offset: sampleOffset,
                    color: sampleGradient(colorStops, blendColorSpace, sampleOffset),
                });
            }
            sampledColorStops.sort((a, b) => a.offset < b.offset ? -1 : 1);

            if (blendColorSpace === 'oklab') {
                previewGradient = 'linear-gradient(in oklab 90deg, ' + sampledColorStops.map((colorStop) => {
                    const { l, a, b, alpha } = linearSrgbaToOklab(srgbaToLinearSrgba(colorStop.color));
                    return `oklab(${l * 100}% ${a} ${b} / ${alpha}) ${colorStop.offset * 100}%`
                }).join(', ') + ')';
            } else if (blendColorSpace === 'linearSrgb') { 
                previewGradient = 'linear-gradient(in srgb-linear 90deg, ' + sampledColorStops.map((colorStop) => {
                    return `${colorStop.color.style} ${colorStop.offset * 100}%`
                }).join(', ') + ')';
            }
            if (!window?.CSS?.supports || !window.CSS.supports('background-image', previewGradient)) {
                previewGradient = 'linear-gradient(90deg, ' + sampledColorStops.map((colorStop) => {
                    return `${colorStop.color.style} ${colorStop.offset * 100}%`
                }).join(', ') + ')';
            }
            return previewGradient;
        }

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
                    break;
            }
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
        }
        function onPointerUpStopMarker() {
            draggingColorStopIndex.value = -1;
        }

        function onChangeEditingStopColor() {
            hasEditedActiveColorStops.value = true;
        }

        function onChangeEditingStopOffset() {
            hasEditedActiveColorStops.value = true;
        }

        function onDeleteEditingStop() {
            if (activeColorStopIndex.value < 0) return;
            editingColorStops.value.splice(activeColorStopIndex.value, 1);
            activeColorStopIndex.value = editingColorStops.value.length - 1;
            hasEditedActiveColorStops.value = true;
        }

        function onReverseStops() {
            for (const stop of editingColorStops.value) {
                stop.offset = 1.0 - stop.offset;
            }
            hasEditedActiveColorStops.value = true;
        }

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
            addCursorColor.value = sampleGradient(editingColorStops.value, blendColorSpace.value, addCursorOffset.value);
        }

        function onPointerDownGradientEditorPreview(event: PointerEvent) {
            if (justAddedCursor.value) return;

            const gradientEditorClientRect = gradientEditorElement.value?.getBoundingClientRect();
            if (!gradientEditorClientRect) return;
            editingColorStops.value.push({
                offset: Math.min(1, Math.max(0, (event.clientX - gradientEditorClientRect.x) / gradientEditorClientRect.width)),
                color: sampleGradient(editingColorStops.value, blendColorSpace.value, addCursorOffset.value),
            });
            hasEditedActiveColorStops.value = true;
            justAddedCursor.value = true;
            showStopAddCursor.value = false;
            nextTick(() => {
                activeColorStopIndex.value = editingColorStops.value.length - 1;
            });
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
                gradientBackground: generatePreviewCssGradient(preset.stops, blendColorSpace.value),
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

        return {
            uuid,

            showStopDrawer,
            onClickStopGradientSelect,
            onKeydownStopGradientSelect,

            selectedGradientBackground,
            selectedLayerIds,
            hasSelection,

            gradientEditorElement,
            activeColorStopIndex,
            showStopAddCursor,
            addCursorOffset,
            addCursorColor,
            draggingColorStopIndex,
            editingColorStops,
            editingGradientBackground,
            onKeydownStopMarker,
            onPointerDownStopMarker,
            onPointerMoveStopMarker,
            onPointerUpStopMarker,
            onChangeEditingStopColor,
            onChangeEditingStopOffset,
            onDeleteEditingStop,
            onReverseStops,
            onMouseEnterGradientEditorPreview,
            onMouseLeaveGradientEditorPreview,
            onPointerMoveGradientEditorPreview,
            onPointerDownGradientEditorPreview,

            gradientPresets,
            presetSettingsVisibility,
            presetSettingsActiveIndex,
            onPresetSettingsSelect,
            onSelectPreset,

            blendColorSpace,
            editingLayers,
            fillType,
            spreadMethod,

            onChangeFillType,
            onChangeBlendColorSpace,
            onChangeSpreadMethod,
            onDoneEditing,
        };
    }
});
</script>
