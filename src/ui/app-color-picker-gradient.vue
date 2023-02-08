<template>
    <div class="ogr-color-picker-gradient">
        <div
            class="ogr-color-picker-gradient__saturation-value"
            v-pointer.down="onPointerDownSaturationValueGradient"
            v-pointer.move.window="onPointerMoveSaturationValueGradient"
            v-pointer.up.window="onPointerUpSaturationValueGradient"
        >
            <div class="ogr-color-picker-gradient__saturation-gradient" :style="{ '--ogr-color-pick-hue': saturationValueGradientColorStyle }"></div>
            <div class="ogr-color-picker-gradient__value-gradient"></div>
            <div ref="saturationValueHandleContainer" class="ogr-color-picker-gradient__saturation-value-handle-container">
                <div
                    class="ogr-color-picker-gradient__saturation-value-handle"
                    :style="{
                        top: (1 - pickedColor.v) * 100 + '%',
                        left: pickedColor.s * 100 + '%'
                    }"
                />
            </div>
        </div>
        <div ref="hueSliderContainer" class="ogr-color-picker-gradient__hue" v-pointer.tap="onPointerDownHueSliderContainer">
            <el-slider
                v-model="hue"
                :aria-label="$t('app.colorPickerGradient.hueSlider')"
                :min="0" :max="0.999" :step="0.001" :show-tooltip="false"
                @input="onInputHueSlider" @change="onChangeHueSlider"
            />
        </div>
        <div ref="opacitySliderContainer" class="ogr-color-picker-gradient__opacity" v-pointer.tap="onPointerDownOpacitySliderContainer" :style="{ '--ogr-color-pick-opaque': pickedColorOpaqueStyle }">
            <el-slider
                v-model="opacity"
                :aria-label="$t('app.colorPickerGradient.opacitySlider')"
                :min="0" :max="1" :step="0.001" :show-tooltip="false"
                @input="onInputOpacitySlider" @change="onChangeOpacitySlider"
            />
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, PropType, watch, toRef, nextTick } from 'vue';
import ElSlider from 'element-plus/lib/components/slider/index';
import { colorToHsva, getColorModelName, convertColorModel, generateColorStyle, createColor } from '@/lib/color';
import { ColorModel, ColorModelName, HSVAColor, RGBAColor } from '@/types';
import pointerDirective from '@/directives/pointer';
import workingFileStore from '@/store/working-file';

