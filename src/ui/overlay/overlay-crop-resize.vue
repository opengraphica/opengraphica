<template>
    <div class="og-canvas-overlay">
        <div ref="crop" class="og-crop" :style="{ top: top + 'px', left: left + 'px', width: width + 'px', height: height + 'px' }">
            <div class="og-crop-bounds" :style="{ outlineWidth: (0.35/zoom) + 'rem' }"></div>
            <div class="og-crop-handle-top" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path v-if="showHorizontalHandles" d="M1.5 98.5 L98.5 98.5 L98.5 75 L1.5 75 Z"
                        :fill="dragHandleHighlight === DRAG_TYPE_TOP ? dragHandleHighlightColor : 'white'"
                        :stroke="dragHandleHighlight === DRAG_TYPE_TOP ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="3" />
                </svg>
            </div>
            <div class="og-crop-handle-left" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path v-if="showVerticalHandles" d="M1.5 98.5 L98.5 98.5 L98.5 75 L1.5 75 Z"
                        :fill="dragHandleHighlight === DRAG_TYPE_LEFT ? dragHandleHighlightColor : 'white'"
                        :stroke="dragHandleHighlight === DRAG_TYPE_LEFT ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="3" />
                </svg>
            </div>
            <div class="og-crop-handle-bottom" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path v-if="showHorizontalHandles" d="M1.5 98.5 L98.5 98.5 L98.5 75 L1.5 75 Z"
                        :fill="dragHandleHighlight === DRAG_TYPE_BOTTOM ? dragHandleHighlightColor : 'white'" 
                        :stroke="dragHandleHighlight === DRAG_TYPE_BOTTOM ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="3" />
                </svg>
            </div>
            <div class="og-crop-handle-right" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path v-if="showVerticalHandles" d="M1.5 98.5 L98.5 98.5 L98.5 75 L1.5 75 Z"
                        :fill="dragHandleHighlight === DRAG_TYPE_RIGHT ? dragHandleHighlightColor : 'white'"
                        :stroke="dragHandleHighlight === DRAG_TYPE_RIGHT ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="3" />
                </svg>
            </div>
            <div class="og-crop-handle-top-left" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path v-if="isSmallHandles" d="M1.5 1.5 L25 1.5 L25 25 L1.5 25 Z"
                        :fill="dragHandleHighlight === (DRAG_TYPE_TOP | DRAG_TYPE_LEFT) ? dragHandleHighlightColor : 'white'"
                        :stroke="dragHandleHighlight === (DRAG_TYPE_TOP | DRAG_TYPE_LEFT) ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="3" />
                    <path v-else d="M1.5 1.5 L98.5 1.5 L98.5 25 L25 25 L25 98.5 L1.5 98.5 Z"
                        :fill="dragHandleHighlight === (DRAG_TYPE_TOP | DRAG_TYPE_LEFT) ? dragHandleHighlightColor : 'white'"
                        :stroke="dragHandleHighlight === (DRAG_TYPE_TOP | DRAG_TYPE_LEFT) ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="3" />
                </svg>
            </div>
            <div class="og-crop-handle-top-right" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path v-if="isSmallHandles" d="M1.5 1.5 L25 1.5 L25 25 L1.5 25 Z"
                        :fill="dragHandleHighlight === (DRAG_TYPE_TOP | DRAG_TYPE_RIGHT) ? dragHandleHighlightColor : 'white'"
                        :stroke="dragHandleHighlight === (DRAG_TYPE_TOP | DRAG_TYPE_RIGHT) ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="3" />
                    <path v-else d="M1.5 1.5 L98.5 1.5 L98.5 25 L25 25 L25 98.5 L1.5 98.5 Z"
                        :fill="dragHandleHighlight === (DRAG_TYPE_TOP | DRAG_TYPE_RIGHT) ? dragHandleHighlightColor : 'white'"
                        :stroke="dragHandleHighlight === (DRAG_TYPE_TOP | DRAG_TYPE_RIGHT) ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="3" />
                </svg>
            </div>
            <div class="og-crop-handle-bottom-left" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path v-if="isSmallHandles" d="M1.5 1.5 L25 1.5 L25 25 L1.5 25 Z"
                        :fill="dragHandleHighlight === (DRAG_TYPE_BOTTOM | DRAG_TYPE_LEFT) ? dragHandleHighlightColor : 'white'"
                        :stroke="dragHandleHighlight === (DRAG_TYPE_BOTTOM | DRAG_TYPE_LEFT) ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="3" />
                    <path v-else d="M1.5 1.5 L98.5 1.5 L98.5 25 L25 25 L25 98.5 L1.5 98.5 Z"
                        :fill="dragHandleHighlight === (DRAG_TYPE_BOTTOM | DRAG_TYPE_LEFT) ? dragHandleHighlightColor : 'white'"
                        :stroke="dragHandleHighlight === (DRAG_TYPE_BOTTOM | DRAG_TYPE_LEFT) ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="3" />
                </svg>
            </div>
            <div class="og-crop-handle-bottom-right" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path v-if="isSmallHandles" d="M1.5 1.5 L25 1.5 L25 25 L1.5 25 Z"
                        :fill="dragHandleHighlight === (DRAG_TYPE_BOTTOM | DRAG_TYPE_RIGHT) ? dragHandleHighlightColor : 'white'"
                        :stroke="dragHandleHighlight === (DRAG_TYPE_BOTTOM | DRAG_TYPE_RIGHT) ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="3" />
                    <path v-else d="M1.5 1.5 L98.5 1.5 L98.5 25 L25 25 L25 98.5 L1.5 98.5 Z"
                        :fill="dragHandleHighlight === (DRAG_TYPE_BOTTOM | DRAG_TYPE_RIGHT) ? dragHandleHighlightColor : 'white'"
                        :stroke="dragHandleHighlight === (DRAG_TYPE_BOTTOM | DRAG_TYPE_RIGHT) ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="3" />
                </svg>
            </div>
        </div>
        <div v-show="previewXSnap != null" class="og-snap-preview og-snap-preview-vertical" :style="{ left: (previewXSnap - (2/zoom/2)) + 'px', width: (2/zoom) + 'px', height: fileHeight + 'px' }"></div>
        <div v-show="previewYSnap != null" class="og-snap-preview og-snap-preview-horizontal" :style="{ top: (previewYSnap - (2/zoom/2)) + 'px', height: (2/zoom) + 'px', width: fileWidth + 'px' }"></div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, onMounted, onUnmounted, toRefs } from 'vue';
