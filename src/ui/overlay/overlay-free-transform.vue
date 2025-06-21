<template>
    <div ref="overlay" class="og-canvas-overlay">
        <div ref="freeTransform"
            v-show="selectedLayerCount > 0 && !isBoundsIndeterminate"
            class="og-free-transform"
            :style="{
                width: overlayWidth + 'px',
                height: overlayHeight + 'px',
                transform: overlayTransform,
                transformOrigin: overlayTransformOrigin,
            }"
        >
            <div class="og-free-transform-bounds" :style="{
                outlineWidth: (0.35/zoom) + 'rem'
            }"></div>
            <div class="og-free-transform-handle-rotate" :style="{ transform: 'scale(' + (1/zoom) + ')', top: (-2 / zoom) + 'rem' }">
                <div class="og-free-transform-handle-rotate-line"></div>
                <svg viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="white" :stroke="rotateHandleHighlight === true ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="10" />
                    <circle cx="50" cy="50" r="25" :fill="rotateHandleHighlight === true ? dragHandleHighlightBorderColor : '#ccc'" />
                </svg>
            </div>
            <div v-show="isResizeEnabled && isUnevenScalingEnabled && !hideVerticalSideHandles" class="og-free-transform-handle-top" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path d="M10 10 L90 10 L90 90 L10 90 Z"
                        :fill="dragHandleHighlight === DRAG_TYPE_TOP ? dragHandleHighlightColor : 'white'"
                        :stroke="dragHandleHighlight === DRAG_TYPE_TOP ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="10" />
                </svg>
            </div>
            <div v-show="isResizeEnabled && isUnevenScalingEnabled && !hideHorizontalSideHandles" class="og-free-transform-handle-left" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path d="M10 10 L90 10 L90 90 L10 90 Z"
                        :fill="dragHandleHighlight === DRAG_TYPE_LEFT ? dragHandleHighlightColor : 'white'"
                        :stroke="dragHandleHighlight === DRAG_TYPE_LEFT ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="10" />
                </svg>
            </div>
            <div v-show="isResizeEnabled && isUnevenScalingEnabled && !hideVerticalSideHandles" class="og-free-transform-handle-bottom" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path d="M10 10 L90 10 L90 90 L10 90 Z"
                        :fill="dragHandleHighlight === DRAG_TYPE_BOTTOM ? dragHandleHighlightColor : 'white'"
                        :stroke="dragHandleHighlight === DRAG_TYPE_BOTTOM ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="10" />
                </svg>
            </div>
            <div v-show="isResizeEnabled && isUnevenScalingEnabled && !hideHorizontalSideHandles" class="og-free-transform-handle-right" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path d="M10 10 L90 10 L90 90 L10 90 Z"
                        :fill="dragHandleHighlight === DRAG_TYPE_RIGHT ? dragHandleHighlightColor : 'white'"
                        :stroke="dragHandleHighlight === DRAG_TYPE_RIGHT ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="10" />
                </svg>
            </div>
            <div v-show="isResizeEnabled" class="og-free-transform-handle-top-left" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path d="M10 10 L90 10 L90 90 L10 90 Z"
                        :fill="dragHandleHighlight === (DRAG_TYPE_TOP | DRAG_TYPE_LEFT) ? dragHandleHighlightColor : 'white'"
                        :stroke="dragHandleHighlight === (DRAG_TYPE_TOP | DRAG_TYPE_LEFT) ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="10" />
                </svg>
            </div>
            <div v-show="isResizeEnabled" class="og-free-transform-handle-top-right" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path d="M10 10 L90 10 L90 90 L10 90 Z"
                        :fill="dragHandleHighlight === (DRAG_TYPE_TOP | DRAG_TYPE_RIGHT) ? dragHandleHighlightColor : 'white'"
                        :stroke="dragHandleHighlight === (DRAG_TYPE_TOP | DRAG_TYPE_RIGHT) ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="10" />
                </svg>
            </div>
            <div v-show="isResizeEnabled" class="og-free-transform-handle-bottom-left" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path d="M10 10 L90 10 L90 90 L10 90 Z"
                        :fill="dragHandleHighlight === (DRAG_TYPE_BOTTOM | DRAG_TYPE_LEFT) ? dragHandleHighlightColor : 'white'"
                        :stroke="dragHandleHighlight === (DRAG_TYPE_BOTTOM | DRAG_TYPE_LEFT) ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="10" />
                </svg>
            </div>
            <div v-show="isResizeEnabled" class="og-free-transform-handle-bottom-right" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                <svg viewBox="0 0 100 100">
                    <path d="M10 10 L90 10 L90 90 L10 90 Z"
                        :fill="dragHandleHighlight === (DRAG_TYPE_BOTTOM | DRAG_TYPE_RIGHT) ? dragHandleHighlightColor : 'white'"
                        :stroke="dragHandleHighlight === (DRAG_TYPE_BOTTOM | DRAG_TYPE_RIGHT) ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="10" />
                </svg>
            </div>
        </div>
        <div class="og-free-transform-snapping-guides">
            <div
                v-if="snapLineX.length > 0"
                class="og-free-transform-snapping-guide-vertical"
                :style="{
                    transform: `translate(${snapLineX[0] - (1.0 / zoom)}px, ${snapLineXMinY}px)`,
                    height: (snapLineXMaxY - snapLineXMinY) + 'px',
                    width: (2.0 / zoom) + 'px',
                    outlineWidth: (2.0 / zoom) + 'px',
                }"
            />
            <div
                v-for="i in (snapLineX.length / 2)"
                class="og-free-transform-snapping-guide-point"
                :style="{
                    transform: `translate(${snapLineX[(i-1)*2]}px, ${snapLineX[((i-1)*2)+1]}px)`,
                    width: (6.0 / zoom) + 'px',
                    height: (6.0 / zoom) + 'px',
                }"
            />
            <div
                v-if="snapLineY.length > 0"
                class="og-free-transform-snapping-guide-horizontal"
                :style="{
                    transform: `translate(${snapLineYMinX}px, ${snapLineY[1] - (1.0 / zoom)}px)`,
                    width: (snapLineYMaxX - snapLineYMinX) + 'px',
                    height: (2.0 / zoom) + 'px',
                    outlineWidth: (2.0 / zoom) + 'px',
                }"
            />
            <div
                v-for="i in (snapLineY.length / 2)"
                class="og-free-transform-snapping-guide-point"
                :style="{
                    transform: `translate(${snapLineY[(i-1)*2]}px, ${snapLineY[((i-1)*2)+1]}px)`,
                    width: (6.0 / zoom) + 'px',
                    height: (6.0 / zoom) + 'px',
                }"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import {
    isBoundsIndeterminate, freeTransformEmitter, left, top, width, height, rotation,
    transformOriginX, transformOriginY, dragHandleHighlight, rotateHandleHighlight, selectedLayers,
    isResizeEnabled, isUnevenScalingEnabled, snapLineX, snapLineY,
} from '@/canvas/store/free-transform-state';
import canvasStore from '@/store/canvas';

