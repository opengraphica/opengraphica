<template>
    <div ref="overlay" class="ogr-canvas-overlay">
        <div ref="freeTransform"
            v-show="selectedLayerIds.length > 0 && !isBoundsIndeterminate"
            class="ogr-free-transform"
            :style="{
                width: width + 'px',
                height: height + 'px',
                transform: transform,
                transformOrigin: transformOrigin
            }"
        >
            <div class="ogr-free-transform-bounds" :style="{
                outlineWidth: (0.35/zoom) + 'rem'
            }"></div>
            <div class="ogr-free-transform-handle-rotate" :style="{ transform: 'scale(' + (1/zoom) + ')', top: (-2 / zoom) + 'rem' }">
                <div class="ogr-free-transform-handle-rotate-line"></div>
                <svg viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="white" :stroke="rotateHandleHighlight === true ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="10" />
                    <circle cx="50" cy="50" r="25" :fill="rotateHandleHighlight === true ? dragHandleHighlightBorderColor : '#ccc'" />
                </svg>
            </div>
            <div v-show="!hideVerticalSideHandles" class="ogr-free-transform-handle-top" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path d="M10 10 L90 10 L90 90 L10 90 Z"
                        :fill="dragHandleHighlight === DRAG_TYPE_TOP ? dragHandleHighlightColor : 'white'"
                        :stroke="dragHandleHighlight === DRAG_TYPE_TOP ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="10" />
                </svg>
            </div>
            <div v-show="!hideHorizontalSideHandles" class="ogr-free-transform-handle-left" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path d="M10 10 L90 10 L90 90 L10 90 Z"
                        :fill="dragHandleHighlight === DRAG_TYPE_LEFT ? dragHandleHighlightColor : 'white'"
                        :stroke="dragHandleHighlight === DRAG_TYPE_LEFT ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="10" />
                </svg>
            </div>
            <div v-show="!hideVerticalSideHandles" class="ogr-free-transform-handle-bottom" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path d="M10 10 L90 10 L90 90 L10 90 Z"
                        :fill="dragHandleHighlight === DRAG_TYPE_BOTTOM ? dragHandleHighlightColor : 'white'"
                        :stroke="dragHandleHighlight === DRAG_TYPE_BOTTOM ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="10" />
                </svg>
            </div>
            <div v-show="!hideHorizontalSideHandles" class="ogr-free-transform-handle-right" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path d="M10 10 L90 10 L90 90 L10 90 Z"
                        :fill="dragHandleHighlight === DRAG_TYPE_RIGHT ? dragHandleHighlightColor : 'white'"
                        :stroke="dragHandleHighlight === DRAG_TYPE_RIGHT ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="10" />
                </svg>
            </div>
            <div class="ogr-free-transform-handle-top-left" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path d="M10 10 L90 10 L90 90 L10 90 Z"
                        :fill="dragHandleHighlight === (DRAG_TYPE_TOP | DRAG_TYPE_LEFT) ? dragHandleHighlightColor : 'white'"
                        :stroke="dragHandleHighlight === (DRAG_TYPE_TOP | DRAG_TYPE_LEFT) ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="10" />
                </svg>
            </div>
            <div class="ogr-free-transform-handle-top-right" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path d="M10 10 L90 10 L90 90 L10 90 Z"
                        :fill="dragHandleHighlight === (DRAG_TYPE_TOP | DRAG_TYPE_RIGHT) ? dragHandleHighlightColor : 'white'"
                        :stroke="dragHandleHighlight === (DRAG_TYPE_TOP | DRAG_TYPE_RIGHT) ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="10" />
                </svg>
            </div>
            <div class="ogr-free-transform-handle-bottom-left" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path d="M10 10 L90 10 L90 90 L10 90 Z"
                        :fill="dragHandleHighlight === (DRAG_TYPE_BOTTOM | DRAG_TYPE_LEFT) ? dragHandleHighlightColor : 'white'"
                        :stroke="dragHandleHighlight === (DRAG_TYPE_BOTTOM | DRAG_TYPE_LEFT) ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="10" />
                </svg>
            </div>
            <div class="ogr-free-transform-handle-bottom-right" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path d="M10 10 L90 10 L90 90 L10 90 Z"
                        :fill="dragHandleHighlight === (DRAG_TYPE_BOTTOM | DRAG_TYPE_RIGHT) ? dragHandleHighlightColor : 'white'"
                        :stroke="dragHandleHighlight === (DRAG_TYPE_BOTTOM | DRAG_TYPE_RIGHT) ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="10" />
                </svg>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, onMounted, onUnmounted, toRefs } from 'vue';
