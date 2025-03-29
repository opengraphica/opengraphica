<template>
    <div class="flex container items-center justify-center mx-auto">
        <div v-if="editingLayers.length > 0 && !showStopDrawer" class="og-toolbar-edit-confirm">
            {{ $t('toolbar.drawGradient.editingGradient') }}
            <el-button plain size="small" class="ml-3" @click="onDoneEditing()">
                <span class="bi bi-check-circle-fill mr-2" aria-hidden="true" /> {{ $t('button.done') }}
            </el-button>
        </div>
        <div class="og-toolbar-overlay" :class="{ 'is-active': editingLayers.length > 0 }">
            <div class="og-toolbar-tool-selector">
                <span class="bi bi-shadows my-1" aria-hidden="true"></span>
                <span class="og-toolbar-tool-selector__description" v-t="'toolbar.general.settings'" />
            </div>
            <el-horizontal-scrollbar-arrows>
                <div
                    role="button"
                    tabindex="0"
                    class="og-gradient-input og-gradient-input--small"
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
            class="og-toolbar-drawer"
            style="max-width: 38rem"
        >
            <h2 class="og-toolbar-drawer__title" v-t="'toolbar.drawGradient.stopDialog.title'" />
            <el-button
                plain
                class="og-toolbar-drawer__close"
                :aria-label="$t('toolbar.drawGradient.stopDialog.close')"
                @click="showStopDrawer = false"
            >
                <span class="bi bi-check-circle-fill mr-2" aria-hidden="true" /> <span>{{ $t('button.done') }}</span>
            </el-button>
            <dock-gradient-editor v-model:gradient="editingColorStops" :blend-color-space="blendColorSpace" @stops-edited="hasEditedColorStops = true" />
        </div>
    </div>
</template>

<script lang="ts">
import { v4 as uuidv4 } from 'uuid';
import { defineComponent, ref, computed, nextTick, toRefs, watch } from 'vue';

import { BundleAction } from '@/actions/bundle';
import { UpdateLayerAction } from '@/actions/update-layer';

import {
    activeColorStops, blendColorSpace, editingLayers, fillType, showStopDrawer, spreadMethod,
} from '@/canvas/store/draw-gradient-state';
import { appliedSelectionMask, activeSelectionMask } from '@/canvas/store/selection-state';
import historyStore from '@/store/history';
import workingFileStore from '@/store/working-file';

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

import DockGradientEditor from '@/ui/dock/dock-gradient-editor.vue';

import { generateCssGradient } from '@/lib/gradient';
import { UpdateGradientLayerOptions, WorkingFileGradientColorStop, RGBAColor } from '@/types';

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
        DockGradientEditor,
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
            return generateCssGradient(activeColorStops.value as WorkingFileGradientColorStop<RGBAColor>[], blendColorSpace.value);
        });

        function onClickStopGradientSelect() {
            showStopDrawer.value = !showStopDrawer.value;
        }
        
        function onKeydownStopGradientSelect(event: KeyboardEvent) {
            if (event.key === 'Enter' || event.key === ' ') {
                showStopDrawer.value = !showStopDrawer.value;
            }
        }

        const editingColorStops = ref<Array<WorkingFileGradientColorStop<RGBAColor>>>([]);
        const hasEditedColorStops = ref<boolean>(false);

        watch([showStopDrawer], ([show]) => {
            if (show) {
                editingColorStops.value = JSON.parse(JSON.stringify(activeColorStops.value));
                hasEditedColorStops.value = false;
            } else {
                if (hasEditedColorStops.value) {
                    activeColorStops.value = JSON.parse(JSON.stringify(editingColorStops.value));
                    hasEditedColorStops.value = false;
                    onChangeActiveColorStops();
                }
            }
        });

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

            blendColorSpace,
            editingLayers,
            fillType,
            spreadMethod,

            editingColorStops,
            hasEditedColorStops,

            onChangeFillType,
            onChangeBlendColorSpace,
            onChangeSpreadMethod,
            onDoneEditing,
        };
    }
});
</script>
