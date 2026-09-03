<template>
    <div ref="el" class="el-form-item-group">
        <slot />
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';

const el = ref<HTMLDivElement>();

const slotObserver = new MutationObserver(calculateLabelMinWidth);

onMounted(async () => {
    if (el.value) {
        slotObserver.observe(el.value, {
            childList: true
        });
    }
    calculateLabelMinWidth();
});

onUnmounted(async () => {
    slotObserver.disconnect();
});

async function calculateLabelMinWidth() {
    if (el.value) {
        await nextTick();
        el.value.style.setProperty('--label-min-width', '0px');
        let minWidth = 0;
        el.value.querySelectorAll<HTMLLabelElement>('.el-form-item > .el-form-item__label').forEach((label) => {
            if (label.offsetWidth > minWidth) {
                minWidth = label.offsetWidth + 1;
            }
        });
        el.value.style.setProperty('--label-min-width', minWidth + 'px');
    }
}

defineExpose({
    calculateLabelMinWidth,
});
</script>
