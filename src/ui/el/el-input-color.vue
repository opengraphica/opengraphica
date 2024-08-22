<template>
    <div
        role="button"
        tabindex="0"
        class="el-color-picker el-tooltip__trigger el-tooltip__trigger"
        :aria-label="$t('button.pickColor')"
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

<script lang="ts">
import { defineComponent, ref, watch, PropType, onMounted, nextTick } from 'vue';

import appEmitter from '@/lib/emitter';

export default defineComponent({
    name: 'ElInputColor',
    props: {
        modelValue: {
            type: Object
        }
    },
    emits: ['update:modelValue'],
    setup(props, { emit }) {

        function onPickColor() {
            appEmitter.emit('app.dialogs.openFromDock', {
                name: 'color-picker',
                props: {
                    color: props.modelValue
                },
                onClose: (event?: any) => {
                    if (event?.color) {
                        emit('update:modelValue', event.color);
                    }
                }
            });
        }

        return {
            onPickColor,
        };

    }
});
</script>