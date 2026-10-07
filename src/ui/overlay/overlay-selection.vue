<template>
    <div ref="overlay" class="og-canvas-overlay is-full-canvas-area">
        <div ref="selectionContainer" class="og-selection">
            <svg
                v-if="transformedActiveSelectionPath.length > 0"
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
                        font-weight="bold"
                        letter-spacing="2"
                        fill="black"
                        :x="transformedActiveSelectionPathDimensionsPosition.x - 1"
                        :y="transformedActiveSelectionPathDimensionsPosition.y + 0"
                    >{{ activeSelectionPathDimensionsText }}</text>
                    <text
                        text-anchor="middle"
                        dominant-baseline="hanging"
                        font-size="14"
                        font-weight="bold"
                        letter-spacing="2"
                        fill="black"
                        :x="transformedActiveSelectionPathDimensionsPosition.x + 1"
                        :y="transformedActiveSelectionPathDimensionsPosition.y + 0"
                    >{{ activeSelectionPathDimensionsText }}</text>
                    <text
                        text-anchor="middle"
                        dominant-baseline="hanging"
                        font-size="14"
                        font-weight="bold"
                        letter-spacing="2"
                        fill="black"
                        :x="transformedActiveSelectionPathDimensionsPosition.x + 0"
                        :y="transformedActiveSelectionPathDimensionsPosition.y - 1"
                    >{{ activeSelectionPathDimensionsText }}</text>
                    <text
                        text-anchor="middle"
                        dominant-baseline="hanging"
                        font-size="14"
                        font-weight="bold"
                        letter-spacing="2"
                        fill="black"
                        :x="transformedActiveSelectionPathDimensionsPosition.x + 0"
                        :y="transformedActiveSelectionPathDimensionsPosition.y + 1"
                    >{{ activeSelectionPathDimensionsText }}</text>
                    <text
                        text-anchor="middle"
                        dominant-baseline="hanging"
                        font-size="14"
                        font-weight="bold"
                        letter-spacing="2"
                        fill="white"
                        :x="transformedActiveSelectionPathDimensionsPosition.x"
                        :y="transformedActiveSelectionPathDimensionsPosition.y"
                    >{{ activeSelectionPathDimensionsText }}</text>
                </template>
                <template v-if="showEditHandles">
                    <template v-for="(point, i) in transformedActiveSelectionPath" :key="i + '_' + point.x + '_' + point.y">
                        <template v-if="point.type === VectorPathCommandType.LINE">
                            <rect :x="point.x! - (svgHandleWidth * 1.4)" :y="point.y! - (svgHandleWidth * 1.4)" :width="svgHandleWidth * 2.8" :height="svgHandleWidth * 2.8" :stroke-width="0" />
                            <rect :x="point.x! - (svgHandleWidth)" :y="point.y! - (svgHandleWidth)" :width="svgHandleWidth * 2" :height="svgHandleWidth * 2" :stroke-width="svgHandleWidth * .3" />
                        </template>
                        <template v-else-if="point.type === VectorPathCommandType.CUBIC_BEZIER_CURVE">
                            <rect :x="point.x! - (svgHandleWidth * 1.4)" :y="point.y! - (svgHandleWidth * 1.4)" :width="svgHandleWidth * 2.8" :height="svgHandleWidth * 2.8" :stroke-width="0" />
                            <rect :x="point.x! - (svgHandleWidth)" :y="point.y! - (svgHandleWidth)" :width="svgHandleWidth * 2" :height="svgHandleWidth * 2" :stroke-width="svgHandleWidth * .3" />
                            <!-- <ellipse :cx="point.x" :cy="point.y" :rx="svgHandleWidth * 1.45" :ry="svgHandleWidth * 1.45" :stroke-width="0" />
                            <ellipse :cx="point.x" :cy="point.y" :rx="svgHandleWidth" :ry="svgHandleWidth" :stroke-width="svgHandleWidth * .4" /> -->
                            <!-- <ellipse :cx="point.shx" :cy="point.shy" :rx="svgHandleWidth" :ry="svgHandleWidth" stroke="#ff0000" :stroke-width="svgHandleWidth * .5" />
                            <ellipse :cx="point.ehx" :cy="point.ehy" :rx="svgHandleWidth" :ry="svgHandleWidth" stroke="#ff0000" :stroke-width="svgHandleWidth * .5" /> -->
                        </template>
                        <template v-else-if="point.type === VectorPathCommandType.MOVE && activeSelectionPathEditorShape === 'freePolygon'">
                            <rect :x="point.x! - (svgHandleWidth * 1.4)" :y="point.y! - (svgHandleWidth * 1.4)" :width="svgHandleWidth * 2.8" :height="svgHandleWidth * 2.8" :stroke-width="0" />
                            <rect :x="point.x! - (svgHandleWidth)" :y="point.y! - (svgHandleWidth)" :width="svgHandleWidth * 2" :height="svgHandleWidth * 2" :stroke-width="svgHandleWidth * .3" />
                        </template>
                    </template>
                </template>
            </svg>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, toRefs } from 'vue';

