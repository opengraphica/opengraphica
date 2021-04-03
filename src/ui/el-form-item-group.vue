<template>
    <div ref="el" class="el-form-item-group">
        <slot />
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, nextTick } from 'vue';

export default defineComponent({
    name: 'ElFormItemGroup',
    setup(props, { emit }) {
        const el = ref<HTMLDivElement>();

        onMounted(async () => {
            if (el.value) {
                await nextTick();
                el.value.style.setProperty('--label-min-width', '0px');
                let minWidth = 0;
                el.value.querySelectorAll<HTMLLabelElement>('.el-form-item > .el-form-item__label').forEach((label) => {
                    if (label.offsetWidth > minWidth) {
                        minWidth = label.offsetWidth;
                    }
                });
                el.value.style.setProperty('--label-min-width', minWidth + 'px');
            }
        });

        return {
            el
        };
    }
});
</script>
