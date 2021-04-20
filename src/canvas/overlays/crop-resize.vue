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
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, onMounted, onUnmounted } from 'vue';
import canvasStore from '@/store/canvas';
import { top, left, width, height, cropResizeEmitter } from '../store/crop-resize-state';

export default defineComponent({
    name: 'CanvasOverlayCropResize',
    emits: [
    ],
    props: {
    },
    setup(props, { emit }) {
        const crop = ref<HTMLDivElement>(null as any);
        const zoom = ref<number>(1);

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
                if (event.top) {
                    crop.value.style.top = top + 'px';
                    top.value = event.top;
                }
                if (event.left) {
                    crop.value.style.left = left + 'px';
                    left.value = event.left;
                }
                if (event.width) {
                    crop.value.style.width = width + 'px';
                    width.value = event.width;
                }
                if (event.height) {
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
            showHorizontalHandles
        };
    }
});
</script>
