<template>
    <div ref="overlay" class="og-canvas-overlay is-full-canvas-area">
        <div ref="selectionContainer" class="og-selection">
            <svg
                v-if="editControlPoints.length > 0"
                :width="svgBoundsWidth"
                :height="svgBoundsHeight"
                xmlns="http://www.w3.org/2000/svg">
                <template v-for="(point, i) in editControlPoints" :key="i + '_' + point.x + '_' + point.y">
                    <template v-if="point.attachToIndex == null">
                        <rect
                            :x="point.tx! - (svgHandleWidth * 1.4)"
                            :y="point.ty! - (svgHandleWidth * 1.4)"
                            :width="svgHandleWidth * 2.8"
                            :height="svgHandleWidth * 2.8"
                            :stroke-width="0"
                            :class="{ 'og-selection-handle--selected': selectedEditControlPointIndices.includes(i) }"
                        />
                        <rect
                            :x="point.tx! - (svgHandleWidth)"
                            :y="point.ty! - (svgHandleWidth)"
                            :width="svgHandleWidth * 2"
                            :height="svgHandleWidth * 2"
                            :stroke-width="svgHandleWidth * .3"
                            :class="{ 'og-selection-handle--selected': selectedEditControlPointIndices.includes(i) }"
                        />
                    </template>
                    <template v-else-if="selectedEditControlPointIndices.includes(point.attachToIndex)">
                        <circle
                            :cx="point.tx!"
                            :cy="point.ty!"
                            :r="svgHandleWidth * 1.6"
                            :stroke-width="0"
                        />
                        <circle
                            :cx="point.tx!"
                            :cy="point.ty!"
                            :r="svgHandleWidth * 1.2"
                            :stroke-width="svgHandleWidth * .3"
                        />
                    </template>
                </template>
            </svg>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, toRefs } from 'vue';

import canvasStore from '@/store/canvas';
import workingFileStore, { getSelectedLayers, getLayerGlobalTransform } from '@/store/working-file';

import { editControlPoints, editControlPointsDirty, selectedEditControlPointIndices } from '@/canvas/store/draw-shape-state';

defineOptions({
    name: 'CanvasOverlayDrawShape',
});

const { transform, viewWidth, viewHeight, viewDirty } = toRefs(canvasStore.state);

const devicePixelRatio = window.devicePixelRatio || 1;

const zoom = computed<number>(() => {
    const decomposedTransform = canvasStore.state.decomposedTransform;
    let appliedZoom: number = decomposedTransform.scaleX;
    return appliedZoom / devicePixelRatio;
});

const svgHandleWidth = computed<number>(() => {
    return 5;
});
const svgBoundsWidth = computed<number>(() => {
    return viewWidth.value / devicePixelRatio;
});
const svgBoundsHeight = computed<number>(() => {
    return viewHeight.value / devicePixelRatio;
});

onMounted(() => {
});

onUnmounted(() => {
});

watch([editControlPoints, viewDirty, editControlPointsDirty], () => {
    editControlPointsDirty.value = false;
    for (const point of editControlPoints.value) {
        const position = new DOMPoint(point.x, point.y).matrixTransform(transform.value);
        point.tx = position.x / devicePixelRatio;
        point.ty = position.y / devicePixelRatio;
    }
});

</script>
