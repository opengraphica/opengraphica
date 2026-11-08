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
        <div ref="drawBrushContainer" class="og-canvas-overlay-draw-brush" dir="ltr">
            <svg
                width="2"
                height="2"
                viewBox="-.5 -.5 2 2"
                :style="{
                    transform: `rotate(${cursorHoverAngle}rad) scale(${brushSize * zoom},${brushSize * zoom})`,
                    position: 'absolute',
                    left: transformedSourceX - 1 + 'px',
                    top: transformedSourceY - 1 + 'px'
                }"
                xmlns="http://www.w3.org/2000/svg">
                <path :d="brushShape" stroke="#ffffff" :stroke-width="drawPreviewStrokeWidth / brushSize * 3" fill="transparent"/>
                <path :d="brushShape" stroke="#333333" :stroke-width="drawPreviewStrokeWidth / brushSize" fill="transparent"/>
                <g style="transform: translate(0.3px, 0.28px) scale(0.0008)">
                    <path
                        d="M 493.79371,440.00095 H 18.143217 c -7.134814,0 -11.8913568,4.75654 -11.8913568,11.89136 v 47.56543 c 0,7.13481 4.7565428,11.89135 11.8913568,11.89135 H 493.79371 c 7.13482,0 11.89136,-4.75654 11.89136,-11.89135 v -47.56543 c 0,-7.13482 -4.75654,-11.89136 -11.89136,-11.89136 z"
                        style="stroke:#ffffff;stroke-width:20;fill:#333333" />
                    <path
                        d="M 256.18212,0.45117188 C 192.01129,0.45091314 139.99053,53.045539 139.99094,117.92412 c -1.4e-4,41.25372 25.24788,79.05697 55.96,103.7077 l 0.42717,75.49378 c -69.46924,-0.11226 -126.989203,-0.21609 -129.005266,-0.21609 -8.116263,0 -9.824679,-0.42692 -13.669224,7.26218 -3.844546,7.68909 -47.8432083,100.38504 -47.8432083,100.38504 0,0 -2.5640913,11.10566 9.8238893,11.10566 8.554107,0 471.169359,-0.37387 480.142349,0 10.25212,0.42718 10.67797,-8.54316 8.54211,-13.66922 -2.13586,-5.12606 -42.86649,-90.06091 -46.13478,-96.96819 -3.76622,-7.9596 -3.41738,-8.11599 -14.95101,-7.68882 -2.64848,0.0981 -58.99546,0.0552 -127.29685,-0.0333 l -0.42717,-75.67109 C 347.55258,198.26255 372.37343,159.1778 372.37329,117.92407 372.3737,53.045543 320.35294,0.45091843 256.18212,0.45117188 Z"
                        style="stroke:#ffffff;stroke-width:20;fill:#333333" />
                </g>
            </svg>
            <svg
                v-if="!cursorIsHoveringSource"
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
                <path :d="brushShape" stroke="#333333" :stroke-width="drawPreviewStrokeWidth / brushSize" fill="transparent"/>
                <path :d="brushShape" stroke="white" :stroke-width="drawPreviewStrokeWidth / brushSize * .8" stroke-dasharray="2%" fill="transparent"/>
            </svg>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, toRefs } from 'vue';
import {
    brushShape, brushSize, cursorHoverPosition, cursorHoverAngle,
    sourceX, sourceY, sourceDrawingOffsetX, sourceDrawingOffsetY, cursorIsHoveringSource,
} from '@/canvas/store/clone-brush-state';

import { Clipper, PolyType, ClipType, Paths, PolyFillType } from '@/lib/clipper';
import appEmitter, { type AppEmitterEvents } from '@/lib/emitter';
import { findPointListBounds } from '@/lib/math';

import canvasStore from '@/store/canvas';
import workingFileStore, { getSelectedLayers, getLayerBoundingPoints } from '@/store/working-file';

const devicePixelRatio = window.devicePixelRatio || 1;

const { decomposedTransform, transform, viewWidth, viewHeight, viewDirty } = toRefs(canvasStore.state);

const transformedCursorHoverX = ref(0);
const transformedCursorHoverY = ref(0);

const transformedSourceX = ref(0);
const transformedSourceY = ref(0);

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
const sourceLayer = computed(() => {
    return getSelectedLayers(workingFileStore.state.selectedLayerIds).find((layer) => {
        return layer.type === 'raster';
    });
});

watch(() => workingFileStore.state.selectedLayerIds, () => {
    calculateSelectedLayerBounds();
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
}, { immediate: true });

watch([cursorHoverPosition], () => {
    const point = cursorHoverPosition.value.matrixTransform(
        new DOMMatrix().scale(1 / devicePixelRatio).multiply(transform.value)
    );
    transformedCursorHoverX.value = point.x;
    transformedCursorHoverY.value = point.y;
});

watch([sourceX, sourceY, sourceDrawingOffsetX, sourceDrawingOffsetY, viewDirty], () => {
    if (!sourceLayer.value) return;
    const { width, height, transform: layerTransform } = toRefs(sourceLayer.value);
    const sourcePoint = new DOMPoint(width.value * sourceX.value, height.value * sourceY.value).matrixTransform(
        new DOMMatrix()
            .scaleSelf(1 / devicePixelRatio)
            .multiplySelf(transform.value)
            .multiplySelf(layerTransform.value)
    );
    const sourceOffsetPoint = new DOMPoint(
        sourceDrawingOffsetX.value,
        sourceDrawingOffsetY.value,
    ).matrixTransform(
        new DOMMatrix().scale(
            (1 / devicePixelRatio) * decomposedTransform.value.scaleX,
            (1 / devicePixelRatio) * decomposedTransform.value.scaleY,
        )
    );
    transformedSourceX.value = sourcePoint.x + sourceOffsetPoint.x;
    transformedSourceY.value = sourcePoint.y + sourceOffsetPoint.y;
}, { immediate: true });

onMounted(() => {
    appEmitter.on('editor.history.step', onHistoryStep);
});

onUnmounted(() => {
    appEmitter.off('editor.history.step', onHistoryStep);
});

function onHistoryStep(event?: AppEmitterEvents['editor.history.step']) {
    if (!event) return;
    if (
        event.action.id === 'freeTransform'
        || event.action.id === 'rotateLayerClockwise'
        || event.action.id === 'rotateLayerCounterclockwise'
    ) {
        calculateSelectedLayerBounds();
    }
}

function calculateSelectedLayerBounds() {
    const layers = getSelectedLayers();
    
    if (layers.length > 0) {
        const clipper = new Clipper();
        for (const [layerIndex, layer] of layers.entries()) {
            const path = getLayerBoundingPoints(layer);
            clipper.AddPath(path, layerIndex === 0 ? PolyType.ptSubject : PolyType.ptClip, true);
        }
        const solution: Paths = [];
        clipper.Execute(ClipType.ctUnion, solution, PolyFillType.pftEvenOdd, PolyFillType.pftEvenOdd);

        selectedLayerBoundaryPoints.value = solution.map((solutions) => {
            return solutions.map(({ x, y }) => new DOMPoint(x, y));
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
}
</script>