import { convertUnits } from '@/lib/metrics';

import { isDrawingSelection, activeSelectionPath, selectionAddShape } from '@/canvas/store/selection-state';
import canvasStore from '@/store/canvas';
import workingFileStore from '@/store/working-file';

import { VectorPathCommandType } from '@/types/vector';
import type { AnyVectorPathCommand, VectorPathCommand } from '@/types';

defineOptions({
    name: 'CanvasOverlaySelection'
});

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

const showEditHandles = computed<boolean>(() => {
    return !isDrawingSelection.value && activeSelectionPath.value[0].editorSelectionShapeIntent !== 'lasso'
});

let transformedActiveSelectionPath = ref<AnyVectorPathCommand[]>([]);
let activeSelectionPathPixelWidth = ref(0);
let activeSelectionPathPixelHeight = ref(0);
let transformedActiveSelectionPathDimensionsPosition = ref({ x: 0, y: 0 });
watch([activeSelectionPath, viewDirty], () => {
    transformedActiveSelectionPath.value = [];
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    let xfLeft = Infinity;
    let xfRight = -Infinity;
    let xfTop = Infinity;
    let xfBottom = -Infinity;
    for (const pathCommand of activeSelectionPath.value as Array<AnyVectorPathCommand>) {
        if (pathCommand.x! < left) left = pathCommand.x!;
        if (pathCommand.x! > right) right = pathCommand.x!;
        if (pathCommand.y! < top) top = pathCommand.y!;
        if (pathCommand.y! > bottom) bottom = pathCommand.y!;
        const position = new DOMPoint(pathCommand.x, pathCommand.y).matrixTransform(transform.value);
        if (position.x < xfLeft) xfLeft = position.x;
        if (position.x > xfRight) xfRight = position.x;
        if (position.y < xfTop) xfTop = position.y;
        if (position.y > xfBottom) xfBottom = position.y;
        let startHandle = position;
        let endHandle = position;
        if (pathCommand.type === VectorPathCommandType.CUBIC_BEZIER_CURVE) {
            startHandle = new DOMPoint(pathCommand.x1, pathCommand.y1).matrixTransform(transform.value);
            endHandle = new DOMPoint(pathCommand.x2, pathCommand.y2).matrixTransform(transform.value);
        }
        transformedActiveSelectionPath.value.push({
            type: pathCommand.type,
            x: position.x / devicePixelRatio,
            y: position.y / devicePixelRatio,
            x1: startHandle.x / devicePixelRatio,
            y1: startHandle.y / devicePixelRatio,
            x2: endHandle.x / devicePixelRatio,
            y2: endHandle.y / devicePixelRatio
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
    return activeSelectionPath.value?.[0]?.editorSelectionShapeIntent ?? '';
});

const svgPathDraw = computed<string>(() => {
    const path = transformedActiveSelectionPath.value;
    let draw = 'M' + path[0].x + ' ' + path[0].y;
    for (let i = 1; i < path.length; i++) {
        const command = path[i];
        if (command.type === VectorPathCommandType.LINE) {
            draw += ' L ' + command.x + ' ' + command.y;
        } else if (command.type === VectorPathCommandType.CUBIC_BEZIER_CURVE) {
            draw += ' C ' + command.x1 + ' ' + command.y1 +
                ', ' + command.x2 + ' ' + command.y2 +
                ', ' + command.x + ' ' + command.y;
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
        return `${width} × ${height} ${measuringUnits.value}`;
    }
});

</script>
