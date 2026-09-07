<template>
    <div ref="overlay" class="og-canvas-overlay is-full-canvas-area">
        <div ref="eraseBrushContainer" class="og-canvas-overlay-erase-brush">
            <svg
                width="2"
                height="2"
                viewBox="-.5 -.5 2 2"
                :style="{
                    transform: `rotate(${cursorHoverAngle}rad) scale(${brushSize * zoom},${brushSize * zoom})`,
                    position: 'absolute',
                    left: transformedCursorHoverX - 1 + 'px',
                    top: transformedCursorHoverY - 1 + 'px'
                }"
                xmlns="http://www.w3.org/2000/svg">
                <path :d="brushShapePath" stroke="#333333" :stroke-width="drawPreviewStrokeWidth / brushSize" fill="transparent"/>
                <path :d="brushShapePath" stroke="white" :stroke-width="drawPreviewStrokeWidth / brushSize * .8" stroke-dasharray="2%" fill="transparent"/>
            </svg>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, toRefs, watch } from 'vue';
import { brushShapePath, brushSize, cursorHoverPosition, cursorHoverAngle } from '@/canvas/store/erase-brush-state';
import canvasStore from '@/store/canvas';

const devicePixelRatio = window.devicePixelRatio || 1;

const { transform } = toRefs(canvasStore.state);

const transformedCursorHoverX = ref(0);
const transformedCursorHoverY = ref(0);

const zoom = computed<number>(() => {
    const decomposedTransform = canvasStore.state.decomposedTransform;
    let appliedZoom: number = decomposedTransform.scaleX / devicePixelRatio;
    return appliedZoom;
});

const drawPreviewStrokeWidth = computed<number>(() => {
    return 1.25 / zoom.value;
});

watch([cursorHoverPosition], () => {
    const point = cursorHoverPosition.value.matrixTransform(
        new DOMMatrix().scale(1 / devicePixelRatio).multiply(transform.value)
    );
    transformedCursorHoverX.value = point.x;
    transformedCursorHoverY.value = point.y;
});
</script>
