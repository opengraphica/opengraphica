<template>
    <div ref="overlay" class="og-canvas-overlay is-full-canvas-area">
        <div ref="selectionContainer" class="og-selection">
            <svg
                v-if="editControlPoints.length > 0 || previewInvisibleStrokeStart != null"
                :width="svgBoundsWidth"
                :height="svgBoundsHeight"
                xmlns="http://www.w3.org/2000/svg">
                <template v-for="(point, i) in selectedEditControlAttachPoints" :key="i + '_' + point.x + '_' + point.y">
                    <line
                        :x1="editControlPoints[point.attachToIndex!].tx!"
                        :y1="editControlPoints[point.attachToIndex!].ty!"
                        :x2="point.tx!"
                        :y2="point.ty!"
                        :style="{
                            stroke: 'white', 
                            strokeWidth: svgHandleWidth,
                        }"
                    />
                    <line
                        :x1="editControlPoints[point.attachToIndex!].tx!"
                        :y1="editControlPoints[point.attachToIndex!].ty!"
                        :x2="point.tx!"
                        :y2="point.ty!"
                        :style="{
                            stroke: '#333333', 
                            strokeWidth: svgHandleWidth * 0.5,
                        }"
                    />
                </template>
                <template v-if="previewInvisibleStrokeStart != null">
                    <line
                        :x1="transformedPreviewInvisibleStrokeStartX"
                        :y1="transformedPreviewInvisibleStrokeStartY"
                        :x2="transformedCursorHoverX"
                        :y2="transformedCursorHoverY"
                        :style="{
                            stroke: 'white', 
                            strokeWidth: svgHandleWidth,
                        }"
                    />
                    <line
                        :x1="transformedPreviewInvisibleStrokeStartX"
                        :y1="transformedPreviewInvisibleStrokeStartY"
                        :x2="transformedCursorHoverX"
                        :y2="transformedCursorHoverY"
                        :style="{
                            stroke: '#333333', 
                            strokeWidth: svgHandleWidth * 0.5,
                        }"
                    />
                </template>
                <template v-if="isExtendingPaths && hoveringEditControlPointIndices.length === 0">
                    <template v-for="(point, i) of selectedEditControlPoints" :key="i + '_' + point.x + '_' + point.y">
                        <line
                            :x1="point.tx!"
                            :y1="point.ty!"
                            :x2="transformedCursorHoverX"
                            :y2="transformedCursorHoverY"
                            :style="{
                                stroke: 'white', 
                                strokeWidth: svgHandleWidth,
                            }"
                        />
                        <line
                            :x1="point.tx!"
                            :y1="point.ty!"
                            :x2="transformedCursorHoverX"
                            :y2="transformedCursorHoverY"
                            :style="{
                                stroke: '#333333', 
                                strokeWidth: svgHandleWidth * 0.5,
                            }"
                        />
                    </template>
                </template>
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
                        <rect
                            v-if="point.isLast"
                            :x="point.tx! - (svgHandleWidth * 0.5)"
                            :y="point.ty! - (svgHandleWidth * 0.5)"
                            :width="svgHandleWidth * 1"
                            :height="svgHandleWidth * 1"
                            :stroke-width="0"
                            style="fill: black"
                        />
                    </template>
                    <template v-else-if="selectedEditControlAttachPointIndices.includes(i)">
                        <circle
                            :cx="point.tx!"
                            :cy="point.ty!"
                            :r="svgHandleWidth * 1.6"
                            :stroke-width="0"
                            :class="{ 'og-selection-handle--selected': selectedEditControlPointIndices.includes(i) }"
                        />
                        <circle
                            :cx="point.tx!"
                            :cy="point.ty!"
                            :r="svgHandleWidth * 1.2"
                            :stroke-width="svgHandleWidth * .3"
                            :class="{ 'og-selection-handle--selected': selectedEditControlPointIndices.includes(i) }"
                        />
                    </template>
                </template>
            </svg>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, toRefs, watch } from 'vue';

import canvasStore from '@/store/canvas';
import workingFileStore from '@/store/working-file';

import {
    cursorHoverPosition, isExtendingPaths, previewInvisibleStrokeStart,
    editControlPoints, editControlPointsDirty,
    hoveringEditControlPointIndices,
    selectedEditControlPointIndices, selectedEditControlAttachPointIndices,
} from '@/canvas/store/draw-shape-state';

defineOptions({
    name: 'CanvasOverlayDrawShape',
});

const { transform, viewWidth, viewHeight, viewDirty } = toRefs(canvasStore.state);

const transformedCursorHoverX = ref(0);
const transformedCursorHoverY = ref(0);
const transformedPreviewInvisibleStrokeStartX = ref(0);
const transformedPreviewInvisibleStrokeStartY = ref(0);

const devicePixelRatio = window.devicePixelRatio || 1;

const zoom = computed<number>(() => {
    const decomposedTransform = canvasStore.state.decomposedTransform;
    let appliedZoom: number = decomposedTransform.scaleX;
    return appliedZoom / devicePixelRatio;
});

const svgHandleWidth = computed<number>(() => {
    const zoomRatio = Math.max(workingFileStore.get('width'), workingFileStore.get('height')) / 100;
    return Math.min(5, zoom.value * zoomRatio);
});
const svgBoundsWidth = computed<number>(() => {
    return viewWidth.value / devicePixelRatio;
});
const svgBoundsHeight = computed<number>(() => {
    return viewHeight.value / devicePixelRatio;
});

const selectedEditControlPoints = computed(() => {
    return selectedEditControlPointIndices.value.map(
        (index) => editControlPoints.value[index]
    ).filter((point) => point.attachToIndex == null);
});

const selectedEditControlAttachPoints = computed(() => {
    return selectedEditControlAttachPointIndices.value.map((index) => editControlPoints.value[index]);
});

watch([editControlPoints, viewDirty, editControlPointsDirty], () => {
    editControlPointsDirty.value = false;
    for (const point of editControlPoints.value) {
        const position = new DOMPoint(point.x, point.y).matrixTransform(transform.value);
        point.tx = position.x / devicePixelRatio;
        point.ty = position.y / devicePixelRatio;
    }
});

watch([cursorHoverPosition], () => {
    const point = cursorHoverPosition.value.matrixTransform(
        new DOMMatrix().scale(1 / devicePixelRatio).multiply(transform.value)
    );
    transformedCursorHoverX.value = point.x;
    transformedCursorHoverY.value = point.y;

});

watch([previewInvisibleStrokeStart], () => {
    if (!previewInvisibleStrokeStart.value) return;
    const point = previewInvisibleStrokeStart.value.matrixTransform(
        new DOMMatrix().scale(1 / devicePixelRatio).multiply(transform.value)
    );
    transformedPreviewInvisibleStrokeStartX.value = point.x;
    transformedPreviewInvisibleStrokeStartY.value = point.y;
});
</script>
