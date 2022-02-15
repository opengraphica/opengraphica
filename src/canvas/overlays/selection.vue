<template>
    <div ref="overlay" class="ogr-canvas-overlay">
        <div ref="selectionContainer"
            class="ogr-selection"
            :style="{
                width: width + 'px',
                height: height + 'px',
                transform: transform,
                transformOrigin: transformOrigin
            }"
        >
            
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, onMounted, onUnmounted, toRefs } from 'vue';
import { workingSelectionPath } from '../store/selection-state';
import canvasStore from '@/store/canvas';
import workingFileStore from '@/store/working-file';
import { decomposeMatrix } from '@/lib/dom-matrix';

export default defineComponent({
    name: 'CanvasOverlayCropResize',
    emits: [
    ],
    props: {
    },
    setup(props, { emit }) {
        const { selectedLayerIds } = toRefs(workingFileStore.state);
        const zoom = ref<number>(1);
        const selectionContainer = ref<HTMLDivElement>(null as any);
        const dragHandleHighlightColor: string = '#ecf5ff';
        const dragHandleHighlightBorderColor: string= '#b3d8ff';
        const containerTransform = ref<string>('');
        const containerTransformOrigin = ref<string>('0% 0%');

        watch(() => canvasStore.state.decomposedTransform, (decomposedTransform) => {
            let appliedZoom = decomposedTransform.scaleX / window.devicePixelRatio;
            if (appliedZoom !== zoom.value) {
                zoom.value = appliedZoom;
            }
        }, { immediate: true });

        onMounted(() => {
        });

        onUnmounted(() => {
        });

        return {
            selectedLayerIds,
            selectionContainer,
            transform: containerTransform,
            transformOrigin: containerTransformOrigin,
            zoom,
            dragHandleHighlightColor,
            dragHandleHighlightBorderColor
        };
    }
});
</script>
