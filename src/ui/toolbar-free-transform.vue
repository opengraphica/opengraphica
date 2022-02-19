<template>
    <div class="is-flex container is-align-items-center is-justify-content-center mx-auto">
        <div class="ogr-toolbar-overlay">
            <div class="ogr-toolbar-tool-selector">
                <span class="bi bi-cursor my-1" aria-hidden="true"></span>
                <span class="ogr-toolbar-tool-selector__description">Settings</span>
            </div>
            <el-horizontal-scrollbar-arrows>
                <el-input-group prepend-tooltip="Pick Layer">
                    <template #prepend>
                        <span class="bi bi-cursor" aria-hidden="true" />
                    </template>
                    <el-select aria-label="Layer Selection" v-model="layerPickMode" size="small" style="width: 5rem">
                        <el-option label="Auto" value="auto"></el-option>
                        <el-option label="Current" value="current"></el-option>
                    </el-select>
                </el-input-group>
                <el-popover
                    placement="top"
                    popper-class="ogr-dock-popover"
                    trigger="click"
                    :width="250">
                    <template #reference>
                        <el-button size="small" class="ml-3">
                            <span class="bi bi-magnet-fill mr-2" aria-hidden="true" /> Snapping
                        </el-button>
                    </template>
                    <h2 class="mt-3 mx-4.5">Snapping</h2>
                    <el-form novalidate="novalidate" action="javascript:void(0)">
                        <el-form-item class="el-form-item--menu-item el-form-item--has-content-right mb-1" label="Rotation Snap">
                            <el-switch v-model="useRotationSnapping" />
                        </el-form-item>
                    </el-form>
                </el-popover>
                <el-popover
                    placement="top"
                    popper-class="p-0"
                    trigger="click"
                    :width="250">
                    <template #reference>
                        <el-button size="small" class="ml-3">
                            <span class="bi bi-clipboard-data-fill mr-2" aria-hidden="true" /> Metrics
                        </el-button>
                    </template>
                    <h2 class="mt-3 mx-4.5">Metrics</h2>
                    <template v-if="selectedLayerIds.length > 0">
                        <el-form novalidate="novalidate" action="javascript:void(0)">
                            <div class="px-4.5 my-3 is-flex">
                                <el-input-number
                                    v-model="inputLeft" aria-label="X Position" size="small"
                                    class="el-input-group--plain is-flex-grow-1" :suffix-text="measuringUnits" :blur-on-enter="true" @focus="onFocusAnyMetricInput()" @input="onInputLeft($event)" @blur="onChangeDragResizeInput()">
                                    <template #prepend>X</template>
                                </el-input-number>
                                <el-input-number
                                    v-model="inputTop" aria-label="Y Position" size="small"
                                    class="el-input-group--plain is-flex-grow-1 ml-3" :suffix-text="measuringUnits" :blur-on-enter="true" @focus="onFocusAnyMetricInput()" @input="onInputTop($event)" @blur="onChangeDragResizeInput()">
                                    <template #prepend>Y</template>
                                </el-input-number>
                            </div>
                            <el-form-item class="el-form-item--menu-item mb-1" label="Width">
                                <el-input-number v-model="inputWidth" style="width: 6rem" size="small" :suffix-text="measuringUnits" :blur-on-enter="true" @focus="onFocusAnyMetricInput()" @input="onInputWidth($event)" @blur="onChangeDragResizeInput()" />
                            </el-form-item>
                            <el-form-item class="el-form-item--menu-item mb-1" label="Height">
                                <el-input-number v-model="inputHeight" style="width: 6rem" size="small" :suffix-text="measuringUnits" :blur-on-enter="true" @focus="onFocusAnyMetricInput()" @input="onInputHeight($event)" @blur="onChangeDragResizeInput()" />
                            </el-form-item>
                            <el-form-item class="el-form-item--menu-item mb-1" label="Rotation">
                                <el-input-number v-model="inputRotation" style="width: 6rem" size="small" suffix-text="°" :blur-on-enter="true" @focus="onFocusAnyMetricInput()" @input="onInputRotation($event)" @blur="onChangeRotationInput($event)">
                                    <template #append>
                                        <el-button size="small" aria-label="Reset Rotation" @click="onResetRotation()">
                                            <span class="bi bi-arrow-repeat" aria-hidden="true"></span>
                                        </el-button>
                                    </template>
                                </el-input-number>
                            </el-form-item>
                        </el-form>
                    </template>
                    <template v-else>
                        <div class="px-4.5 my-3">
                            <el-alert
                                type="info"
                                title="No layer(s) selected."
                                show-icon
                                :closable="false">
                            </el-alert>
                        </div>
                    </template>
                </el-popover>
            </el-horizontal-scrollbar-arrows>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent, ref, computed, onMounted, toRefs, watch, nextTick } from 'vue';
import { freeTransformEmitter, layerPickMode, useRotationSnapping, top, left, width, height, rotation } from '@/canvas/store/free-transform-state';
import ElAlert from 'element-plus/lib/components/alert/index';
import ElButton, { ElButtonGroup } from 'element-plus/lib/components/button/index';
import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElHorizontalScrollbarArrows from '@/ui/el-horizontal-scrollbar-arrows.vue';
import ElInputGroup from '@/ui/el-input-group.vue';
import ElInputNumber from '@/ui/el-input-number.vue';
import ElPopover from '@/ui/el-popover.vue';
import ElSelect, { ElOption } from 'element-plus/lib/components/select/index';
import ElSwitch from 'element-plus/lib/components/switch/index';
import workingFileStore, { WorkingFileState } from '@/store/working-file';
import { convertUnits } from '@/lib/metrics';

