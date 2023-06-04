<template>
    <div class="ogr-canvas-overlay">
        <div
            ref="canvasBorder"
            class="ogr-canvas-border"
            :style="{
                top: '0px', left: '0px', width: width + 'px', height: height + 'px',
                '--ogr-canvas-border-width': 1 / zoom * 0.0625 + 'rem'
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
