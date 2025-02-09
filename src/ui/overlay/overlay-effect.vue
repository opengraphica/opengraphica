<template>
    <div ref="overlay" class="ogr-canvas-overlay is-full-canvas-area">
        <div
            ref="drawBoundsContainer"
            class="ogr-canvas-overlay-draw-bounds"
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
                    <path :d="svgPath" stroke="white" :stroke-width="svgPathStrokeWidth" :stroke-dasharray="svgPathStrokeWidth * 4" fill="transparent"/>
                </template>
            </svg>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, onMounted, onUnmounted, toRefs } from 'vue';

import { Clipper, PolyType, ClipType, Paths, PolyFillType } from '@/lib/clipper';
import { findPointListBounds } from '@/lib/math';

import canvasStore from '@/store/canvas';
import workingFileStore, { getSelectedLayers, getLayerBoundingPoints } from '@/store/working-file';

export default defineComponent({
    name: 'CanvasOverlayEffect',
    setup(props, { emit }) {
        const devicePixelRatio = window.devicePixelRatio || 1;

        const { transform, viewWidth, viewHeight, viewDirty } = toRefs(canvasStore.state);

        const selectedLayerBoundaryPoints = ref<DOMPoint[][]>([]);
        const selectedLayerBounds = ref<ReturnType<typeof findPointListBounds>>({ left: 0, right: 1, top: 0, bottom: 1 });
        const selectedLayerSvgPaths = ref<string[]>([]);

        const svgBoundsWidth = computed<number>(() => {
            return viewWidth.value / devicePixelRatio;
        });
        const svgBoundsHeight = computed<number>(() => {
            return viewHeight.value / devicePixelRatio;
        });
        const svgPathStrokeWidth = computed<number>(() => {
            return 1;
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

        onMounted(() => {
        });

        onUnmounted(() => {
        });

        return {
            svgBoundsWidth,
            svgBoundsHeight,
            svgPathStrokeWidth,
            selectedLayerSvgPaths,
        };
    }
});
</script>