import canvasStore from '@/store/canvas';
import workingFileStore from '@/store/working-file';
import {
    top, left, width, height, cropResizeEmitter, dragHandleHighlight, previewXSnap, previewYSnap
} from '@/canvas/store/crop-resize-state';

export default defineComponent({
    name: 'CanvasOverlayCropResize',
    emits: [
    ],
    props: {
    },
    setup(props, { emit }) {
        const crop = ref<HTMLDivElement>(null as any);
        const zoom = ref<number>(1);
        const dragHandleHighlightColor: string = '#ecf5ff';
        const dragHandleHighlightBorderColor: string= '#b3d8ff';
        const { width: fileWidth, height: fileHeight } = toRefs(workingFileStore.state);

        const isSmallHandles = computed<boolean>(() => {
            return (zoom.value * width.value < 100) || (zoom.value * height.value < 100);
        });

        const showVerticalHandles = computed<boolean>(() => {
            return zoom.value * height.value >= 50;
        });
        const showHorizontalHandles = computed<boolean>(() => {
            return zoom.value * width.value >= 50;
        });

        watch(() => canvasStore.state.decomposedTransform, (decomposedTransform) => {
            let appliedZoom = decomposedTransform.scaleX / window.devicePixelRatio;
            if (appliedZoom !== zoom.value) {
                zoom.value = appliedZoom;
            }
        }, { immediate: true });

        onMounted(() => {
            cropResizeEmitter.on('setCrop', setCrop);
        });

        onUnmounted(() => {
            cropResizeEmitter.off('setCrop', setCrop);
        });

        function setCrop(event?: { top?: number, left?: number, width?: number, height?: number }) {
            if (event) {
                if (event.top != null) {
                    crop.value.style.top = top + 'px';
                    top.value = event.top;
                }
                if (event.left != null) {
                    crop.value.style.left = left + 'px';
                    left.value = event.left;
                }
                if (event.width != null) {
                    crop.value.style.width = width + 'px';
                    width.value = event.width;
                }
                if (event.height != null) {
                    crop.value.style.height = height + 'px';
                    height.value = event.height;
                }
            }
        }

        return {
            DRAG_TYPE_ALL: 0,
            DRAG_TYPE_TOP: 1,
            DRAG_TYPE_BOTTOM: 2,
            DRAG_TYPE_LEFT: 4,
            DRAG_TYPE_RIGHT: 8,
            crop,
            zoom,
            top,
            left,
            width,
            height,
            isSmallHandles,
            showVerticalHandles,
            showHorizontalHandles,
            dragHandleHighlightColor,
            dragHandleHighlightBorderColor,
            dragHandleHighlight,
            previewXSnap,
            previewYSnap,
            fileWidth,
            fileHeight
        };
    }
});
</script>
