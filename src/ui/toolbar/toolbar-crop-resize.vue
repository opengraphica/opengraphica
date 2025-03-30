<template>
    <div class="flex container items-center justify-between mx-auto">
        <div class="py-2 pl-el-scrollbar-arrow-size text-nowrap text-ellipsis">
            <div class="block my-2 text-ellipsis">
                <i class="bi bi-crop" aria-hidden="true" />
                {{ $t('toolbar.cropResize.title') }}
            </div>
        </div>
        <div class="py-2 pl-3 pr-el-scrollbar-arrow-size text-nowrap">
            <el-button plain link type="primary" class="!px-4 !mr-2" :aria-label="$t('button.cancel')" @click="onCancel">
                <template v-if="isMobileView">
                    <i class="bi bi-x"></i>
                </template>
                <template v-else>
                    {{ $t('button.cancel') }}
                </template>
            </el-button>
            <el-button :aria-label="$t('button.done')" plain type="primary" class="!ml-0" @click="onDone">
                <template v-if="isMobileView">
                    <i class="bi bi-check"></i>
                </template>
                <template v-else>
                    {{ $t('button.done') }}
                </template>
            </el-button>
        </div>
    </div>
    <div style="background: var(--og-background-color)">
        <div class="container mx-auto">
            <el-horizontal-scrollbar-arrows>
                <el-form-item class="el-form-item--small-label" label="Mode">
                    <el-radio-group
                        v-model="mode"
                        size="small">
                        <el-radio-button label="crop">Crop</el-radio-button>
                        <el-radio-button label="resample">Resample</el-radio-button>
                    </el-radio-group>
                </el-form-item>
                <el-form-item :label="$t('toolbar.cropResize.size')" class="ml-6 el-form-item--small-label">
                    <el-button-group class="el-button-group--flex">
                        <el-input-number v-model="resizeInputWidth" :aria-label="$t('toolbar.cropResize.width')" size="small" class="grow-1" style="width: 5rem" @input="onInputResizeWidth" />
                        <el-button size="small" :aria-label="$t('toolbar.cropResize.linkWidthHeight')" class="px-3" :disabled="mode === 'resample'" @click="isDimensionRatioLock = !isDimensionRatioLock">
                            <i :class="['bi', isDimensionRatioLock ? 'bi-lock-fill' : 'bi-unlock-fill']" aria-hidden="true" />
                        </el-button>
                        <el-input-number v-model="resizeInputHeight" :aria-label="$t('toolbar.cropResize.height')" size="small" class="grow-1" style="width: 5rem" @input="onInputResizeHeight" />
                        <el-select v-model="measuringUnits" :aria-label="$t('toolbar.cropResize.dimensionUnits')" size="small" style="width: 3.75rem">
                            <el-option
                                v-for="option in dimensionUnitOptions"
                                :key="option.value"
                                :label="option.value"
                                :value="option.value">
                                {{ $t(option.label) }}
                            </el-option>
                        </el-select>
                    </el-button-group>
                </el-form-item>
                <el-form-item :label="$t('toolbar.cropResize.resolution')" class="ml-6 el-form-item--small-label">
                    <el-button-group class="el-button-group--flex">
                        <el-input-number v-model="resolution" :aria-label="$t('toolbar.cropResize.resolution')" style="width: 4rem" size="small" @change="onChangeResolution()" />
                        <el-select v-model="resolutionUnits" :aria-label="$t('toolbar.cropResize.resolutionUnits')" style="width: 5rem" size="small" @change="onChangeResolutionUnits()">
                            <el-option
                                v-for="option in resolutionUnitOptions"
                                :key="option.value"
                                :label="option.value"
                                :value="option.value">
                                {{ $t(option.label) }}
                            </el-option>
                        </el-select>
                    </el-button-group>
                </el-form-item>
                <el-popover
                    placement="bottom"
                    popper-class="og-dock-popover"
                    trigger="click"
                    :width="250"
                    :popper-options="{
                        modifiers: [
                            {
                                name: 'computeStyles',
                                options: {
                                    adaptive: false,
                                    enabled: false
                                }
                            }
                        ]
                    }">
                    <template #reference>
                        <el-button size="small" class="!ml-6">
                            <span class="bi bi-magnet-fill mr-2" aria-hidden="true" /> {{ $t('toolbar.freeTransform.snapping.title') }}
                        </el-button>
                    </template>
                    <h2 class="og-dock-title" v-t="'toolbar.cropResize.snapping.title'" />
                    <el-form novalidate="novalidate" action="javascript:void(0)">
                        <el-form-item class="el-form-item--menu-item el-form-item--has-content-right mb-1" :label="$t('toolbar.cropResize.snapping.enable')">
                            <el-switch v-model="enableSnapping" />
                        </el-form-item>
                        <div :class="enableSnapping ? '' : 'opacity-50'">
                            <p class="el-form-item el-form-item--menu-item !my-2">{{ $t('toolbar.cropResize.snapping.currentCanvas') }}:</p>
                            <div class="pl-2">
                                <el-form-item class="el-form-item--menu-item el-form-item--has-content-right mb-1" :label="$t('toolbar.cropResize.snapping.snapToCenter')">
                                    <el-switch v-model="enableSnappingToCanvasCenter" :disabled="!enableSnapping" />
                                </el-form-item>
                                <el-form-item class="el-form-item--menu-item el-form-item--has-content-right mb-1" :label="$t('toolbar.cropResize.snapping.snapToEdges')">
                                    <el-switch v-model="enableSnappingToCanvasEdges" :disabled="!enableSnapping" />
                                </el-form-item>
                            </div>
                            <p class="el-form-item el-form-item--menu-item !my-2">{{ $t('toolbar.cropResize.snapping.cropArea') }}:</p>
                            <div class="pl-2">
                                <el-form-item class="el-form-item--menu-item el-form-item--has-content-right mb-1" :label="$t('toolbar.cropResize.snapping.snapAtCenter')">
                                    <el-switch v-model="enableSnappingToSelectionCenter" :disabled="!enableSnapping" />
                                </el-form-item>
                                <el-form-item class="el-form-item--menu-item el-form-item--has-content-right mb-1" :label="$t('toolbar.cropResize.snapping.snapAtEdges')">
                                    <el-switch v-model="enableSnappingToSelectionEdges" :disabled="!enableSnapping" />
                                </el-form-item>
                            </div>
                        </div>
                    </el-form>
                </el-popover>
            </el-horizontal-scrollbar-arrows>
        </div>
    </div>
