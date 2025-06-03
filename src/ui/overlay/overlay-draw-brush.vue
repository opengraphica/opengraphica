<template>
    <div ref="overlay" class="og-canvas-overlay is-full-canvas-area">
        <div
            ref="drawBoundsContainer"
            class="og-canvas-overlay-draw-bounds"
        >
            <svg
                v-if="selectedLayerSvgPaths.length > 0"
                :width="svgBoundsWidth"
                :height="svgBoundsHeight"
                :viewBox="`0 0 ${svgBoundsWidth} ${svgBoundsHeight}`"
                xmlns="http://www.w3.org/2000/svg"
            >
                <template v-for="svgPath of selectedLayerSvgPaths" :key="svgPath">
                    <path :d="svgPath" stroke="#777" :stroke-width="svgPathStrokeWidth" fill="transparent"/>
                    <path :d="svgPath" stroke="white" :stroke-width="svgPathStrokeWidth" :stroke-dasharray="svgPathStrokeDashArray" fill="transparent"/>
                </template>
            </svg>
        </div>
        <div ref="drawBrushContainer" class="og-canvas-overlay-draw-brush">
            <svg
                width="2"
                height="2"
                viewBox="-.5 -.5 2 2"
                :style="{
                    transform: 'scale(' + brushSize * zoom + ',' + brushSize * zoom + ')',
                    position: 'absolute',
                    left: transformedCursorHoverX - 1 + 'px',
                    top: transformedCursorHoverY - 1 + 'px'
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
import { brushShape, brushSize, cursorHoverPosition } from '@/canvas/store/draw-brush-state';

import { Clipper, PolyType, ClipType, Path, Paths, PolyFillType } from '@/lib/clipper';
import { findPointListBounds } from '@/lib/math';

import canvasStore from '@/store/canvas';
import workingFileStore, { getSelectedLayers, getLayerBoundingPoints } from '@/store/working-file';

export default defineComponent({
    name: 'CanvasOverlayDrawBrush',
    setup(props, { emit }) {
        const devicePixelRatio = window.devicePixelRatio || 1;

        const { transform, viewWidth, viewHeight, viewDirty } = toRefs(canvasStore.state);

        const drawBrushContainer = ref<HTMLDivElement>(null as any);
        const transformedCursorHoverX = ref(0);
        const transformedCursorHoverY = ref(0);

        const selectedLayerBoundaryPoints = ref<DOMPoint[][]>([]);
        const selectedLayerBounds = ref<ReturnType<typeof findPointListBounds>>({ left: 0, right: 1, top: 0, bottom: 1 });
        const selectedLayerSvgPaths = ref<string[]>([]);

        const zoom = computed<number>(() => {
            const decomposedTransform = canvasStore.state.decomposedTransform;
            let appliedZoom: number = decomposedTransform.scaleX / devicePixelRatio;
            return appliedZoom;
        });

        const svgBoundsWidth = computed<number>(() => {
            return viewWidth.value / devicePixelRatio;
        });
        const svgBoundsHeight = computed<number>(() => {
            return viewHeight.value / devicePixelRatio;
        });
        const svgPathStrokeWidth = computed<number>(() => {
            return 1;
        });
        const svgPathStrokeDashArray = computed<number>(() => {
            // Don't allow this number to get too small at high zoom levels because it tanks performance.
            const decomposedTransform = canvasStore.state.decomposedTransform;
            let appliedZoom: number = decomposedTransform.scaleX / devicePixelRatio;
            return Math.max(svgPathStrokeWidth.value * 4, Math.round(appliedZoom));
        });

        const drawPreviewStrokeWidth = computed<number>(() => {
            return 1.25 / zoom.value;
        });

        watch(() => workingFileStore.state.selectedLayerIds, () => {
            const layers = getSelectedLayers();
            
            if (layers.length > 0) {
                const clipper = new Clipper();
                for (const [layerIndex, layer] of layers.entries()) {
                    const path = getLayerBoundingPoints(layer).map((point) => ({ X: point.x, Y: point.y }));
                    clipper.AddPath(path, layerIndex === 0 ? PolyType.ptSubject : PolyType.ptClip, true);
                }
                const solution: Paths = [];
                clipper.Execute(ClipType.ctUnion, solution, PolyFillType.pftEvenOdd, PolyFillType.pftEvenOdd);

                selectedLayerBoundaryPoints.value = solution.map((solutions) => {
                    return solutions.map(({ X, Y }) => new DOMPoint(X, Y));
                });
            } else {
                selectedLayerBoundaryPoints.value = [];
            }
            const bounds = findPointListBounds(selectedLayerBoundaryPoints.value.flat());
            bounds.left -= 10;
            bounds.right += 10;
            bounds.top -= 10;
            bounds.bottom += 10;
            selectedLayerBounds.value = bounds;
        }, { immediate: true });

        watch([selectedLayerBounds, selectedLayerBoundaryPoints, viewDirty], () => {
            const svgPaths: string[] = [];
            for (const path of selectedLayerBoundaryPoints.value) {
                const transformedPoints = path.map((point) => {
                    return point.matrixTransform(new DOMMatrix().scale(1 / devicePixelRatio).multiply(transform.value));
                });
                if (transformedPoints.length > 1) {
                    let draw = 'M' + transformedPoints[0].x + ' ' + transformedPoints[0].y;
                    for (let i = 1; i < transformedPoints.length; i++) {
                        const point = transformedPoints[i];
                        draw += ' L ' + point.x + ' ' + point.y;
                    }
                    draw += ' z';
                    svgPaths.push(draw);
                }
            }
            selectedLayerSvgPaths.value = svgPaths;
        });

        watch([cursorHoverPosition], () => {
            const point = cursorHoverPosition.value.matrixTransform(
                new DOMMatrix().scale(1 / devicePixelRatio).multiply(transform.value)
            );
            transformedCursorHoverX.value = point.x;
            transformedCursorHoverY.value = point.y;
        });

        onMounted(() => {
        });

        onUnmounted(() => {
        });

        return {
            brushShape,
            brushSize,
            drawBrushContainer,
            transformedCursorHoverX,
            transformedCursorHoverY,
            drawPreviewStrokeWidth,

            svgBoundsWidth,
            svgBoundsHeight,
            svgPathStrokeDashArray,
            svgPathStrokeWidth,
            selectedLayerSvgPaths,
            selectedLayerBounds,

            zoom,
        };
    }
});
</script>
