<template>
    <div ref="overlay" class="ogr-canvas-overlay is-full-canvas-area">
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, onMounted, onUnmounted, toRefs } from 'vue';

import canvasStore from '@/store/canvas';
import workingFileStore, { getSelectedLayers } from '@/store/working-file';

export default defineComponent({
    name: 'CanvasOverlayDrawGradient',
    setup(props, { emit }) {
        const devicePixelRatio = window.devicePixelRatio || 1;

        const zoom = computed<number>(() => {
            const decomposedTransform = canvasStore.state.decomposedTransform;
            let appliedZoom: number = decomposedTransform.scaleX / devicePixelRatio;
            return appliedZoom;
        });

        const controlHandleSize = computed<number>(() => {
            return 1.25 / zoom.value;
        });

        onMounted(() => {
        });

        onUnmounted(() => {
        });

        return {
            controlHandleSize,

            zoom,
        };
    }
});
</script>
