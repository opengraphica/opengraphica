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
                <template v-if="isDrawingSelection">
                    <text
                        text-anchor="middle"
                        dominant-baseline="hanging"
                        font-size="14"
                        stroke="white"
                        stroke-width="3"
                        :x="transformedActiveSelectionPathDimensionsPosition.x"
                        :y="transformedActiveSelectionPathDimensionsPosition.y"
                    >{{ activeSelectionPathDimensionsText }}</text>
                    <text
                        text-anchor="middle"
                        dominant-baseline="hanging"
                        font-size="14"
                        fill="black"
                        :x="transformedActiveSelectionPathDimensionsPosition.x"
                        :y="transformedActiveSelectionPathDimensionsPosition.y"
                    >{{ activeSelectionPathDimensionsText }}</text>
                </template>
                <template v-if="!isDrawingSelection">
                    <template v-for="(point, i) in transformedactiveSelectionPath" :key="i + '_' + point.x + '_' + point.y">
                        <template v-if="point.type === 'line'">
                            <rect :x="point.x - (svgHandleWidth * 1.4)" :y="point.y - (svgHandleWidth * 1.4)" :width="svgHandleWidth * 2.8" :height="svgHandleWidth * 2.8" :stroke-width="0" />
                            <rect :x="point.x - (svgHandleWidth)" :y="point.y - (svgHandleWidth)" :width="svgHandleWidth * 2" :height="svgHandleWidth * 2" :stroke-width="svgHandleWidth * .3" />
                        </template>
                        <template v-else-if="point.type === 'bezierCurve'">
                            <rect :x="point.x - (svgHandleWidth * 1.4)" :y="point.y - (svgHandleWidth * 1.4)" :width="svgHandleWidth * 2.8" :height="svgHandleWidth * 2.8" :stroke-width="0" />
                            <rect :x="point.x - (svgHandleWidth)" :y="point.y - (svgHandleWidth)" :width="svgHandleWidth * 2" :height="svgHandleWidth * 2" :stroke-width="svgHandleWidth * .3" />
                            <!-- <ellipse :cx="point.x" :cy="point.y" :rx="svgHandleWidth * 1.45" :ry="svgHandleWidth * 1.45" :stroke-width="0" />
                            <ellipse :cx="point.x" :cy="point.y" :rx="svgHandleWidth" :ry="svgHandleWidth" :stroke-width="svgHandleWidth * .4" /> -->
                            <!-- <ellipse :cx="point.shx" :cy="point.shy" :rx="svgHandleWidth" :ry="svgHandleWidth" stroke="#ff0000" :stroke-width="svgHandleWidth * .5" />
                            <ellipse :cx="point.ehx" :cy="point.ehy" :rx="svgHandleWidth" :ry="svgHandleWidth" stroke="#ff0000" :stroke-width="svgHandleWidth * .5" /> -->
                        </template>
                        <template v-else-if="point.type === 'move' && activeSelectionPathEditorShape === 'freePolygon'">
                            <rect :x="point.x - (svgHandleWidth * 1.4)" :y="point.y - (svgHandleWidth * 1.4)" :width="svgHandleWidth * 2.8" :height="svgHandleWidth * 2.8" :stroke-width="0" />
                            <rect :x="point.x - (svgHandleWidth)" :y="point.y - (svgHandleWidth)" :width="svgHandleWidth * 2" :height="svgHandleWidth * 2" :stroke-width="svgHandleWidth * .3" />
                        </template>
                    </template>
                </template>
            </svg>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, onMounted, onUnmounted, toRefs } from 'vue';

import { convertUnits } from '@/lib/metrics';

import { isDrawingSelection, activeSelectionPath, SelectionPathPoint } from '@/canvas/store/selection-state';
import canvasStore from '@/store/canvas';
import workingFileStore, { type WorkingFileState } from '@/store/working-file';

export default defineComponent({
    name: 'CanvasOverlaySelection',
    setup() {
        const devicePixelRatio = window.devicePixelRatio || 1;

        const { transform, viewWidth, viewHeight, viewDirty } = toRefs(canvasStore.state);
        const { measuringUnits, resolutionX, resolutionY, resolutionUnits, selectedLayerIds } = toRefs(workingFileStore.state);

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
            return 2;
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
        let activeSelectionPathPixelWidth = ref(0);
        let activeSelectionPathPixelHeight = ref(0);
        let transformedActiveSelectionPathDimensionsPosition = ref({ x: 0, y: 0 });
        watch([activeSelectionPath, viewDirty], () => {
            transformedactiveSelectionPath.value = [];
            let left = Infinity;
            let right = -Infinity;
            let top = Infinity;
            let bottom = -Infinity;
            let xfLeft = Infinity;
            let xfRight = -Infinity;
            let xfTop = Infinity;
            let xfBottom = -Infinity;
            for (const pathPoint of activeSelectionPath.value) {
                if (pathPoint.x < left) left = pathPoint.x;
                if (pathPoint.x > right) right = pathPoint.x;
                if (pathPoint.y < top) top = pathPoint.y;
                if (pathPoint.y > bottom) bottom = pathPoint.y;
                const position = new DOMPoint(pathPoint.x, pathPoint.y).matrixTransform(transform.value);
                if (position.x < xfLeft) xfLeft = position.x;
                if (position.x > xfRight) xfRight = position.x;
                if (position.y < xfTop) xfTop = position.y;
                if (position.y > xfBottom) xfBottom = position.y;
                let startHandle = position;
                let endHandle = position;
                if (pathPoint.type === 'bezierCurve') {
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
            transformedActiveSelectionPathDimensionsPosition.value = new DOMPoint(
                (xfLeft + (xfRight - xfLeft) / 2) / devicePixelRatio,
                ((xfBottom) / devicePixelRatio) + 10,
            );
            activeSelectionPathPixelWidth.value = right - left;
            activeSelectionPathPixelHeight.value = bottom - top;
        });

        const activeSelectionPathEditorShape = computed<string>(() => {
            return activeSelectionPath.value?.[0]?.editorShapeIntent ?? '';
        });

        const svgPathDraw = computed<string>(() => {
            const path = transformedactiveSelectionPath.value;
            let draw = 'M' + path[0].x + ' ' + path[0].y;
            for (let i = 1; i < path.length; i++) {
                const point = path[i];
                if (point.type === 'line') {
                    draw += ' L ' + point.x + ' ' + point.y;
                } else if (point.type === 'bezierCurve') {
                    draw += ' C ' + point.shx + ' ' + point.shy +
                        ', ' + point.ehx + ' ' + point.ehy +
                        ', ' + point.x + ' ' + point.y;
                }
            }
            if (activeSelectionPathEditorShape.value !== 'freePolygon') {
                draw += ' z';
            }
            return draw;
        });

        const activeSelectionPathDimensionsText = computed<string | undefined>(() => {
            if (activeSelectionPathEditorShape.value === 'rectangle') {
                const width = parseFloat(convertUnits(activeSelectionPathPixelWidth.value, 'px', measuringUnits.value, resolutionX.value, resolutionUnits.value).toFixed(2));
                const height = parseFloat(convertUnits(activeSelectionPathPixelHeight.value, 'px', measuringUnits.value, resolutionY.value, resolutionUnits.value).toFixed(2));
                return `${width}×${height}${measuringUnits.value}`;
            }
        });

        onMounted(() => {
        });

        onUnmounted(() => {
        });

        return {
            isDrawingSelection,
            activeSelectionPathEditorShape,

            activeSelectionPathDimensionsText,
            transformedActiveSelectionPathDimensionsPosition,
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
