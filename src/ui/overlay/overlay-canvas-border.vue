<template>
    <div class="og-canvas-overlay">
        <div
            ref="canvasBorder"
            class="og-canvas-border"
            :style="{
                position: 'absolute',
                top: '-0.5px', left: '-0.5px', width: width + 'px', height: height + 'px',
                '--og-canvas-border-width': 1 / zoom * 0.0625 + 'rem'
            }"
        >
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, watch, toRefs } from 'vue';
import canvasStore from '@/store/canvas';
import workingFileStore from '@/store/working-file';

export default defineComponent({
    name: 'CanvasOverlayCanvasBorder',
    emits: [
    ],
    props: {
    },
    setup(props, { emit }) {
        const zoom = ref<number>(1);
        const { width, height } = toRefs(workingFileStore.state);

        watch(() => canvasStore.state.decomposedTransform, (decomposedTransform) => {
            let appliedZoom = decomposedTransform.scaleX / window.devicePixelRatio;
            if (appliedZoom !== zoom.value) {
                zoom.value = appliedZoom;
            }
        }, { immediate: true });

        return {
            zoom,
            width,
            height,
        };
    }
});
</script>
