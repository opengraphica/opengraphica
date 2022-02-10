<template>
    <div class="is-flex container is-align-items-center is-justify-content-center mx-auto">
        <div class="ogr-toolbar-overlay">
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
                    <el-form novalidate="novalidate" action="javascript:void(0)">
                        <div class="px-4.5 my-3">
                            <el-button-group class="el-button-group--flex is-fullwidth">
                                <el-input-number v-model="resizeInputWidth" size="small" class="is-flex-grow-1" :suffix-text="measuringUnits" @input="onInputResizeWidth" />
                                <el-button size="small" aria-label="Link Width/Height" class="px-3" @click="onToggleDimensionLockRatio()">
                                    <i :class="['bi', dimensionLockRatio != null ? 'bi-lock-fill' : 'bi-unlock-fill']" aria-hidden="true" />
                                </el-button>
                                <el-input-number v-model="resizeInputHeight" size="small" class="is-flex-grow-1" :suffix-text="measuringUnits"  @input="onInputResizeHeight" />
                            </el-button-group>
                        </div>
                    </el-form>
                </el-popover>
            </el-horizontal-scrollbar-arrows>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent, ref, computed, onMounted, toRefs, watch, nextTick } from 'vue';
import { layerPickMode, useRotationSnapping, width, height } from '@/canvas/store/free-transform-state';
import ElButton, { ElButtonGroup } from 'element-plus/lib/components/button/index';
import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElHorizontalScrollbarArrows from '@/ui/el-horizontal-scrollbar-arrows.vue';
import ElInputGroup from '@/ui/el-input-group.vue';
import ElInputNumber from '@/ui/el-input-number.vue';
import ElPopover from 'element-plus/lib/components/popover/index';
import ElSelect, { ElOption } from 'element-plus/lib/components/select/index';
import ElSwitch from 'element-plus/lib/components/switch/index';
import workingFileStore, { WorkingFileState } from '@/store/working-file';
import { convertUnits } from '@/lib/metrics';

export default defineComponent({
    name: 'ToolbarFreeTransform',
    components: {
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
        const measuringUnits = ref<WorkingFileState['measuringUnits']>(workingFileStore.get('measuringUnits'));
        const resolutionX = ref<number>(workingFileStore.get('resolutionX'));
        const resolutionY = ref<number>(workingFileStore.get('resolutionY'));
        const resolutionUnits = ref<WorkingFileState['resolutionUnits']>(workingFileStore.get('resolutionUnits'));
        const dimensionLockRatio = ref<number | null>(null);

        let disableDimensionDragUpdate: boolean = false;

        const resizeInputWidth = ref<number>(
            convertUnits(width.value, 'px', measuringUnits.value, resolutionX.value, resolutionUnits.value)
        );
        const resizeInputHeight = ref<number>(
            convertUnits(height.value, 'px', measuringUnits.value, resolutionY.value, resolutionUnits.value)
        );

        watch([width, height], ([width, height]) => {
            if (!disableDimensionDragUpdate) {
                resizeInputWidth.value = parseFloat(convertUnits(width, 'px', measuringUnits.value, resolutionX.value, resolutionUnits.value).toFixed(measuringUnits.value === 'px' ? 0 : 2));
                resizeInputHeight.value = parseFloat(convertUnits(height, 'px', measuringUnits.value, resolutionY.value, resolutionUnits.value).toFixed(measuringUnits.value === 'px' ? 0 : 2));
            }
        }, { immediate: true });

        function onToggleDimensionLockRatio() {
            if (dimensionLockRatio.value == null) {
                dimensionLockRatio.value = width.value / height.value;
            } else {
                dimensionLockRatio.value = null;
            }
        }

        async function onInputResizeWidth(newWidth: number) {
            disableDimensionDragUpdate = true;
            width.value = Math.ceil(convertUnits(newWidth, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value));
            if (dimensionLockRatio.value) {
                height.value = Math.ceil(width.value / dimensionLockRatio.value);
                resizeInputHeight.value = parseFloat((newWidth / dimensionLockRatio.value).toFixed(measuringUnits.value === 'px' ? 0 : 2));
            }
            await nextTick();
            disableDimensionDragUpdate = false;
        }

        async function onInputResizeHeight(newHeight: number) {
            disableDimensionDragUpdate = true;
            height.value = Math.ceil(convertUnits(newHeight, measuringUnits.value, 'px', resolutionY.value, resolutionUnits.value));
            if (dimensionLockRatio.value) {
                width.value = Math.ceil(height.value * dimensionLockRatio.value);
                resizeInputWidth.value = parseFloat((newHeight * dimensionLockRatio.value).toFixed(measuringUnits.value === 'px' ? 0 : 2));
            }
            await nextTick();
            disableDimensionDragUpdate = false;
        }

        return {
            resizeInputWidth,
            resizeInputHeight,
            measuringUnits,
            layerPickMode,
            useRotationSnapping,
            dimensionLockRatio,
            onToggleDimensionLockRatio,
            onInputResizeWidth,
            onInputResizeHeight
        };
    }
});
</script>
