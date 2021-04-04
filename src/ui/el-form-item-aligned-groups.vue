<template>
    <div ref="el" class="el-form-item-aligned-groups">
        <slot />
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, nextTick } from 'vue';

export default defineComponent({
    name: 'ElFormItemAlignedGroups',
    setup(props, { emit }) {
        const el = ref<HTMLDivElement>();

        onMounted(async () => {
            if (el.value) {
                await nextTick();
                const groups = el.value.querySelectorAll<HTMLDivElement>('.el-form-item-group');
                groups.forEach((group) => {
                    group.style.setProperty('--label-min-width', '0px');
                });
                let minWidth = 0;
                el.value.querySelectorAll<HTMLLabelElement>('.el-form-item > .el-form-item__label').forEach((label) => {
                    if (label.offsetWidth > minWidth) {
                        minWidth = label.offsetWidth;
                    }
                });
                groups.forEach((group) => {
                    group.style.setProperty('--label-min-width', minWidth + 'px');
                });
            }
        });

        return {
            el
        };
    }
});
</script>
