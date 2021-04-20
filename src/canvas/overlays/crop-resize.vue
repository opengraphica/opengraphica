<template>
    <div class="ogr-canvas-overlay">
        <div ref="crop" class="ogr-crop" :style="{ top: top + 'px', left: left + 'px', width: width + 'px', height: height + 'px' }">
            <div class="ogr-crop-bounds" :style="{ borderWidth: (0.35/zoom) + 'rem' }"></div>
            <div class="ogr-crop-handle-top" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path v-if="showHorizontalHandles" d="M1.5 1.5 L98.5 1.5 L98.5 25 L1.5 25 Z" fill="white" stroke="#ccc" stroke-width="3" />
                </svg>
            </div>
            <div class="ogr-crop-handle-left" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path v-if="showVerticalHandles" d="M1.5 1.5 L98.5 1.5 L98.5 25 L1.5 25 Z" fill="white" stroke="#ccc" stroke-width="3" />
                </svg>
            </div>
            <div class="ogr-crop-handle-bottom" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path v-if="showHorizontalHandles" d="M1.5 1.5 L98.5 1.5 L98.5 25 L1.5 25 Z" fill="white" stroke="#ccc" stroke-width="3" />
                </svg>
            </div>
            <div class="ogr-crop-handle-right" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path v-if="showVerticalHandles" d="M1.5 1.5 L98.5 1.5 L98.5 25 L1.5 25 Z" fill="white" stroke="#ccc" stroke-width="3" />
                </svg>
            </div>
            <div class="ogr-crop-handle-top-left" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path v-if="isSmallHandles" d="M1.5 1.5 L25 1.5 L25 25 L1.5 25 Z" fill="white" stroke="#ccc" stroke-width="3" />
                    <path v-else d="M1.5 1.5 L98.5 1.5 L98.5 25 L25 25 L25 98.5 L1.5 98.5 Z" fill="white" stroke="#ccc" stroke-width="3" />
                </svg>
            </div>
            <div class="ogr-crop-handle-top-right" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path v-if="isSmallHandles" d="M1.5 1.5 L25 1.5 L25 25 L1.5 25 Z" fill="white" stroke="#ccc" stroke-width="3" />
                    <path v-else d="M1.5 1.5 L98.5 1.5 L98.5 25 L25 25 L25 98.5 L1.5 98.5 Z" fill="white" stroke="#ccc" stroke-width="3" />
                </svg>
            </div>
            <div class="ogr-crop-handle-bottom-left" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path v-if="isSmallHandles" d="M1.5 1.5 L25 1.5 L25 25 L1.5 25 Z" fill="white" stroke="#ccc" stroke-width="3" />
                    <path v-else d="M1.5 1.5 L98.5 1.5 L98.5 25 L25 25 L25 98.5 L1.5 98.5 Z" fill="white" stroke="#ccc" stroke-width="3" />
                </svg>
            </div>
            <div class="ogr-crop-handle-bottom-right" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path v-if="isSmallHandles" d="M1.5 1.5 L25 1.5 L25 25 L1.5 25 Z" fill="white" stroke="#ccc" stroke-width="3" />
                    <path v-else d="M1.5 1.5 L98.5 1.5 L98.5 25 L25 25 L25 98.5 L1.5 98.5 Z" fill="white" stroke="#ccc" stroke-width="3" />
                </svg>
            </div>
        </div>
        <div v-show="previewXSnap != null" class="ogr-snap-preview ogr-snap-preview-vertical" :style="{ left: (previewXSnap - (1/zoom/2)) + 'px', width: (1/zoom) + 'px', height: fileHeight + 'px' }"></div>
        <div v-show="previewYSnap != null" class="ogr-snap-preview ogr-snap-preview-horizontal" :style="{ top: (previewYSnap - (1/zoom/2)) + 'px', height: (1/zoom) + 'px', width: fileWidth + 'px' }"></div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, onMounted, onUnmounted, toRefs } from 'vue';
import canvasStore from '@/store/canvas';
import workingFileStore from '@/store/working-file';
import { top, left, width, height, cropResizeEmitter, previewXSnap, previewYSnap } from '../store/crop-resize-state';

export default defineComponent({
    name: 'CanvasOverlayCropResize',
    emits: [
    ],
    props: {
    },
    setup(props, { emit }) {
        const crop = ref<HTMLDivElement>(null as any);
        const zoom = ref<number>(1);
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
            crop,
            zoom,
            top,
            left,
            width,
            height,
            isSmallHandles,
            showVerticalHandles,
            showHorizontalHandles,
            previewXSnap,
            previewYSnap,
            fileWidth,
            fileHeight
        };
    }
});
</script>