</template>

<script setup lang="ts">
import { defineComponent, ref, computed, onMounted, toRefs, watch, nextTick } from 'vue';

import ElButton, { ElButtonGroup } from 'element-plus/lib/components/button/index';
import ElDivider from 'element-plus/lib/components/divider/index';
import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElHorizontalScrollbarArrows from '@/ui/el/el-horizontal-scrollbar-arrows.vue';
import ElInputNumber from '@/ui/el/el-input-number.vue';
import ElLoading from 'element-plus/lib/components/loading/index';
import ElPopover from 'element-plus/lib/components/popover/index';
import { ElRadioButton, ElRadioGroup } from 'element-plus/lib/components/radio/index';
import ElSelect, { ElOption } from 'element-plus/lib/components/select/index';
import ElSwitch from 'element-plus/lib/components/switch/index';

import appEmitter from '@/lib/emitter';
import canvasStore from '@/store/canvas';
import historyStore from '@/store/history';
import workingFileStore, { WorkingFileState } from '@/store/working-file';
import {
    top as cropTop, left as cropLeft, width as cropWidth, height as cropHeight,
    enableSnapping, enableSnappingToCanvasCenter, enableSnappingToCanvasEdges,
    enableSnappingToSelectionCenter, enableSnappingToSelectionEdges, dimensionLockRatio
} from '@/canvas/store/crop-resize-state';

import { BaseAction } from '@/actions/base';
import { BundleAction } from '@/actions/bundle';
import { ClearSelectionAction } from '@/actions/clear-selection';
import { UpdateFileAction } from '@/actions/update-file';
import { UpdateLayerAction } from '@/actions/update-layer';

import { convertUnits } from '@/lib/metrics';
import { textMetaDefaults } from '@/lib/text-common';

import type {
    WorkingFileLayer, WorkingFileGroupLayer, ColorModel, UpdateAnyLayerOptions, UpdateTextLayerOptions,
    WorkingFileTextLayer, TextDocument,
} from '@/types';
import { decomposeMatrix } from '@/lib/dom-matrix';

const emit = defineEmits(['close']);

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
        cropWidth.value = resizeInputWidth.value;
        cropHeight.value = resizeInputHeight.value;
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

