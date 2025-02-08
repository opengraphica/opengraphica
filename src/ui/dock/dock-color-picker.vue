<template>
    <div class="ogr-dock-content">
        <div class="ogr-dock-mobile-edge-padding">
            <app-color-picker-gradient :modelValue="workingColor" @input="workingColor = $event" v-model:preload="pickerGradientLoading" />
        </div>
        <h2 class="px-4.5 my-4 has-text-centered">{{ colorName }}</h2>
        <div class="px-4.5 my-4 is-flex is-justify-content-center">
            <div class="ogr-color-picker-preview">
                <div class="ogr-color-picker-preview__color" :style="{ '--preview-color': workingColor.style }" />
                <el-input
                    v-model.lazy="hexCode" style="width: 7rem"
                    :aria-label="$t('dock.colorPicker.hexCode')"
                    :placeholder="$t('dock.colorPicker.hexCode')"
                    @change="onChangeHexCode"
                />
            </div>
            <el-button :title="$t('dock.colorPicker.pickColorFromImage')" class="ml-3" @click="onPickColorFromImage">
                <span class="bi bi-eyedropper" aria-hidden="true" />
            </el-button>
        </div>
        <template v-if="isDialog">
            <el-divider />
            <div class="px-4.5 mt-4 pb-4 has-text-right">
                <el-button @click="onCancel">{{ $t('button.cancel') }}</el-button>
                <el-button @click="onConfirmSelection">{{ $t('button.ok') }}</el-button>
            </div>
        </template>
    </div>
</template>

<script lang="ts">
import { defineComponent, nextTick, onMounted, onUnmounted, ref, toRef, watch, PropType } from 'vue';

import ElButton from 'element-plus/lib/components/button/index';
import ElDivider from 'element-plus/lib/components/divider/index';
import ElInput from 'element-plus/lib/components/input/index';
import ElLoading from 'element-plus/lib/components/loading/index';
import ElScrollbar from 'element-plus/lib/components/scrollbar/index';
import ElTooltip from 'element-plus/lib/components/tooltip/index';

import AppColorPickerGradient from '@/ui/app/app-color-picker-gradient.vue';

import { isWorkerSupported } from '@/lib/feature-detection/worker';
import { colorToRgba, colorToHex, hexToColor, getColorModelName } from '@/lib/color';
import { throttle } from '@/lib/timing';

import { createColorNamer, getColorName, destroyColorNamer } from '@/workers/color-namer.interface';

import colorNamer from 'color-namer';

import editorStore from '@/store/editor';
import { pickedColor, drawColorPickerEmitter } from '@/canvas/store/draw-color-picker-state';

import type { ColorModel, ColorModelName, RGBAColor } from '@/types';

export default defineComponent({
    name: 'DockColorPicker',
    directives: {
        loading: ElLoading.directive
    },
    components: {
        AppColorPickerGradient,
        ElButton,
        ElDivider,
        ElInput,
        ElScrollbar,
        ElTooltip
    },
    props: {
        color: {
            type: Object as PropType<ColorModel>,
            default: { is: 'color', r: 0, g: 0, b: 0, alpha: 1, style: '#000000' }
        },
        isDialog: {
            type: Boolean,
            default: false
        }
    },
    emits: [
        'hide',
        'show',
        'close',
        'update:title',
        'update:loading',
    ],
    setup(props, { emit }) {
        emit('update:title', 'dock.colorPicker.title');
        emit('update:loading', true);

        const workingColor = ref<RGBAColor>({ is: 'color', r: 0, g: 0, b: 0, alpha: 1, style: '#000000' });
        let outputColorModelName: ColorModelName = 'rgba';

        const pickerGradientLoading = ref<boolean>(true);

        const hexCode = ref<string>();
        const colorName = ref<string>('\u00A0');
        const isFadeInColorName = ref<boolean>(false);

        let colorNamerWorkerUuid: string | null = null;

        watch(() => pickerGradientLoading.value, (pickerGradientLoading, wasPickerGradientLoading) => {
            if (wasPickerGradientLoading && !pickerGradientLoading) {
                emit('update:loading', false);
            }
        }, { immediate: true });

        watch([toRef(props, 'color')], ([inputColor]) => {
            outputColorModelName = getColorModelName(inputColor);
            workingColor.value = colorToRgba(inputColor, outputColorModelName, inputColor.conversionSpace);
        }, { immediate: true });

        const nameColor = throttle(async function (hexColor: string) {
            if (colorNamerWorkerUuid) {
                colorName.value = await getColorName(colorNamerWorkerUuid, hexColor);
            } else if (colorNamer) {
                colorName.value = colorNamer(hexColor, { pick: ['ntc'] }).ntc[0]?.name;
            }
        }, 50);

        watch([workingColor], () => {
            hexCode.value = colorToHex(workingColor.value, 'rgba');
            nameColor(hexCode.value);
        }, { immediate: true });

        onMounted(async () => {
            if (await isWorkerSupported()) {
                colorNamerWorkerUuid = createColorNamer();
            }
        });

        onUnmounted(() => {
            if (colorNamerWorkerUuid) {
                destroyColorNamer(colorNamerWorkerUuid);
            }
        });

        function onChangeHexCode(newHexCode: string) {
            workingColor.value = hexToColor(newHexCode, 'rgba');
        }

        function onPickColorFromImage() {
            emit('hide');
            editorStore.dispatch('setActiveTool', { group: 'draw', tool: 'colorPicker' });

            function onColorPickerClose() {
                pickedColorUnwatch();
                drawColorPickerEmitter.off('close', onColorPickerClose);
                emit('show');
            }

            const pickedColorUnwatch = watch(() => pickedColor.value, (pickedColor) => {
                pickedColorUnwatch();
                drawColorPickerEmitter.off('close', onColorPickerClose);
                if (pickedColor) {
                    workingColor.value = { ...pickedColor };
                }
                nextTick(() => {
                    emit('show');
                });
            });

            drawColorPickerEmitter.on('close', onColorPickerClose);
        }

        function onCancel() {
            emit('close');
        }

        function onConfirmSelection() {
            emit('close', { color: JSON.parse(JSON.stringify(workingColor.value)) });
        }

        return {
            pickerGradientLoading,

            workingColor,
            hexCode,
            colorName,

            isFadeInColorName,

            onChangeHexCode,
            onPickColorFromImage,
            onCancel,
            onConfirmSelection
        };
    }
});
</script>
