<template>
    <div class="is-flex container is-align-items-center is-justify-content-space-between mx-auto">
        <div class="py-2 pl-4 is-text-nowrap is-text-ellipsis">
            <div class="is-block my-2 is-text-ellipsis">
                <i class="bi bi-crop" aria-hidden="true" />
                {{ $t('toolbar.cropResize.title') }}
            </div>
        </div>
        <div class="py-2 px-3 is-text-nowrap">
            <el-button plain type="text" class="px-4" :aria-label="$t('button.cancel')" @click="onCancel">
                <template v-if="isMobileView">
                    <i class="bi bi-x"></i>
                </template>
                <template v-else>
                    {{ $t('button.cancel') }}
                </template>
            </el-button>
            <el-popover placement="bottom" :popper-class="'ogr-dock-popover'" trigger="click" :width="250">
                <template #reference>
                    <el-button plain type="text" class="px-4 ml-0 mr-2" :aria-label="$t('button.settings')">
                        <template v-if="isMobileView">
                            <i class="bi bi-sliders"></i>
                        </template>
                        <template v-else>
                            {{ $t('button.settings') }}
                        </template>
                    </el-button>
                </template>
                <h2 class="mt-3 mx-4.5" v-t="'button.settings'" />
                <el-form novalidate="novalidate" action="javascript:void(0)">
                    <!--el-form-item class="el-form-item--menu-item mb-1" label="Mode">
                        <el-radio-group
                            v-model="mode"
                            size="small">
                            <el-radio-button label="crop">Crop</el-radio-button>
                            <el-radio-button label="resample">Resample</el-radio-button>
                        </el-radio-group>
                    </el-form-item-->
                    <div class="px-4.5 my-3">
                        <el-button-group class="el-button-group--flex is-fullwidth">
                            <el-input-number v-model="resizeInputWidth" :aria-label="$t('toolbar.cropResize.width')" size="small" class="is-flex-grow-1" :suffix-text="measuringUnits" @input="onInputResizeWidth" />
                            <el-button size="small" :aria-label="$t('toolbar.cropResize.linkWidthHeight')" class="px-3" :disabled="mode === 'resample'" @click="isDimensionRatioLock = !isDimensionRatioLock">
                                <i :class="['bi', isDimensionRatioLock ? 'bi-lock-fill' : 'bi-unlock-fill']" aria-hidden="true" />
                            </el-button>
                            <el-input-number v-model="resizeInputHeight" :aria-label="$t('toolbar.cropResize.height')" size="small" class="is-flex-grow-1" :suffix-text="measuringUnits"  @input="onInputResizeHeight" />
                        </el-button-group>
                    </div>
                    <el-form-item class="el-form-item--menu-item mb-1" :label="$t('toolbar.cropResize.dimensionUnits')">
                        <el-select style="width: 5rem" size="small" v-model="measuringUnits">
                            <el-option
                                v-for="option in dimensionUnitOptions"
                                :key="option.value"
                                :label="option.value"
                                :value="option.value">
                                {{ $t(option.label) }}
                            </el-option>
                        </el-select>
                    </el-form-item>
                    <el-form-item class="el-form-item--menu-item mb-1" :label="$t('toolbar.cropResize.resolution')">
                        <el-input-number style="width: 6rem" size="small" v-model="resolution" />
                    </el-form-item>
                    <el-form-item class="el-form-item--menu-item mb-1" :label="$t('toolbar.cropResize.resolutionUnits')">
                        <el-select style="width: 6rem" size="small" v-model="resolutionUnits">
                            <el-option
                                v-for="option in resolutionUnitOptions"
                                :key="option.value"
                                :label="option.value"
                                :value="option.value">
                                {{ $t(option.label) }}
                            </el-option>
                        </el-select>
                    </el-form-item>
                    <el-form-item class="el-form-item--menu-item el-form-item--has-content-right mb-1" :label="$t('toolbar.cropResize.snapping')">
                        <el-switch v-model="enableSnapping" />
                    </el-form-item>
                </el-form>
            </el-popover>
            <el-button :aria-label="$t('button.done')" plain type="primary" class="ml-0" @click="onDone">
                <template v-if="isMobileView">
                    <i class="bi bi-check"></i>
                </template>
                <template v-else>
                    {{ $t('button.done') }}
                </template>
            </el-button>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent, ref, computed, onMounted, toRefs, watch, nextTick } from 'vue';
