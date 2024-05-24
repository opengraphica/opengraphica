<template>
    <div class="ogr-canvas-overlays" :class="{ 'is-ignore-transform': ignoreTransform }">
        <template v-for="overlayName in overlays" :key="overlayName">
            <component :is="'overlay-' + overlayName" />
        </template>
    </div>
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent, computed } from 'vue';
import editorStore from '@/store/editor';

export default defineComponent({
    name: 'AppCanvasOverlays',
    components: {
        'overlay-canvas-border': defineAsyncComponent(() => import(/* webpackChunkName: 'canvas-overlay-canvas-border' */ `../canvas/overlays/canvas-border.vue`)),
        'overlay-crop-resize': defineAsyncComponent(() => import(/* webpackChunkName: 'canvas-overlay-crop-resize' */ `../canvas/overlays/crop-resize.vue`)),
        'overlay-draw-brush': defineAsyncComponent(() => import(/* webpackChunkName: 'canvas-overlay-draw-brush' */ `../canvas/overlays/draw-brush.vue`)),
        'overlay-erase-brush': defineAsyncComponent(() => import(/* webpackChunkName: 'canvas-overlay-draw-brush' */ `../canvas/overlays/erase-brush.vue`)),
        'overlay-free-transform': defineAsyncComponent(() => import(/* webpackChunkName: 'canvas-overlay-free-transform' */ `../canvas/overlays/free-transform.vue`)),
        'overlay-selection': defineAsyncComponent(() => import(/* webpackChunkName: 'canvas-overlay-selection' */ `../canvas/overlays/selection.vue`)),
        'overlay-text': defineAsyncComponent(() => import(/* webpackChunkName: 'canvas-overlay-text' */ `../canvas/overlays/text.vue`))
    },
    props: {
        ignoreTransform: {
            type: Boolean,
            default: false
        }
    },
    setup(props, { emit }) {
        const ignoreTransformWith = [
            'selection'
        ];

        const overlays = computed<string[]>(() => {
            const overlayList: string[] = [];
            if (!props.ignoreTransform) {
                overlayList.push('canvas-border');
            }
            for (const overlay of editorStore.state.activeToolOverlays) {
                if (props.ignoreTransform) {
                    if (ignoreTransformWith.includes(overlay)) {
                        overlayList.push(overlay);
                    }
                } else {
                    if (!ignoreTransformWith.includes(overlay)) {
                        overlayList.push(overlay);
                    }
                }
            }
            return overlayList;
        });

        return {
            overlays
        };
    }
});
</script>
