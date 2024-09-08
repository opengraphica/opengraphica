<template>
    <div ref="overlay" class="ogr-canvas-overlay is-full-canvas-area">
        <template v-for="layer of selectedGradientLayerPositions" :key="layer.id">
            <svg
                class="ogr-canvas-overlay__gradient-range-line"
                :viewBox="
                    -rangeLinePadding + ' ' + -rangeLinePadding + ' ' +
                    (layer.bounds.width + rangeLinePadding*2) + ' ' + (layer.bounds.height + rangeLinePadding*2)
                "
                :style="{
                    left: (layer.bounds.left - rangeLinePadding) + 'px',
                    top: (layer.bounds.top - rangeLinePadding) + 'px',
                    width: (layer.bounds.width + rangeLinePadding*2) + 'px',
                    height: (layer.bounds.height + rangeLinePadding*2) + 'px'
                }"
            >
                <line
                    :x1="layer.start.x + (layer.rangeBearing.x * rangeLineOffset) - layer.bounds.left"
                    :x2="layer.end.x + (-layer.rangeBearing.x * rangeLineOffset) - layer.bounds.left"
                    :y1="layer.start.y + (layer.rangeBearing.y * rangeLineOffset) - layer.bounds.top"
                    :y2="layer.end.y + (-layer.rangeBearing.y * rangeLineOffset) - layer.bounds.top"
                    :style="{
                        stroke: 'white', 
                        strokeWidth: svgPathStrokeWidth * 2.25,
                    }"
                />
                <line
                    :x1="layer.start.x + (layer.rangeBearing.x * rangeLineOffset) - layer.bounds.left"
                    :x2="layer.end.x + (-layer.rangeBearing.x * rangeLineOffset) - layer.bounds.left"
                    :y1="layer.start.y + (layer.rangeBearing.y * rangeLineOffset) - layer.bounds.top"
                    :y2="layer.end.y + (-layer.rangeBearing.y * rangeLineOffset) - layer.bounds.top"
                    :style="{
                        stroke: '#333333', 
                        strokeWidth: svgPathStrokeWidth,
                    }"
                />
            </svg>
            <template v-for="handleName of ['start', 'end', 'focus']" :key="handleName">
                <div
                    class="ogr-canvas-overlay__gradient-position-handle"
                    :style="{
                        left: layer[handleName].x + 'px',
                        top: layer[handleName].y + 'px',
                        width: positionHandleDiameter + 'px',
                        height: positionHandleDiameter + 'px',
                        transform: 'translate(-50%, -50%) scale(' + 1 / zoom + ')'
                    }"
                />
            </template>
        </template>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, onMounted, onUnmounted, toRefs } from 'vue';

import { colorStopHandleRadius, positionHandleRadius } from '@/canvas/store/draw-gradient-state';
import canvasStore from '@/store/canvas';
import workingFileStore, { getSelectedLayers, getLayerGlobalTransform } from '@/store/working-file';

import { normalizedDirectionVector2d } from '@/lib/math';

import type { WorkingFileGradientLayer } from '@/types';

interface SelectedGradientLayerPositions {
    start: DOMPoint;
    end: DOMPoint;
    focus: DOMPoint;
    bounds: DOMRect;
    rangeBearing: DOMPoint;
}

export default defineComponent({
    name: 'CanvasOverlayDrawGradient',
    setup(props, { emit }) {
        const devicePixelRatio = window.devicePixelRatio || 1;

        const rangeLinePadding = computed<number>(() => {
            return 5.0 / zoom.value;
        });

        const selectedGradientLayerPositions = computed<SelectedGradientLayerPositions[]>(() => {
            const selectedLayers = getSelectedLayers<WorkingFileGradientLayer>(workingFileStore.state.selectedLayerIds).filter(
                layer => layer.type === 'gradient' && layer.visible
            );
            const positions: SelectedGradientLayerPositions[] = [];
            for (const layer of selectedLayers) {
                const globalTransformInverse = getLayerGlobalTransform(layer).inverse();
                const start = new DOMPoint(layer.data.start.x, layer.data.start.y).matrixTransform(globalTransformInverse);
                const end = new DOMPoint(layer.data.end.x, layer.data.end.y).matrixTransform(globalTransformInverse);
                const left = Math.min(start.x, end.x);
                const top = Math.min(start.y, end.y);
                const rangeLineDirection = normalizedDirectionVector2d(start.x, start.y, end.x, end.y);
                positions.push({
                    start,
                    end,
                    focus: new DOMPoint(layer.data.focus.x, layer.data.focus.y).matrixTransform(globalTransformInverse),
                    bounds: new DOMRect(left, top, Math.abs(start.x - end.x), Math.abs(start.y - end.y)),
                    rangeBearing: new DOMPoint(rangeLineDirection.x, rangeLineDirection.y),
                });
            }
            return positions;
        });

        const positionHandleDiameter = computed<number>(() => {
            return positionHandleRadius * 2 * devicePixelRatio;
        });

        const rangeLineOffset = computed<number>(() => {
            return positionHandleDiameter.value * 0.8 / zoom.value;
        });

        const svgPathStrokeWidth = computed<number>(() => {
            return 2 / zoom.value;
        });

        const zoom = computed<number>(() => {
            const decomposedTransform = canvasStore.state.decomposedTransform;
            let appliedZoom: number = decomposedTransform.scaleX / devicePixelRatio;
            return appliedZoom;
        });

        onMounted(() => {
        });

        onUnmounted(() => {
        });

        return {
            positionHandleDiameter,
            rangeLinePadding,
            rangeLineOffset,

            selectedGradientLayerPositions,
            svgPathStrokeWidth,
            zoom,
        };
    }
});
</script>
