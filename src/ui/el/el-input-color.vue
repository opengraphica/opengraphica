<template>
    <div
        role="button"
        tabindex="0"
        class="el-color-picker el-tooltip__trigger el-tooltip__trigger"
        :aria-label="t('button.pickColor')"
        @click="onPickColor"
    >
        <div class="el-color-picker__trigger">
            <span class="el-color-picker__color">
                <span class="el-color-picker__color-inner" :style="{ backgroundColor: modelValue.style }">
                    <span class="bi bi-chevron-down el-color-picker__icon is-icon-arrow-down"></span>
                </span>
            </span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { type PropType } from 'vue';
import { useI18n } from '@/i18n';

import appEmitter from '@/lib/emitter';

import type { RGBAColor } from '@/types';

const { t } = useI18n();

const props = defineProps({
    modelValue: {
        type: Object as PropType<RGBAColor>,
        required: true,
    },
    isCustomPicker: {
        type: Boolean,
        default: false,
    },
});

const emit = defineEmits(['update:modelValue', 'pick', 'input', 'change']);

function onPickColor() {
    if (props.isCustomPicker) {
        emit('pick');
        return;
    }

    appEmitter.emit('app.dialogs.openFromDock', {
        name: 'color-picker',
        props: {
            color: props.modelValue
        },
        onClose: (event?: any) => {
            if (event?.color) {
                emit('update:modelValue', event.color);
                emit('input', event.color);
                emit('change', event.color);
            }
        }
    });
}
</script>