<template>
    <div ref="overlay" class="og-canvas-overlay is-full-canvas-area">
        <div ref="eraseBrushContainer" class="og-erase">
            <svg
                width="2"
                height="2"
                viewBox="-.5 -.5 2 2"
                :style="{
                    transform: 'scale(' + brushSize + ',' + brushSize + ')',
                    position: 'absolute',
                    left: cursorHoverPosition.x - 1 + 'px',
                    top: cursorHoverPosition.y - 1 + 'px'
                }"
                xmlns="http://www.w3.org/2000/svg">
                <path :d="brushShape" stroke="#333333" :stroke-width="drawPreviewStrokeWidth / brushSize" fill="transparent"/>
                <path :d="brushShape" stroke="white" :stroke-width="drawPreviewStrokeWidth / brushSize * .8" stroke-dasharray="2%" fill="transparent"/>
            </svg>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, onMounted, onUnmounted, toRefs } from 'vue';
import { brushShape, brushSize, cursorHoverPosition } from '@/canvas/store/erase-brush-state';
import canvasStore from '@/store/canvas';

export default defineComponent({
    name: 'CanvasOverlayEraseBrush',
    setup(props, { emit }) {
        const devicePixelRatio = window.devicePixelRatio || 1;

        const { transform, viewWidth, viewHeight, viewDirty } = toRefs(canvasStore.state);
        const eraseBrushContainer = ref<HTMLDivElement>(null as any);

        const zoom = computed<number>(() => {
            const decomposedTransform = canvasStore.state.decomposedTransform;
            let appliedZoom: number = decomposedTransform.scaleX / devicePixelRatio;
            return appliedZoom;
        });

        const drawPreviewStrokeWidth = computed<number>(() => {
            return 1.25 / zoom.value;
        });

        onMounted(() => {
        });

        onUnmounted(() => {
        });

        return {
            brushShape,
            brushSize,
            eraseBrushContainer,
            cursorHoverPosition,
            drawPreviewStrokeWidth,
            zoom,
        };
    }
});
</script>
