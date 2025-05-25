<template>
    <div ref="canvasContainer" v-pre>
    </div>
</template>
<script setup lang="ts">
import { onMounted, ref, watch, type PropType } from 'vue';

const props = defineProps({
    canvas: {
        type: Object as PropType<HTMLCanvasElement>,
    },
});

const canvasContainer = ref();

watch(() => props.canvas, (canvas) => {
    if (!canvasContainer.value) return;
    canvasContainer.value.innerHTML = '';
    if (canvas) {
        canvasContainer.value.appendChild(canvas);
    }
});

onMounted(() => {
    if (props.canvas) {
        canvasContainer.value.appendChild(props.canvas);
    }
});
</script>