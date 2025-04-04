<template>
    <div ref="overlay" class="og-canvas-overlay is-full-canvas-area">
        <div
            ref="drawBoundsContainer"
            class="og-canvas-overlay-draw-bounds"
        >
            <svg
                v-if="boundaryPointsSvgPaths.length > 0"
                :width="boundarySvgWidth"
                :height="boundarySvgHeight"
                :viewBox="`0 0 ${boundarySvgWidth} ${boundarySvgHeight}`"
                :style="{ transform: `translate(${selectedLayerBounds.left}px, ${selectedLayerBounds.top}px)` }"
                xmlns="http://www.w3.org/2000/svg">
                <template v-for="svgPath of boundaryPointsSvgPaths" :key="svgPath">
                    <path :d="svgPath" stroke="#777" :stroke-width="boundaryPointsSvgPathStrokeWidth" fill="transparent"/>
                    <path :d="svgPath" stroke="white" :stroke-width="boundaryPointsSvgPathStrokeWidth" :stroke-dasharray="boundaryPointsSvgPathStrokeWidth * 4" fill="transparent"/>
                </template>
            </svg>
        </div>
        <div ref="drawBrushContainer" class="og-canvas-overlay-draw-brush">
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
import { brushShape, brushSize, cursorHoverPosition } from '@/canvas/store/draw-brush-state';

import { Clipper, PolyType, ClipType, Path, Paths, PolyFillType } from '@/lib/clipper';
import { findPointListBounds } from '@/lib/math';

import canvasStore from '@/store/canvas';
import workingFileStore, { getSelectedLayers, getLayerBoundingPoints } from '@/store/working-file';

export default defineComponent({
    name: 'CanvasOverlayDrawBrush',
    setup(props, { emit }) {
        const devicePixelRatio = window.devicePixelRatio || 1;

        const drawBrushContainer = ref<HTMLDivElement>(null as any);

        const selectedLayerBoundaryPoints = ref<DOMPoint[][]>([]);
        const selectedLayerBounds = ref<ReturnType<typeof findPointListBounds>>({ left: 0, right: 1, top: 0, bottom: 1 });

        const zoom = computed<number>(() => {
            const decomposedTransform = canvasStore.state.decomposedTransform;
            let appliedZoom: number = decomposedTransform.scaleX / devicePixelRatio;
            return appliedZoom;
        });

        const boundarySvgWidth = computed<number>(() => {
            return selectedLayerBounds.value.right - selectedLayerBounds.value.left;
        });
        const boundarySvgHeight = computed<number>(() => {
            return selectedLayerBounds.value.bottom - selectedLayerBounds.value.top;
        });

        const drawPreviewStrokeWidth = computed<number>(() => {
            return 1.25 / zoom.value;
        });

        const boundaryPointsSvgPaths = computed(() => {
            const svgPaths: string[] = [];
            for (const path of selectedLayerBoundaryPoints.value) {
                const transformedPoints = path.map((point) => {
                    return point.matrixTransform(new DOMMatrix().translateSelf(
                        -selectedLayerBounds.value.left,
                        -selectedLayerBounds.value.top
                    ));
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
            return svgPaths;
        });

        const boundaryPointsSvgPathStrokeWidth = computed<number>(() => {
            return (1 / zoom.value);
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

        onMounted(() => {
        });

        onUnmounted(() => {
        });

        return {
            brushShape,
            brushSize,
            drawBrushContainer,
            cursorHoverPosition,
            drawPreviewStrokeWidth,

            boundarySvgWidth,
            boundarySvgHeight,
            boundaryPointsSvgPaths,
            boundaryPointsSvgPathStrokeWidth,
            selectedLayerBounds,

            zoom,
        };
    }
});
</script>
