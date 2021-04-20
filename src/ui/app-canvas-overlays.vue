<template>
    <div class="ogr-canvas-overlays">
        <template v-for="overlayName in overlays" :key="overlayName">
            <component :is="overlayName" />
        </template>
    </div>
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent, computed } from 'vue';
import editorStore from '@/store/editor';

export default defineComponent({
    name: 'AppCanvasOverlays',
    components: {
        'crop-resize': defineAsyncComponent(() => import(/* webpackChunkName: 'canvas-overlay-crop-resize' */ `../canvas/overlays/crop-resize.vue`))
    },
    setup(props, { emit }) {
        const overlays = computed<string[]>(() => {
            return editorStore.state.activeToolOverlays;
        });

        return {
            overlays
        };
    }
});
</script>