defineOptions({
    name: 'CanvasOverlayCropResize',
});

const DRAG_TYPE_ALL = 0;
const DRAG_TYPE_TOP = 1;
const DRAG_TYPE_BOTTOM = 2;
const DRAG_TYPE_LEFT = 4;
const DRAG_TYPE_RIGHT = 8;

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

const selectedLayerCount = computed<number>(() => {
    return selectedLayers.value.length;
});

const snapLineXMinY = computed(() => {
    if (snapLineX.value.length == 0) return 0;
    return snapLineX.value.reduce((previousValue, currentValue, currentIndex) => {
        return currentIndex % 2 === 0 ? previousValue : Math.min(previousValue, currentValue);
    }, Infinity);
});

const snapLineXMaxY = computed(() => {
    if (snapLineX.value.length == 0) return 0;
    return snapLineX.value.reduce((previousValue, currentValue, currentIndex) => {
        return currentIndex % 2 === 0 ? previousValue : Math.max(previousValue, currentValue);
    }, -Infinity);
});

const snapLineYMinX = computed(() => {
    if (snapLineY.value.length == 0) return 0;
    return snapLineY.value.reduce((previousValue, currentValue, currentIndex) => {
        return currentIndex % 2 === 1 ? previousValue : Math.min(previousValue, currentValue);
    }, Infinity);
});

const snapLineYMaxX = computed(() => {
    if (snapLineY.value.length == 0) return 0;
    return snapLineY.value.reduce((previousValue, currentValue, currentIndex) => {
        return currentIndex % 2 === 1 ? previousValue : Math.max(previousValue, currentValue);
    }, -Infinity);
});

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
</script>
