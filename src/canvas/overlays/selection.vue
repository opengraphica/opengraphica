<template>
    <div ref="overlay" class="ogr-canvas-overlay is-full-canvas-area">
        <div ref="selectionContainer" class="ogr-selection">
            <svg
                v-if="transformedactiveSelectionPath.length > 0"
                :width="svgBoundsWidth"
                :height="svgBoundsHeight"
                xmlns="http://www.w3.org/2000/svg">
                <path :d="svgPathDraw" stroke="#333333" :stroke-width="svgPathStrokeWidth" fill="transparent"/>
                <path :d="svgPathDraw" stroke="white" :stroke-width="svgPathStrokeWidth * .8" :stroke-dasharray="svgPathStrokeWidth * 2" fill="transparent"/>
                <template v-if="!isDrawingSelection">
                    <template v-for="(point, i) in transformedactiveSelectionPath" :key="i + '_' + point.x + '_' + point.y">
                        {{ point.type }}
                        <template v-if="point.type === 'line'">
                            <rect :x="point.x - (svgHandleWidth * 1.4)" :y="point.y - (svgHandleWidth * 1.4)" :width="svgHandleWidth * 2.8" :height="svgHandleWidth * 2.8" :stroke-width="0" />
                            <rect :x="point.x - (svgHandleWidth)" :y="point.y - (svgHandleWidth)" :width="svgHandleWidth * 2" :height="svgHandleWidth * 2" :stroke-width="svgHandleWidth * .3" />
                        </template>
                        <template v-else-if="point.type === 'quadraticBezierCurve'">
                            <ellipse :cx="point.x" :cy="point.y" :rx="svgHandleWidth" :ry="svgHandleWidth" :stroke-width="svgHandleWidth * .5" />
                            <!-- <ellipse :cx="point.shx" :cy="point.shy" :rx="svgHandleWidth" :ry="svgHandleWidth" :stroke-width="svgHandleWidth * .5" />
                            <ellipse :cx="point.ehx" :cy="point.ehy" :rx="svgHandleWidth" :ry="svgHandleWidth" :stroke-width="svgHandleWidth * .5" /> -->
                        </template>
                    </template>
                </template>
            </svg>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, onMounted, onUnmounted, toRefs } from 'vue';
import { isDrawingSelection, activeSelectionPath, SelectionPathPoint } from '../store/selection-state';
import canvasStore from '@/store/canvas';
import workingFileStore from '@/store/working-file';
import { decomposeMatrix } from '@/lib/dom-matrix';

export default defineComponent({
    name: 'CanvasOverlaySelection',
    setup(props, { emit }) {
        const devicePixelRatio = window.devicePixelRatio || 1;

        const { transform, viewWidth, viewHeight, viewDirty } = toRefs(canvasStore.state);
        const { selectedLayerIds } = toRefs(workingFileStore.state);
        const selectionContainer = ref<HTMLDivElement>(null as any);
        const dragHandleHighlightColor: string = '#ecf5ff';
        const dragHandleHighlightBorderColor: string= '#b3d8ff';

        const zoom = computed<number>(() => {
            const decomposedTransform = canvasStore.state.decomposedTransform;
            let appliedZoom: number = decomposedTransform.scaleX / devicePixelRatio;
            return appliedZoom;
        });
        const svgBoundsPadding = 10;
        const svgPathStrokeWidth = computed<number>(() => {
            if (zoom.value > 1) {
                return 4;
            } else {
                return 2;
            }
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
        
        let transformedactiveSelectionPath = ref<SelectionPathPoint[]>([]);
        watch([activeSelectionPath, viewDirty], () => {
            transformedactiveSelectionPath.value = [];
            for (const pathPoint of activeSelectionPath.value) {
                const position = new DOMPoint(pathPoint.x, pathPoint.y).matrixTransform(transform.value);
                let startHandle = position;
                let endHandle = position;
                if (pathPoint.type === 'quadraticBezierCurve') {
                    startHandle = new DOMPoint(pathPoint.shx, pathPoint.shy).matrixTransform(transform.value);
                    endHandle = new DOMPoint(pathPoint.ehx, pathPoint.ehy).matrixTransform(transform.value);
                }
                transformedactiveSelectionPath.value.push({
                    type: pathPoint.type,
                    x: position.x / devicePixelRatio,
                    y: position.y / devicePixelRatio,
                    shx: startHandle.x / devicePixelRatio,
                    shy: startHandle.y / devicePixelRatio,
                    ehx: endHandle.x / devicePixelRatio,
                    ehy: endHandle.y / devicePixelRatio
                });
            }
        });

        const svgPathDraw = computed<string>(() => {
            const path = transformedactiveSelectionPath.value;
            let draw = 'M' + path[0].x + ' ' + path[0].y;
            for (let i = 1; i < path.length; i++) {
                const point = path[i];
                if (point.type === 'line') {
                    draw += ' L ' + point.x + ' ' + point.y;
                } else if (point.type === 'quadraticBezierCurve') {
                    draw += ' C ' + point.shx + ' ' + point.shy +
                        ', ' + point.ehx + ' ' + point.ehy +
                        ', ' + point.x + ' ' + point.y;
                }
            }
            draw += ' z';
            return draw;
        });

        onMounted(() => {
        });

        onUnmounted(() => {
        });

        return {
            isDrawingSelection,
            transformedactiveSelectionPath,
            selectedLayerIds,
            selectionContainer,
            svgPathDraw,
            svgPathStrokeWidth,
            svgHandleWidth,
            svgBoundsWidth,
            svgBoundsHeight,
            zoom,
            dragHandleHighlightColor,
            dragHandleHighlightBorderColor
        };
    }
});
</script>