import ElButton, { ElButtonGroup } from 'element-plus/lib/components/button/index';
import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElInputNumber from '@/ui/el-input-number.vue';
import ElLoading from 'element-plus/lib/components/loading/index';
import ElPopover from 'element-plus/lib/components/popover/index';
import { ElRadioButton, ElRadioGroup } from 'element-plus/lib/components/radio/index';
import ElSelect, { ElOption } from 'element-plus/lib/components/select/index';
import ElSwitch from 'element-plus/lib/components/switch/index';
import appEmitter from '@/lib/emitter';
import canvasStore from '@/store/canvas';
import historyStore from '@/store/history';
import workingFileStore, { WorkingFileState } from '@/store/working-file';
import { top as cropTop, left as cropLeft, width as cropWidth, height as cropHeight, enableSnapping, dimensionLockRatio } from '@/canvas/store/crop-resize-state';
import { WorkingFileLayer, WorkingFileGroupLayer, ColorModel, UpdateAnyLayerOptions } from '@/types';
import { BaseAction } from '@/actions/base';
import { BundleAction } from '@/actions/bundle';
import { UpdateFileAction } from '@/actions/update-file';
import { UpdateLayerAction } from '@/actions/update-layer';
import { convertUnits } from '@/lib/metrics';
import { decomposeMatrix } from '@/lib/dom-matrix';

