<template>
    <div class="ogr-color-picker-gradient">
        <div
            ref="saturationValueContainer"
            class="ogr-color-picker-gradient__saturation-value"
            v-pointer.down="onPointerDownSaturationValueGradient"
            v-pointer.move.window="onPointerMoveSaturationValueGradient"
            v-pointer.up.window="onPointerUpSaturationValueGradient"
        >
            <div class="ogr-color-picker-gradient__saturation-gradient" :style="{ '--ogr-color-pick-hue': saturationValueGradientColorStyle }"></div>
            <div class="ogr-color-picker-gradient__value-gradient"></div>
            <canvas v-show="useOkhsv" ref="okhsvGradientCanvas" class="ogr-color-picker-gradient__canvas-gradient" />
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
        <div ref="hueSliderContainer" class="ogr-color-picker-gradient__hue" :class="{ 'ogr-color-picker-gradient__hue--okhsv': useOkhsv }" v-pointer.tap="onPointerDownHueSliderContainer">
            <canvas v-show="useOkhsv" ref="okhsvHueSliderCanvas" class="ogr-color-picker-gradient__canvas-gradient" />
            <el-slider
                ref="hueSlider"
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
import { defineComponent, onMounted, onUnmounted, ref, type PropType, watch, toRef, nextTick } from 'vue';
import ElSlider from 'element-plus/lib/components/slider/index';
import { colorToRgba, colorToHsva, getColorModelName, convertColorModel, generateColorStyle, hexToColor, createColor } from '@/lib/color';
import { ColorModel, ColorModelName, HSVAColor } from '@/types';
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
            default: { is: 'color', r: 0, g: 0, b: 0, alpha: 1, style: '#000000' }
        },
        preload: {
            type: Boolean,
            default: true,
        }
    },
    emits: [
        'input',
        'change',
        'update:modelValue',
        'update:preload',
    ],
    setup(props, { emit }) {
        const preloading = ref(true);

        const hue = ref<number>(0);
        const opacity = ref<number>(1);
        const useOkhsv = ref<boolean>(false);

        const okhsvGradientCanvas = ref<HTMLCanvasElement>();
        const okhsvHueSliderCanvas = ref<HTMLCanvasElement>();
        const hueSlider = ref<InstanceType<typeof ElSlider>>();
        const hueSliderContainer = ref<HTMLDivElement>();
        const opacitySliderContainer = ref<HTMLDivElement>();

        const pickedColor = ref<HSVAColor>({ is: 'color', h: 0, s: 0, v: 0, alpha: 1, style: '#000000', conversionSpace: 'srgb' });
        const pickedColorOpaqueStyle = ref<string>('rgb(0, 0, 0)');
        let outputColorModelName: ColorModelName = 'rgba';

        const saturationValueContainer = ref<HTMLDivElement>();
        const saturationValueHandleContainer = ref<HTMLDivElement>();
        let saturationValueHandleContainerClientRect: DOMRect = new DOMRect();
        const saturationValueGradientColorStyle = ref<string>('rgb(255, 0, 0)');
        let isPointerDownSaturationValueGradient: boolean = false;

        let disposeThreejsAssets: () => void = () => {};
        let setThreejsHsvGradientHue: (hue: number) => void = () => {};

        watch([toRef(props, 'modelValue')], ([inputColor]) => {
            if (!isPointerDownSaturationValueGradient) {
                outputColorModelName = getColorModelName(inputColor);
                let oldPickedColor = JSON.parse(JSON.stringify(pickedColor.value));
                let newPickedColor = colorToHsva(inputColor, outputColorModelName, useOkhsv.value ? 'oklab' : 'srgb');
                if (
                    (newPickedColor.h !== oldPickedColor.h && newPickedColor.v !== 0) ||
                    (newPickedColor.s !== oldPickedColor.s && newPickedColor.v !== 0) ||
                    newPickedColor.v !== oldPickedColor.v ||
                    newPickedColor.alpha !== oldPickedColor.alpha
                ) {
                    pickedColor.value = newPickedColor;
                    if (hexToColor(newPickedColor.style, 'hsva').s > 0) {
                        hue.value = pickedColor.value.h;
                        setThreejsHsvGradientHue(hue.value);
                        saturationValueGradientColorStyle.value = createColor(
                            'hsva', { h: hue.value, s: 1, v: 1, alpha: 1 },
                            workingFileStore.state.colorSpace,
                            useOkhsv.value ? 'oklab' : 'srgb'
                        ).style;
                    }
                    opacity.value = pickedColor.value.alpha;
                    pickedColorOpaqueStyle.value = generateColorStyle({ ...pickedColor.value, alpha: 1 }, 'hsva', workingFileStore.state.colorSpace);
                }
            }
        }, { immediate: true });

        onMounted(async () => {
            try {
                setupOkhsv();
                useOkhsv.value = true;
            } catch (error) {}
            await nextTick();
            if (!useOkhsv.value) {
                preloading.value = false;
                emit('update:preload', false);
            }
        });

        onUnmounted(() => {
            disposeThreejsAssets();
        });

        async function setupOkhsv() {
            const { DoubleSide, sRGBEncoding } = await import('three/src/constants');
            const { Mesh } = await import('three/src/objects/Mesh');
            const { ImagePlaneGeometry } = await import('@/canvas/renderers/webgl/geometries/image-plane-geometry');
            const { WebGLRenderer } = await import('three/src/renderers/WebGLRenderer');
            const { Scene } = await import('three/src/scenes/Scene');
            const { OrthographicCamera } = await import('three/src/cameras/OrthographicCamera');
            const { ShaderMaterial } = await import('three/src/materials/ShaderMaterial');
            const okhsvGradientMaterialVertexShader = (await import('@/canvas/renderers/webgl/shaders/okhsv-gradient-material.vert')).default;
            const okhsvGradientMaterialFragmentShader = (await import('@/canvas/renderers/webgl/shaders/okhsv-gradient-material.frag')).default;

            // Create assets for saturation/value gradient

            let valueGradientCanvas = okhsvGradientCanvas.value!;
            let valueGradientCanvasClientRect = valueGradientCanvas.getBoundingClientRect();
            valueGradientCanvas.width = valueGradientCanvasClientRect.width;
            valueGradientCanvas.height = valueGradientCanvasClientRect.height;

            let valueGradientRenderer = new WebGLRenderer({
                alpha: true,
                canvas: valueGradientCanvas,
                premultipliedAlpha: false,
                preserveDrawingBuffer: true,
                powerPreference: 'high-performance',
            });
            valueGradientRenderer.setClearColor(0x000000, 0);
            valueGradientRenderer.outputEncoding = sRGBEncoding;
            valueGradientRenderer.setSize(valueGradientCanvas.width, valueGradientCanvas.height, false);

            let valueGradientScene = new Scene();

            let valueGradientCamera = new OrthographicCamera(0, valueGradientCanvas.width, 0, valueGradientCanvas.height, 0.1, 10000);
            valueGradientCamera.position.z = 1;
            valueGradientCamera.updateProjectionMatrix();

            let saturationValueContainerClientRect = saturationValueContainer.value!.getBoundingClientRect();
            saturationValueHandleContainerClientRect = saturationValueHandleContainer.value!.getBoundingClientRect();

            pickedColor.value = colorToHsva(colorToRgba(pickedColor.value, 'hsva', 'srgb'), 'rgba', 'oklab');
            hue.value = hexToColor(pickedColor.value.style, 'hsva').s > 0 ? pickedColor.value.h : 0;

            let valueGradientShaderMaterial = new ShaderMaterial({
                transparent: true,
                vertexShader: okhsvGradientMaterialVertexShader,
                fragmentShader: okhsvGradientMaterialFragmentShader,
                side: DoubleSide,
                defines: {
                    cGradientType: 0,
                },
                uniforms: {
                    hue: { value: hue.value },
                    verticalBorderPercentage: { value: Math.abs(saturationValueHandleContainerClientRect.left - saturationValueContainerClientRect.left) / saturationValueContainerClientRect.width },
                    horizontalBorderPercentage: { value: Math.abs(saturationValueHandleContainerClientRect.top - saturationValueContainerClientRect.top) / saturationValueContainerClientRect.height },
                },
            });

            let valueGradientImageGeometry = new ImagePlaneGeometry(valueGradientCanvas.width, valueGradientCanvas.height);

            let valueGradientImagePlane = new Mesh(valueGradientImageGeometry, valueGradientShaderMaterial);
            valueGradientScene.add(valueGradientImagePlane);

            valueGradientRenderer.render(valueGradientScene, valueGradientCamera);

            if (preloading.value === true) {
                preloading.value = false;
                emit('update:preload', false);
            }

            (valueGradientCanvas as unknown) = undefined;
            (valueGradientCanvasClientRect as unknown) = undefined;
            (saturationValueContainerClientRect as unknown) = undefined;

            setThreejsHsvGradientHue = (hue: number) => {
                if (valueGradientShaderMaterial.uniforms.hue.value != hue) {
                    valueGradientShaderMaterial.uniforms.hue.value = hue;
                    valueGradientRenderer.render(valueGradientScene, valueGradientCamera);
                }
            };

            // Create assets for hue

            let hueGradientCanvas = okhsvHueSliderCanvas.value!;
            let hueGradientCanvasClientRect = hueGradientCanvas.getBoundingClientRect();
            hueGradientCanvas.width = hueGradientCanvasClientRect.width;
            hueGradientCanvas.height = hueGradientCanvasClientRect.height;

            let hueGradientRenderer = new WebGLRenderer({
                alpha: true,
                canvas: hueGradientCanvas,
                premultipliedAlpha: false,
                preserveDrawingBuffer: true,
                powerPreference: 'high-performance',
            });
            hueGradientRenderer.setClearColor(0x000000, 0);
            hueGradientRenderer.outputEncoding = sRGBEncoding;
            hueGradientRenderer.setSize(hueGradientCanvas.width, hueGradientCanvas.height, false);

            let hueGradientScene = new Scene();

            let hueGradientCamera = new OrthographicCamera(0, hueGradientCanvas.width, 0, hueGradientCanvas.height, 0.1, 10000);
            hueGradientCamera.position.z = 1;
            hueGradientCamera.updateProjectionMatrix();

            let hueSliderContainerClientRect = hueSliderContainer.value!.getBoundingClientRect();
            let hueSliderClientRect = hueSlider.value!.$el.getBoundingClientRect();

            let hueGradientShaderMaterial = new ShaderMaterial({
                transparent: true,
                vertexShader: okhsvGradientMaterialVertexShader,
                fragmentShader: okhsvGradientMaterialFragmentShader,
                side: DoubleSide,
                defines: {
                    cGradientType: 1,
                },
                uniforms: {
                    horizontalBorderPercentage: { value: Math.abs(hueSliderContainerClientRect.left - hueSliderClientRect.left) / hueSliderContainerClientRect.width },
                },
            });

            let hueGradientImageGeometry = new ImagePlaneGeometry(hueGradientCanvas.width, hueGradientCanvas.height);

            let hueGradientImagePlane = new Mesh(hueGradientImageGeometry, hueGradientShaderMaterial);
            hueGradientScene.add(hueGradientImagePlane);

            hueGradientRenderer.render(hueGradientScene, hueGradientCamera);

            hueGradientScene.clear();
            hueGradientRenderer.dispose();
            hueGradientShaderMaterial.dispose();
            hueGradientImageGeometry.dispose();

            (hueGradientCanvasClientRect as unknown) = undefined;
            (hueGradientCanvas as unknown) = undefined;
            (hueGradientRenderer as unknown) = undefined;
            (hueGradientImageGeometry as unknown) = undefined;
            (hueGradientImagePlane as unknown) = undefined;
            (hueGradientScene as unknown) = undefined;
            (hueGradientCamera as unknown) = undefined;
            (hueSliderContainerClientRect as unknown) = undefined;
            (hueSliderClientRect as unknown) = undefined;

            disposeThreejsAssets = () => {
                valueGradientScene.clear();
                valueGradientRenderer.dispose();
                (valueGradientRenderer as unknown) = undefined;
                valueGradientShaderMaterial.dispose();
                (valueGradientShaderMaterial as unknown) = undefined;
                valueGradientImageGeometry.dispose();
                (valueGradientImageGeometry as unknown) = undefined;
                (valueGradientCamera as unknown) = undefined;
                (valueGradientScene as unknown) = undefined;
                (valueGradientImagePlane as unknown) = undefined;
            };
        }

        function generateOutputColor(): ColorModel {
            const outputColor = convertColorModel(pickedColor.value, outputColorModelName);
            pickedColorOpaqueStyle.value = generateColorStyle({ ...outputColor, alpha: 1 }, outputColorModelName, workingFileStore.state.colorSpace);
            generateColorStyle(outputColor, outputColorModelName, workingFileStore.state.colorSpace);
            pickedColor.value.style = outputColor.style;
            return outputColor;
        }

        function handleSaturationValueGradientChange(event: PointerEvent) {
            pickedColor.value.h = hue.value;
            pickedColor.value.s = Math.min(1, Math.max(0, (event.clientX - saturationValueHandleContainerClientRect.left) / saturationValueHandleContainerClientRect.width));
            pickedColor.value.v = 1 - Math.min(1, Math.max(0, (event.clientY - saturationValueHandleContainerClientRect.top) / saturationValueHandleContainerClientRect.height));
            const outputColor = generateOutputColor();
            setThreejsHsvGradientHue(hue.value);
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
            setThreejsHsvGradientHue(value);

            saturationValueGradientColorStyle.value = createColor('hsva', { h: hue.value, s: 1, v: 1, alpha: 1 }, workingFileStore.state.colorSpace).style;

            const outputColor = generateOutputColor();
            emit('update:modelValue', outputColor);
            emit('input', outputColor);
        }

        function onChangeHueSlider(value: number) {
            pickedColor.value.h = value;
            setThreejsHsvGradientHue(value);
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
            useOkhsv,

            okhsvGradientCanvas,
            okhsvHueSliderCanvas,
            hueSlider,
            hueSliderContainer,
            opacitySliderContainer,
            saturationValueContainer,
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