import { isBoundsIndeterminate, freeTransformEmitter, left, top, width, height, rotation, transformOriginX, transformOriginY, dragHandleHighlight, rotateHandleHighlight } from '../store/free-transform-state';
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
        const freeTransform = ref<HTMLDivElement>(null as any);
        const zoom = ref<number>(1);
        const hideVerticalSideHandles = ref<boolean>(false);
        const hideHorizontalSideHandles = ref<boolean>(false);
        const dragHandleHighlightColor: string = '#ecf5ff';
        const dragHandleHighlightBorderColor: string= '#b3d8ff';
        const overlayTop = ref<number>(0);
        const overlayLeft = ref<number>(0);
        const overlayWidth = ref<number>(0);
        const overlayHeight = ref<number>(0);
        const overlayTransform = ref<string>('');
        const overlayTransformOrigin = ref<string>('0% 0%');

        watch(() => canvasStore.state.decomposedTransform, (decomposedTransform) => {
            let appliedZoom = decomposedTransform.scaleX / window.devicePixelRatio;
            if (appliedZoom !== zoom.value) {
                zoom.value = appliedZoom;
            }
        }, { immediate: true });

        onMounted(() => {
            freeTransformEmitter.on('setDimensions', setDimensions);
            setDimensions({
                top: top.value,
                left: left.value,
                width: width.value,
                height: height.value,
                rotation: rotation.value,
                transformOriginX: transformOriginX.value,
                transformOriginY: transformOriginY.value
            });
        });

        onUnmounted(() => {
            freeTransformEmitter.off('setDimensions', setDimensions);
        });
       
        function setDimensions(event?: { top?: number, left?: number, width?: number, height?: number, rotation?: number, transformOriginX?: number, transformOriginY?: number }) {
            if (event) {
                overlayTransformOrigin.value = `${transformOriginY.value * 100}% ${transformOriginX.value * 100}%`;
                freeTransform.value.style.transformOrigin = overlayTransformOrigin.value;
                const overlayTransformMatrix =
                    new DOMMatrix()
                    .translateSelf(left.value, top.value)
                    .rotateSelf(rotation.value * Math.RADIANS_TO_DEGREES);
                overlayTransform.value = `matrix(${overlayTransformMatrix.a},${overlayTransformMatrix.b},${overlayTransformMatrix.c},${overlayTransformMatrix.d},${overlayTransformMatrix.e},${overlayTransformMatrix.f})`;
                freeTransform.value.style.transform = overlayTransform.value;
                if (event.width != null) {
                    overlayWidth.value = event.width;
                    freeTransform.value.style.width = overlayWidth + 'px';
                }
                if (event.height != null) {
                    overlayHeight.value = event.height;
                    freeTransform.value.style.height = overlayHeight + 'px';
                }
                hideVerticalSideHandles.value = width.value < 36;
                hideHorizontalSideHandles.value = height.value < 36;
            }
        }

        return {
            DRAG_TYPE_ALL: 0,
            DRAG_TYPE_TOP: 1,
            DRAG_TYPE_BOTTOM: 2,
            DRAG_TYPE_LEFT: 4,
            DRAG_TYPE_RIGHT: 8,
            isBoundsIndeterminate,
            selectedLayerIds,
            hideVerticalSideHandles,
            hideHorizontalSideHandles,
            freeTransform,
            top: overlayTop,
            left: overlayLeft,
            width: overlayWidth,
            height: overlayHeight,
            transform: overlayTransform,
            transformOrigin: overlayTransformOrigin,
            zoom,
            rotateHandleHighlight,
            dragHandleHighlight,
            dragHandleHighlightColor,
            dragHandleHighlightBorderColor
        };
    }
});
</script>