export default defineComponent({
    name: 'ToolbarCropResize',
    directives: {
        loading: ElLoading.directive
    },
    components: {
        ElButton,
        ElButtonGroup,
        ElForm,
        ElFormItem,
        ElInputNumber,
        ElOption,
        ElPopover,
        ElRadioButton,
        ElRadioGroup,
        ElSelect,
        ElSwitch
    },
    props: {
        
    },
    emits: [
        'close'
    ],
    setup(props, { emit }) {
        const isMobileView = ref<boolean>(false);
        const { viewWidth: viewportWidth } = toRefs(canvasStore.state);

        let disableDimensionDragUpdate: boolean = false;
        const mode = ref<'crop' | 'resample'>('crop');
        const isDimensionRatioLock = ref<boolean>(dimensionLockRatio.value != null);
        const measuringUnits = ref<WorkingFileState['measuringUnits']>(workingFileStore.get('measuringUnits'));
        const resolutionX = ref<number>(workingFileStore.get('resolutionX'));
        const resolutionY = ref<number>(workingFileStore.get('resolutionY'));
        const resolutionUnits = ref<WorkingFileState['resolutionUnits']>(workingFileStore.get('resolutionUnits'));

        const resizeInputWidth = ref<number>(
            convertUnits(cropWidth.value, 'px', measuringUnits.value, resolutionX.value, resolutionUnits.value)
        );
        const resizeInputHeight = ref<number>(
            convertUnits(cropHeight.value, 'px', measuringUnits.value, resolutionY.value, resolutionUnits.value)
        );

        const dimensionUnitOptions = [
            { value: 'px', label: 'measurement.pixels' },
            { value: 'mm', label: 'measurement.millimeters' },
            { value: 'cm', label: 'measurement.centimeters' },
            { value: 'in', label: 'measurement.inches' }
        ];
        const resolutionUnitOptions = [
            { value: 'px/in', label: 'measurement.pixelsPerInch' },
            { value: 'px/mm', label: 'measurement.pixelsPerMillimeter' },
            { value: 'px/cm', label: 'measurement.pixelsPerCentimeter' }
        ];

        const resolution = computed<number>({
            get() {
                return resolutionX.value;
            },
            set(resolution) {
                resolutionX.value = resolution;
                resolutionY.value = resolution;
            }
        });

        watch([measuringUnits], ([newMeasuringUnits], [oldMeasuringUnits]) => {
            resizeInputWidth.value = parseFloat(convertUnits(resizeInputWidth.value, oldMeasuringUnits, newMeasuringUnits, resolutionX.value, resolutionUnits.value).toFixed(newMeasuringUnits === 'px' ? 0 : 2));
            resizeInputHeight.value = parseFloat(convertUnits(resizeInputHeight.value, oldMeasuringUnits, newMeasuringUnits, resolutionY.value, resolutionUnits.value).toFixed(newMeasuringUnits === 'px' ? 0 : 2));
        });
        
        watch([cropWidth, cropHeight], ([cropWidth, cropHeight]) => {
            if (!disableDimensionDragUpdate && mode.value === 'crop') {
                resizeInputWidth.value = parseFloat(convertUnits(cropWidth, 'px', measuringUnits.value, resolutionX.value, resolutionUnits.value).toFixed(measuringUnits.value === 'px' ? 0 : 2));
                resizeInputHeight.value = parseFloat(convertUnits(cropHeight, 'px', measuringUnits.value, resolutionY.value, resolutionUnits.value).toFixed(measuringUnits.value === 'px' ? 0 : 2));
            }
        }, { immediate: true });

        watch([isDimensionRatioLock], ([isDimensionRatioLock]) => {
            if (isDimensionRatioLock) {
                dimensionLockRatio.value = resizeInputWidth.value / resizeInputHeight.value;
            } else {
                dimensionLockRatio.value = null;
            }
        });

        watch([viewportWidth], () => {
            toggleMobileView();
        });

        watch([mode], async ([newMode]) => {
            if (newMode === 'resample') {
                isDimensionRatioLock.value = false;
                await nextTick();
                resizeInputWidth.value = parseFloat(convertUnits(workingFileStore.get('width'), 'px', measuringUnits.value, resolutionX.value, resolutionUnits.value).toFixed(measuringUnits.value === 'px' ? 0 : 2));
                resizeInputHeight.value = parseFloat(convertUnits(workingFileStore.get('height'), 'px', measuringUnits.value, resolutionY.value, resolutionUnits.value).toFixed(measuringUnits.value === 'px' ? 0 : 2));
                await onInputResizeWidth(resizeInputWidth.value);
                await onInputResizeHeight(resizeInputHeight.value);
                cropTop.value = 0;
                cropLeft.value = 0;
                isDimensionRatioLock.value = true;
            } else {
                resizeInputWidth.value = parseFloat(convertUnits(workingFileStore.get('width'), 'px', measuringUnits.value, resolutionX.value, resolutionUnits.value).toFixed(measuringUnits.value === 'px' ? 0 : 2));
                resizeInputHeight.value = parseFloat(convertUnits(workingFileStore.get('height'), 'px', measuringUnits.value, resolutionY.value, resolutionUnits.value).toFixed(measuringUnits.value === 'px' ? 0 : 2));
                await onInputResizeWidth(resizeInputWidth.value);
                await onInputResizeHeight(resizeInputHeight.value);
                cropTop.value = 0;
                cropLeft.value = 0;
                isDimensionRatioLock.value = false;
            }
        });

        onMounted(async () => {
            toggleMobileView();
            await nextTick();
            appEmitter.emit('app.canvas.resetTransform', { margin: Math.floor(Math.min(window.innerWidth, window.innerHeight) / 4) });
        });

        async function onInputResizeWidth(newWidth: number) {
            disableDimensionDragUpdate = true;
            if (mode.value === 'crop') {
                cropWidth.value = Math.ceil(convertUnits(newWidth, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value));
            }
            if (dimensionLockRatio.value) {
                if (mode.value === 'crop') {
                    cropHeight.value = Math.ceil(cropWidth.value / dimensionLockRatio.value);
                }
                resizeInputHeight.value = parseFloat((newWidth / dimensionLockRatio.value).toFixed(measuringUnits.value === 'px' ? 0 : 2));
            }
            await nextTick();
            disableDimensionDragUpdate = false;
        }

        async function onInputResizeHeight(newHeight: number) {
            disableDimensionDragUpdate = true;
            if (mode.value === 'crop') {
                cropHeight.value = Math.ceil(convertUnits(newHeight, measuringUnits.value, 'px', resolutionY.value, resolutionUnits.value));
            }
            if (dimensionLockRatio.value) {
                if (mode.value === 'crop') {
                    cropWidth.value = Math.ceil(cropHeight.value * dimensionLockRatio.value);
                }
                resizeInputWidth.value = parseFloat((newHeight * dimensionLockRatio.value).toFixed(measuringUnits.value === 'px' ? 0 : 2));
            }
            await nextTick();
            disableDimensionDragUpdate = false;
        }

        function toggleMobileView() {
            isMobileView.value = viewportWidth.value < 500;
        }

        function onCancel() {
            emit('close');
        }

        async function onDone() {
            appEmitter.emit('app.wait.startBlocking', { id: 'toolCropResizeCalculating', label: 'canvas.toolbar.cropResize.waitLabel' });
            try {
                const layers = workingFileStore.get('layers');
                let layerUpdateActions: BaseAction[] = await generateResizeLayerActions(layers);
                await historyStore.dispatch('runAction', {
                    action: new BundleAction('moduleCropResize', 'action.moduleCropResize', [
                        ...layerUpdateActions,
                        new UpdateFileAction({
                            width: cropWidth.value,
                            height: cropHeight.value,
                            measuringUnits: measuringUnits.value,
                            resolutionX: resolutionX.value,
                            resolutionY: resolutionY.value,
                            resolutionUnits: resolutionUnits.value
                        })
                    ])
                });
            } catch (error: any) {
                
            }
            appEmitter.emit('app.wait.stopBlocking', { id: 'toolCropResizeCalculating' });
            emit('close');
        }

        async function generateResizeLayerActions(layers: WorkingFileLayer<ColorModel>[]): Promise<BaseAction[]> {
            let actions: BaseAction[] = [];
            for (let layer of layers) {
                if (layer.type === 'group') {
                    await generateResizeLayerActions((layer as WorkingFileGroupLayer<ColorModel>).layers);
                } else if (layer.type === 'raster' || layer.type === 'rasterSequence') {
                    const transform = new DOMMatrix().translateSelf(-cropLeft.value, -cropTop.value).multiplySelf(layer.transform);
                    actions.push(
                        new UpdateLayerAction<UpdateAnyLayerOptions<ColorModel>>({
                            id: layer.id,
                            transform
                        })
                    );
                }
            }
            return actions;
        }

        return {
            isDimensionRatioLock,
            measuringUnits,
            dimensionUnitOptions,
            resolutionUnitOptions,
            resolution,
            resolutionUnits,
            resizeInputWidth,
            resizeInputHeight,
            onInputResizeWidth,
            onInputResizeHeight,
            isMobileView,
            mode,
            enableSnapping,
            onCancel,
            onDone
        };
    }
});
</script>
