<template>
    <div
        v-for="overlayGroup of overlayGroups"
        :key="overlayGroup.id"
        class="ogr-canvas-overlays"
        :class="{
            'is-ignore-transform': overlayGroup.isIgnoreTransform,
        }"
        :style="{
            'mix-blend-mode': overlayGroup.blendMode,
            'transform': overlayGroup.isIgnoreTransform ? undefined : cssViewTransform,
        }"
    >
        <template v-for="overlayName in overlayGroup.overlays" :key="overlayName">
            <component :is="'overlay-' + overlayName" :data-overlay-name="overlayName" />
        </template>
    </div>
</template>

<script lang="ts">
import { v4 as uuidv4 } from 'uuid';
import { defineComponent, defineAsyncComponent, computed } from 'vue';
import editorStore from '@/store/editor';

export default defineComponent({
    name: 'AppCanvasOverlays',
    components: {
        'overlay-canvas-border': defineAsyncComponent(() => import(/* webpackChunkName: 'canvas-overlay-canvas-border' */ `../canvas/overlays/canvas-border.vue`)),
        'overlay-crop-resize': defineAsyncComponent(() => import(/* webpackChunkName: 'canvas-overlay-crop-resize' */ `../canvas/overlays/crop-resize.vue`)),
        'overlay-draw-brush': defineAsyncComponent(() => import(/* webpackChunkName: 'canvas-overlay-draw-brush' */ `../canvas/overlays/draw-brush.vue`)),
        'overlay-effect': defineAsyncComponent(() => import(/* webpackChunkName: 'canvas-overlay-effect' */ `../canvas/overlays/effect.vue`)),
        'overlay-erase-brush': defineAsyncComponent(() => import(/* webpackChunkName: 'canvas-overlay-erase-brush' */ `../canvas/overlays/erase-brush.vue`)),
        'overlay-free-transform': defineAsyncComponent(() => import(/* webpackChunkName: 'canvas-overlay-free-transform' */ `../canvas/overlays/free-transform.vue`)),
        'overlay-selection': defineAsyncComponent(() => import(/* webpackChunkName: 'canvas-overlay-selection' */ `../canvas/overlays/selection.vue`)),
        'overlay-text': defineAsyncComponent(() => import(/* webpackChunkName: 'canvas-overlay-text' */ `../canvas/overlays/text.vue`)),
        'overlay-text-selection': defineAsyncComponent(() => import(/* webpackChunkName: 'canvas-overlay-text' */ `../canvas/overlays/text-selection.vue`))
    },
    props: {
        ignoreTransform: {
            type: Boolean,
            default: false,
        },
        cssViewTransform: {
            type: String,
            default: '',
        }
    },
    setup(props, { emit }) {
        const ignoreTransformWith: string[] = [
            'selection',
        ];
        const blendModes: Record<string, string> = {
            'text-selection': 'difference',
        };

        interface OverlayGroup {
            id: string;
            blendMode: string;
            isIgnoreTransform: boolean;
            overlays: string[];
        }

        const overlayGroups = computed<OverlayGroup[]>(() => {
            let previousBlendMode: string | undefined = undefined;
            let previousIsIgnoreTransform: boolean | undefined = undefined;

            const groups: OverlayGroup[] = [];
            let currentGroup: OverlayGroup | null = null;

            const overlayList = ['canvas-border'];
            for (const overlay of editorStore.state.activeToolOverlays) {
                overlayList.push(overlay);
            }

            for (const overlay of overlayList) {
                const blendMode = blendModes[overlay];
                const isIgnoreTransform = ignoreTransformWith.includes(overlay);
                if (!currentGroup || isIgnoreTransform !== previousIsIgnoreTransform || blendMode !== previousBlendMode) {
                    if (currentGroup) {
                        groups.push(currentGroup);
                    }
                    currentGroup = {
                        id: uuidv4(),
                        blendMode,
                        isIgnoreTransform,
                        overlays: [],
                    };
                }
                if (currentGroup) {
                    currentGroup.overlays.push(overlay);
                }
                previousBlendMode = blendMode;
                previousIsIgnoreTransform = isIgnoreTransform;
            }
            if (currentGroup) {
                groups.push(currentGroup);
            }

            return groups;
        });

        return {
            overlayGroups,
        };
    }
});
</script>