export default defineComponent({
    name: 'ToolbarFreeTransform',
    components: {
        ElAlert,
        ElButton,
        ElButtonGroup,
        ElForm,
        ElFormItem,
        ElHorizontalScrollbarArrows,
        ElInputGroup,
        ElInputNumber,
        ElOption,
        ElPopover,
        ElSelect,
        ElSwitch
    },
    props: {
        
    },
    emits: [
        'close'
    ],
    setup(props, { emit }) {
        const { selectedLayerIds } = toRefs(workingFileStore.state);
        const measuringUnits = ref<WorkingFileState['measuringUnits']>(workingFileStore.get('measuringUnits'));
        const resolutionX = ref<number>(workingFileStore.get('resolutionX'));
        const resolutionY = ref<number>(workingFileStore.get('resolutionY'));
        const resolutionUnits = ref<WorkingFileState['resolutionUnits']>(workingFileStore.get('resolutionUnits'));
        const dimensionLockRatio = ref<number | null>(null);

        let disableInputUpdate: boolean = false;

        const inputLeft = ref<number>(0);
        const inputTop = ref<number>(0);
        const inputWidth = ref<number>(1);
        const inputHeight = ref<number>(1);
        const inputRotation = ref<number>(0);

        watch([left], ([left]) => {
            if (!disableInputUpdate) {
                inputLeft.value = parseFloat(convertUnits(left, 'px', measuringUnits.value, resolutionX.value, resolutionUnits.value).toFixed(2));
            }
        }, { immediate: true });
        watch([top], ([top]) => {
            if (!disableInputUpdate) {
                inputTop.value = parseFloat(convertUnits(top, 'px', measuringUnits.value, resolutionX.value, resolutionUnits.value).toFixed(2));
            }
        }, { immediate: true });
        watch([width, height], ([width, height]) => {
            if (!disableInputUpdate) {
                inputWidth.value = parseFloat(convertUnits(width, 'px', measuringUnits.value, resolutionX.value, resolutionUnits.value).toFixed(measuringUnits.value === 'px' ? 0 : 2));
                inputHeight.value = parseFloat(convertUnits(height, 'px', measuringUnits.value, resolutionY.value, resolutionUnits.value).toFixed(measuringUnits.value === 'px' ? 0 : 2));
            }
        }, { immediate: true });
        watch([rotation], ([rotation]) => {
            if (!disableInputUpdate) {
                inputRotation.value = parseFloat((rotation * Math.RADIANS_TO_DEGREES).toFixed(2));
            }
        }, { immediate: true });

        function onToggleDimensionLockRatio() {
            if (dimensionLockRatio.value == null) {
                dimensionLockRatio.value = width.value / height.value;
            } else {
                dimensionLockRatio.value = null;
            }
        }

        function onFocusAnyMetricInput() {
            freeTransformEmitter.emit('storeTransformStart');
            disableInputUpdate = true;
        }

        function onInputLeft(left: number) {
            freeTransformEmitter.emit('previewDragResizeChange', {
                transform: {
                    left: convertUnits(left, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value),
                    top: convertUnits(inputTop.value, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value),
                    width: convertUnits(inputWidth.value, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value),
                    height: convertUnits(inputHeight.value, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value)
                }
            });
        }

        function onInputTop(top: number) {
            freeTransformEmitter.emit('previewDragResizeChange', {
                transform: {
                    left: convertUnits(inputLeft.value, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value),
                    top: convertUnits(top, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value),
                    width: convertUnits(inputWidth.value, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value),
                    height: convertUnits(inputHeight.value, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value)
                }
            });
        }

        function onInputWidth(width: number) {
            freeTransformEmitter.emit('previewDragResizeChange', {
                transform: {
                    left: convertUnits(inputLeft.value, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value),
                    top: convertUnits(inputTop.value, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value),
                    width: convertUnits(width, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value),
                    height: convertUnits(inputHeight.value, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value)
                }
            });
        }

        function onInputHeight(height: number) {
            freeTransformEmitter.emit('previewDragResizeChange', {
                transform: {
                    left: convertUnits(inputLeft.value, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value),
                    top: convertUnits(inputTop.value, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value),
                    width: convertUnits(inputWidth.value, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value),
                    height: convertUnits(height, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value)
                }
            });
        }

        function onInputRotation(rotation: number) {
            freeTransformEmitter.emit('previewRotationChange', {
                rotation: rotation * Math.DEGREES_TO_RADIANS
            });
        }

        function onChangeDragResizeInput() {
            disableInputUpdate = false;
            freeTransformEmitter.emit('commitTransforms');
        }

        function onChangeRotationInput() {
            disableInputUpdate = false;
            freeTransformEmitter.emit('commitTransforms');
        }

        function onResetRotation() {
            freeTransformEmitter.emit('storeTransformStart');
            freeTransformEmitter.emit('previewRotationChange', {
                rotation: 0
            });
            freeTransformEmitter.emit('commitTransforms');
        }

        return {
            inputLeft,
            inputTop,
            inputWidth,
            inputHeight,
            inputRotation,
            measuringUnits,
            layerPickMode,
            useRotationSnapping,
            dimensionLockRatio,
            selectedLayerIds,
            onToggleDimensionLockRatio,
            onFocusAnyMetricInput,
            onInputLeft,
            onInputTop,
            onInputWidth,
            onInputHeight,
            onInputRotation,
            onChangeDragResizeInput,
            onChangeRotationInput,
            onResetRotation
        };
    }
});
</script>
