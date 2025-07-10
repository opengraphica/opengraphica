<template>
    <div ref="overlay" class="og-canvas-overlay is-full-canvas-area">
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, toRefs } from 'vue';

import canvasStore from '@/store/canvas';
import workingFileStore, { getSelectedLayers, getLayerGlobalTransform } from '@/store/working-file';

import type { WorkingFileGradientLayer } from '@/types';

defineOptions({
    name: 'CanvasOverlayDrawShape',
});

const devicePixelRatio = window.devicePixelRatio || 1;

const zoom = computed<number>(() => {
    const decomposedTransform = canvasStore.state.decomposedTransform;
    let appliedZoom: number = decomposedTransform.scaleX;
    return appliedZoom / devicePixelRatio;
});

onMounted(() => {
});

onUnmounted(() => {
});
</script>
