<template>
    <div class="og-canvas-overlay">
        <div
            ref="drawBoundsContainer"
            class="og-canvas-overlay-draw-bounds"
        >
            <svg
                :width="svgBoundsWidth"
                :height="svgBoundsHeight"
                :viewBox="`0 0 ${svgBoundsWidth} ${svgBoundsHeight}`"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path :d="svgPath" stroke="#dfdfdf" :stroke-width="svgPathStrokeWidth" fill="transparent"/>
            </svg>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, ref, watch, toRefs } from 'vue';
import canvasStore from '@/store/canvas';
import workingFileStore from '@/store/working-file';

const { transform, viewWidth, viewHeight, viewDirty } = toRefs(canvasStore.state);

const svgPath = ref('');

const svgBoundsWidth = computed<number>(() => {
    return viewWidth.value / devicePixelRatio;
});
const svgBoundsHeight = computed<number>(() => {
    return viewHeight.value / devicePixelRatio;
});

const imageBoundaryPoints = computed(() => {
    return [
        new DOMPoint(0, 0),
        new DOMPoint(workingFileStore.state.width, 0),
        new DOMPoint(workingFileStore.state.width, workingFileStore.state.height),
        new DOMPoint(0, workingFileStore.state.height),
    ];
});

watch([svgBoundsWidth, svgBoundsHeight, viewDirty], () => {
    if (imageBoundaryPoints.value.length > 1) {
        const firstPoint = imageBoundaryPoints.value[0].matrixTransform(new DOMMatrix().scale(1 / devicePixelRatio).multiply(transform.value));
        let draw = 'M' + firstPoint.x + ' ' + firstPoint.y;
        for (let i = 1; i < imageBoundaryPoints.value.length; i++) {
            const point = imageBoundaryPoints.value[i].matrixTransform(new DOMMatrix().scale(1 / devicePixelRatio).multiply(transform.value));
            draw += ' L ' + point.x + ' ' + point.y;
        }
        draw += ' z';
        svgPath.value = draw;
    }
});

</script>