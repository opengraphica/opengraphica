<template>
    <div ref="overlay" class="ogr-canvas-overlay is-full-canvas-area">
        <template v-for="layer of selectedGradientLayerPositions" :key="layer.id">
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

import type { WorkingFileGradientLayer } from '@/types';

interface SelectedGradientLayerPositions {
    start: DOMPoint;
    end: DOMPoint;
    focus: DOMPoint;
}

export default defineComponent({
    name: 'CanvasOverlayDrawGradient',
    setup(props, { emit }) {
        const devicePixelRatio = window.devicePixelRatio || 1;

        const controlHandleSize = computed<number>(() => {
            return 1.25 / zoom.value;
        });

        const selectedGradientLayerPositions = computed<SelectedGradientLayerPositions[]>(() => {
            const selectedLayers = getSelectedLayers<WorkingFileGradientLayer>(workingFileStore.state.selectedLayerIds).filter(
                layer => layer.type === 'gradient' && layer.visible
            );
            const positions: SelectedGradientLayerPositions[] = [];
            for (const layer of selectedLayers) {
                const globalTransformInverse = getLayerGlobalTransform(layer).inverse();
                positions.push({
                    start: new DOMPoint(layer.data.start.x, layer.data.start.y).matrixTransform(globalTransformInverse),
                    end: new DOMPoint(layer.data.end.x, layer.data.end.y).matrixTransform(globalTransformInverse),
                    focus: new DOMPoint(layer.data.focus.x, layer.data.focus.y).matrixTransform(globalTransformInverse),
                });
            }
            return positions;
        });

        const positionHandleDiameter = computed<number>(() => {
            return positionHandleRadius * 2 * devicePixelRatio;
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

            controlHandleSize,
            selectedGradientLayerPositions,
            svgPathStrokeWidth,
            zoom,
        };
    }
});
</script>