export default defineComponent({
    name: 'AppColorPickerGradient',
    directives: {
        pointer: pointerDirective
    },
    components: {
        ElSlider
    },
    props: {
        modelValue: {
            type: Object as PropType<ColorModel>,
            default: { is: 'color', r: 0, g: 0, b: 0, a: 1, style: '#000000' }
        }
    },
    emits: [
        'input',
        'change',
        'update:modelValue'
    ],
    setup(props, { emit }) {
        const hue = ref<number>(0);
        const opacity = ref<number>(1);

        const hueSliderContainer = ref<HTMLDivElement>();
        const opacitySliderContainer = ref<HTMLDivElement>();

        const pickedColor = ref<HSVAColor>({ is: 'color', h: 0, s: 0, v: 0, alpha: 1, style: '#000000' });
        const pickedColorOpaqueStyle = ref<string>('rgb(0, 0, 0)');
        let outputColorModelName: ColorModelName = 'rgba';

        const saturationValueHandleContainer = ref<HTMLDivElement>();
        let saturationValueHandleContainerClientRect: DOMRect = new DOMRect();
        const saturationValueGradientColorStyle = ref<string>('rgb(255, 0, 0)');
        let isPointerDownSaturationValueGradient: boolean = false;

        watch([toRef(props, 'modelValue')], ([inputColor]) => {
            if (!isPointerDownSaturationValueGradient) {
                outputColorModelName = getColorModelName(inputColor);
                let oldPickedColor = JSON.parse(JSON.stringify(pickedColor.value));
                let newPickedColor = colorToHsva(inputColor, outputColorModelName);
                if (
                    (newPickedColor.h !== oldPickedColor.h && newPickedColor.v !== 0) ||
                    (newPickedColor.s !== oldPickedColor.s && newPickedColor.v !== 0) ||
                    newPickedColor.v !== oldPickedColor.v ||
                    newPickedColor.alpha !== oldPickedColor.alpha
                ) {
                    pickedColor.value = newPickedColor;
                    if (newPickedColor.s > 0) {
                        hue.value = pickedColor.value.h;
                        saturationValueGradientColorStyle.value = createColor('hsva', { h: hue.value, s: 1, v: 1, a: 1 }, workingFileStore.state.colorSpace).style;
                    }
                    opacity.value = pickedColor.value.alpha;
                    pickedColorOpaqueStyle.value = generateColorStyle({ ...pickedColor.value, a: 1 }, 'hsva', workingFileStore.state.colorSpace);
                }
            }
        }, { immediate: true });

        function generateOutputColor(): ColorModel {
            const outputColor = convertColorModel(pickedColor.value, outputColorModelName);
            pickedColorOpaqueStyle.value = generateColorStyle({ ...outputColor, a: 1 }, outputColorModelName, workingFileStore.state.colorSpace);
            generateColorStyle(outputColor, outputColorModelName, workingFileStore.state.colorSpace);
            pickedColor.value.style = outputColor.style;
            return outputColor;
        }

        function handleSaturationValueGradientChange(event: PointerEvent) {
            pickedColor.value.s = Math.min(1, Math.max(0, (event.clientX - saturationValueHandleContainerClientRect.left) / saturationValueHandleContainerClientRect.width));
            pickedColor.value.v = 1 - Math.min(1, Math.max(0, (event.clientY - saturationValueHandleContainerClientRect.top) / saturationValueHandleContainerClientRect.height));
            const outputColor = generateOutputColor();
            emit('update:modelValue', outputColor);
            emit('input', outputColor);
        }

        function onPointerDownSaturationValueGradient(event: PointerEvent) {
            if (saturationValueHandleContainer.value) {
                saturationValueHandleContainerClientRect = saturationValueHandleContainer.value.getBoundingClientRect();
                handleSaturationValueGradientChange(event);
                isPointerDownSaturationValueGradient = true;
            }
        }

        function onPointerMoveSaturationValueGradient(event: PointerEvent) {
            if (isPointerDownSaturationValueGradient) {
                handleSaturationValueGradientChange(event);
            }
        }

        function onPointerUpSaturationValueGradient(event: PointerEvent) {
            if (isPointerDownSaturationValueGradient) {
                const outputColor = generateOutputColor();
                emit('change', outputColor);
            }
            isPointerDownSaturationValueGradient = false;
        }

        function onInputHueSlider(value: number) {
            pickedColor.value.h = value;

            saturationValueGradientColorStyle.value = createColor('hsva', { h: hue.value, s: 1, v: 1, a: 1 }, workingFileStore.state.colorSpace).style;

            const outputColor = generateOutputColor();
            emit('update:modelValue', outputColor);
            emit('input', outputColor);
        }

        function onChangeHueSlider(value: number) {
            pickedColor.value.h = value;
            const outputColor = generateOutputColor();
            emit('update:modelValue', outputColor);
            emit('change', outputColor);
        }

        function onInputOpacitySlider(value: number) {
            pickedColor.value.alpha = value;
            const outputColor = generateOutputColor();
            emit('update:modelValue', outputColor);
            emit('input', outputColor);
        }

        function onChangeOpacitySlider(value: number) {
            pickedColor.value.alpha = value;
            const outputColor = generateOutputColor();
            emit('update:modelValue', outputColor);
            emit('change', outputColor);
        }

        async function onPointerDownHueSliderContainer(event: PointerEvent) {
            if (event.target === hueSliderContainer.value) {
                const clientRect = hueSliderContainer.value?.getBoundingClientRect();
                if (event.clientX > clientRect.left + clientRect.width / 2) {
                    hue.value = 0.999;
                } else {
                    hue.value = 0;
                }
                await nextTick();
                onInputHueSlider(hue.value);
                onChangeHueSlider(hue.value);
            }
        }

        async function onPointerDownOpacitySliderContainer(event: PointerEvent) {
            if (event.target === opacitySliderContainer.value) {
                const clientRect = opacitySliderContainer.value?.getBoundingClientRect();
                if (event.clientX > clientRect.left + clientRect.width / 2) {
                    opacity.value = 1;
                } else {
                    opacity.value = 0;
                }
                await nextTick();
                onInputOpacitySlider(opacity.value);
                onChangeOpacitySlider(opacity.value);
            }
        }

        return {
            hue,
            opacity,
            hueSliderContainer,
            opacitySliderContainer,
            saturationValueHandleContainer,
            saturationValueGradientColorStyle,
            pickedColorOpaqueStyle,
            pickedColor,
            onPointerDownSaturationValueGradient,
            onPointerMoveSaturationValueGradient,
            onPointerUpSaturationValueGradient,
            onInputHueSlider,
            onChangeHueSlider,
            onInputOpacitySlider,
            onChangeOpacitySlider,
            onPointerDownHueSliderContainer,
            onPointerDownOpacitySliderContainer
        };
    }
});
</script>