async function onChangeResolution() {
    await nextTick();
    resizeInputWidth.value = parseFloat(
        convertUnits(cropWidth.value, 'px', measuringUnits.value, resolutionX.value, resolutionUnits.value).toFixed(measuringUnits.value === 'px' ? 0 : 2)
    );
    resizeInputHeight.value = parseFloat(
        convertUnits(cropHeight.value, 'px', measuringUnits.value, resolutionX.value, resolutionUnits.value).toFixed(measuringUnits.value === 'px' ? 0 : 2)
    );
}

async function onChangeResolutionUnits() {
    onChangeResolution();
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
        const resizePxWidth = convertUnits(resizeInputWidth.value, measuringUnits.value, 'px', resolutionX.value, resolutionUnits.value);
        const resizePxHeight = convertUnits(resizeInputHeight.value, measuringUnits.value, 'px', resolutionY.value, resolutionUnits.value);
        const widthRatio = resizePxWidth / cropWidth.value;
        const heightRatio = resizePxHeight / cropHeight.value;
        let layerUpdateActions: BaseAction[] = await generateResizeLayerActions(layers, widthRatio, heightRatio);

        await historyStore.dispatch('runAction', {
            action: new BundleAction('moduleCropResize', 'action.moduleCropResize', [
                ...layerUpdateActions,
                new ClearSelectionAction(),
                new UpdateFileAction({
                    width: mode.value === 'crop' ? cropWidth.value : resizePxWidth,
                    height: mode.value === 'crop' ? cropHeight.value : resizePxHeight,
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

async function generateResizeLayerActions(
    layers: WorkingFileLayer<ColorModel>[],
    widthRatio: number,
    heightRatio: number,
): Promise<BaseAction[]> {
    let actions: BaseAction[] = [];
    for (let layer of layers) {
        if (layer.type === 'group') {
            await generateResizeLayerActions((layer as WorkingFileGroupLayer<ColorModel>).layers, widthRatio, heightRatio);
        } else if (layer.type === 'raster' || layer.type === 'rasterSequence' || layer.type === 'vector' || layer.type === 'gradient') {
            let transform = layer.transform;
            if (mode.value === 'crop') {
                transform = new DOMMatrix().translateSelf(-cropLeft.value, -cropTop.value).multiplySelf(layer.transform);
            } else {
                transform = new DOMMatrix().translateSelf(-cropLeft.value * widthRatio, -cropTop.value * heightRatio).scaleSelf(widthRatio, heightRatio).multiplySelf(layer.transform);
            }
            actions.push(
                new UpdateLayerAction<UpdateAnyLayerOptions<ColorModel>>({
                    id: layer.id,
                    transform
                })
            );
        } else if (layer.type === 'text') {
            let transform = layer.transform;
            if (mode.value === 'crop') {
                transform = new DOMMatrix().translateSelf(-cropLeft.value, -cropTop.value).multiplySelf(layer.transform);
                actions.push(
                    new UpdateLayerAction<UpdateTextLayerOptions<ColorModel>>({
                        id: layer.id,
                        transform,
                    })
                );
            } else {
                const decomposedTransform = decomposeMatrix(transform);
                transform = new DOMMatrix()
                    .translateSelf(-cropLeft.value * widthRatio, -cropTop.value * heightRatio)
                    .translateSelf(
                        -decomposedTransform.translateX + (decomposedTransform.translateX * widthRatio),
                        -decomposedTransform.translateY + (decomposedTransform.translateY * heightRatio)
                    )
                    .multiplySelf(layer.transform)
                const oldData = JSON.parse(JSON.stringify((layer as WorkingFileTextLayer).data)) as TextDocument;
                const newData = JSON.parse(JSON.stringify((layer as WorkingFileTextLayer).data)) as TextDocument;
                for (const line of newData.lines) {
                    for (const span of line.spans) {
                        span.meta.size = (span.meta.size ?? textMetaDefaults.size) * widthRatio;
                    }
                }
                actions.push(
                    new UpdateLayerAction<UpdateTextLayerOptions<ColorModel>>({
                        id: layer.id,
                        transform,
                        width: layer.width * widthRatio,
                        height: layer.height * heightRatio,
                        data: newData,
                    }, {
                        transform: layer.transform,
                        width: layer.width,
                        height: layer.height,
                        data: oldData,
                    })
                );
            }
        }
    }
    return actions;
}

</script>
