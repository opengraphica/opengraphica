<template>
    <div class="ogr-dock-content">
        <div class="ogr-dock-mobile-edge-padding">
            <app-color-picker-gradient :modelValue="workingColor" @input="workingColor = $event" />
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
            <el-button :aria-label="$t('dock.colorPicker.pickColorFromImage')" class="ml-3" @click="onPickColorFromImage">
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
import { defineComponent, ref, toRef, computed, watch, PropType } from 'vue';
import ElButton from 'element-plus/lib/components/button/index';
import ElDivider from 'element-plus/lib/components/divider/index';
import ElInput from 'element-plus/lib/components/input/index';
import ElLoading from 'element-plus/lib/components/loading/index';
import ElScrollbar from 'element-plus/lib/components/scrollbar/index';
import ElTooltip from 'element-plus/lib/components/tooltip/index';
import AppColorPickerGradient from '@/ui/app-color-picker-gradient.vue';
import { colorToRgba, colorToHex, hexToColor, getColorModelName } from '@/lib/color';
import { ColorModel, ColorModelName, RGBAColor } from '@/types';
import colorNamer from 'color-namer';
import { runModule } from '@/modules';

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
            default: { is: 'color', r: 0, g: 0, b: 0, a: 1, style: '#000000' }
        },
        isDialog: {
            type: Boolean,
            default: false
        }
    },
    emits: [
        'close',
        'update:title'
    ],
    setup(props, { emit }) {
        emit('update:title', 'dock.colorPicker.title');

        const workingColor = ref<RGBAColor>({ is: 'color', r: 0, g: 0, b: 0, a: 1, style: '#000000' });
        let outputColorModelName: ColorModelName = 'rgba';

        const hexCode = ref<string>();
        const colorName = ref<string>();

        watch([toRef(props, 'color')], ([inputColor]) => {
            outputColorModelName = getColorModelName(inputColor);
            workingColor.value = colorToRgba(inputColor, outputColorModelName);
        }, { immediate: true });

        watch([workingColor], () => {
            hexCode.value = colorToHex(workingColor.value, 'rgba');
            colorName.value = colorNamer(hexCode.value, { pick: ['ntc'] }).ntc[0]?.name;
        }, { immediate: true });

        function onChangeHexCode(newHexCode: string) {
            workingColor.value = hexToColor(newHexCode, 'rgba');
        }

        function onPickColorFromImage() {
            runModule('tmp', 'notYetImplemented');
        }

        function onCancel() {
            emit('close');
        }

        function onConfirmSelection() {
            emit('close', { color: JSON.parse(JSON.stringify(workingColor.value)) });
        }

        return {
            workingColor,
            hexCode,
            colorName,
            onChangeHexCode,
            onPickColorFromImage,
            onCancel,
            onConfirmSelection
        };
    }
});
</script>
