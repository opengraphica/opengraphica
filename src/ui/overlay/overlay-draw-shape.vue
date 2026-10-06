<template>
    <div ref="overlay" class="og-canvas-overlay is-full-canvas-area">
        <div
            v-show="selectedShapes.length > 0"
            class="absolute!"
            :style="{
                transform: cssViewTransform,
                opacity: isTransformBoundsTransparent ? 0.5 : 1
            }"
        >
            <div ref="freeTransform"
                class="og-free-transform"
                :style="{
                    width: transformOverlayWidth + 'px',
                    height: transformOverlayHeight + 'px',
                    transform: transformOverlayTransform,
                    transformOrigin: transformOverlayTransformOrigin,
                }"
            >
                <div class="og-free-transform-bounds" :style="{
                    outlineWidth: (0.35/zoom) + 'rem'
                }"></div>
                <div class="og-free-transform-handle-rotate" :style="{ transform: 'scale(' + (1/zoom) + ')', top: (-2 / zoom) + 'rem' }">
                    <div class="og-free-transform-handle-rotate-line"></div>
                    <svg viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="white" :stroke="transformRotateHandleHighlight === true ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="10" />
                        <circle cx="50" cy="50" r="25" :fill="transformRotateHandleHighlight === true ? dragHandleHighlightBorderColor : '#ccc'" />
                    </svg>
                </div>
                <div v-show="!hideVerticalSideHandles" class="og-free-transform-handle-top" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                    <svg viewBox="0 0 100 100">
                        <path d="M10 10 L90 10 L90 90 L10 90 Z"
                            :fill="transformDragHandleHighlight === DRAG_TYPE_TOP ? dragHandleHighlightColor : 'white'"
                            :stroke="transformDragHandleHighlight === DRAG_TYPE_TOP ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="10" />
                    </svg>
                </div>
                <div v-show="!hideHorizontalSideHandles" class="og-free-transform-handle-left" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                    <svg viewBox="0 0 100 100">
                        <path d="M10 10 L90 10 L90 90 L10 90 Z"
                            :fill="transformDragHandleHighlight === DRAG_TYPE_LEFT ? dragHandleHighlightColor : 'white'"
                            :stroke="transformDragHandleHighlight === DRAG_TYPE_LEFT ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="10" />
                    </svg>
                </div>
                <div v-show="!hideVerticalSideHandles" class="og-free-transform-handle-bottom" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                    <svg viewBox="0 0 100 100">
                        <path d="M10 10 L90 10 L90 90 L10 90 Z"
                            :fill="transformDragHandleHighlight === DRAG_TYPE_BOTTOM ? dragHandleHighlightColor : 'white'"
                            :stroke="transformDragHandleHighlight === DRAG_TYPE_BOTTOM ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="10" />
                    </svg>
                </div>
                <div v-show="!hideHorizontalSideHandles" class="og-free-transform-handle-right" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                    <svg viewBox="0 0 100 100">
                        <path d="M10 10 L90 10 L90 90 L10 90 Z"
                            :fill="transformDragHandleHighlight === DRAG_TYPE_RIGHT ? dragHandleHighlightColor : 'white'"
                            :stroke="transformDragHandleHighlight === DRAG_TYPE_RIGHT ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="10" />
                    </svg>
                </div>
                <div class="og-free-transform-handle-top-left" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                    <svg viewBox="0 0 100 100">
                        <path d="M10 10 L90 10 L90 90 L10 90 Z"
                            :fill="transformDragHandleHighlight === (DRAG_TYPE_TOP | DRAG_TYPE_LEFT) ? dragHandleHighlightColor : 'white'"
                            :stroke="transformDragHandleHighlight === (DRAG_TYPE_TOP | DRAG_TYPE_LEFT) ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="10" />
                    </svg>
                </div>
                <div class="og-free-transform-handle-top-right" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                    <svg viewBox="0 0 100 100">
                        <path d="M10 10 L90 10 L90 90 L10 90 Z"
                            :fill="transformDragHandleHighlight === (DRAG_TYPE_TOP | DRAG_TYPE_RIGHT) ? dragHandleHighlightColor : 'white'"
                            :stroke="transformDragHandleHighlight === (DRAG_TYPE_TOP | DRAG_TYPE_RIGHT) ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="10" />
                    </svg>
                </div>
                <div class="og-free-transform-handle-bottom-left" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                    <svg viewBox="0 0 100 100">
                        <path d="M10 10 L90 10 L90 90 L10 90 Z"
                            :fill="transformDragHandleHighlight === (DRAG_TYPE_BOTTOM | DRAG_TYPE_LEFT) ? dragHandleHighlightColor : 'white'"
                            :stroke="transformDragHandleHighlight === (DRAG_TYPE_BOTTOM | DRAG_TYPE_LEFT) ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="10" />
                    </svg>
                </div>
                <div class="og-free-transform-handle-bottom-right" :style="{ transform: 'scale(' + (1/zoom) + ')' }">
                    <svg viewBox="0 0 100 100">
                        <path d="M10 10 L90 10 L90 90 L10 90 Z"
                            :fill="transformDragHandleHighlight === (DRAG_TYPE_BOTTOM | DRAG_TYPE_RIGHT) ? dragHandleHighlightColor : 'white'"
                            :stroke="transformDragHandleHighlight === (DRAG_TYPE_BOTTOM | DRAG_TYPE_RIGHT) ? dragHandleHighlightBorderColor : '#ccc'" stroke-width="10" />
                    </svg>
                </div>
            </div>
        </div>
        <div v-show="selectedShapes.length === 0" class="og-selection">
            <svg
                v-if="editControlPoints.length > 0 || previewInvisibleStrokeStart != null"
                :width="svgBoundsWidth"
                :height="svgBoundsHeight"
                xmlns="http://www.w3.org/2000/svg">
                <template v-for="(point, i) in selectedEditControlAttachPoints" :key="i + '_' + point.x + '_' + point.y">
                    <line
                        :x1="editControlPoints[point.attachToIndex!].tx!"
                        :y1="editControlPoints[point.attachToIndex!].ty!"
                        :x2="point.tx!"
                        :y2="point.ty!"
                        :style="{
                            stroke: 'white', 
                            strokeWidth: svgHandleWidth,
                        }"
                    />
                    <line
                        :x1="editControlPoints[point.attachToIndex!].tx!"
                        :y1="editControlPoints[point.attachToIndex!].ty!"
                        :x2="point.tx!"
                        :y2="point.ty!"
                        :style="{
                            stroke: '#333333', 
                            strokeWidth: svgHandleWidth * 0.5,
                        }"
                    />
                </template>
                <template v-if="previewInvisibleStrokeStart != null">
                    <line
                        :x1="transformedPreviewInvisibleStrokeStartX"
                        :y1="transformedPreviewInvisibleStrokeStartY"
                        :x2="transformedCursorHoverX"
                        :y2="transformedCursorHoverY"
                        :style="{
                            stroke: 'white', 
                            strokeWidth: svgHandleWidth,
                        }"
                    />
                    <line
                        :x1="transformedPreviewInvisibleStrokeStartX"
                        :y1="transformedPreviewInvisibleStrokeStartY"
                        :x2="transformedCursorHoverX"
                        :y2="transformedCursorHoverY"
                        :style="{
                            stroke: '#333333', 
                            strokeWidth: svgHandleWidth * 0.5,
                        }"
                    />
                </template>
                <template v-if="isExtendingPaths && hoveringEditControlPointIndices.length === 0">
                    <template v-for="(point, i) of selectedEditControlPoints" :key="i + '_' + point.x + '_' + point.y">
                        <line
                            :x1="point.tx!"
                            :y1="point.ty!"
                            :x2="transformedCursorHoverX"
                            :y2="transformedCursorHoverY"
                            :style="{
                                stroke: 'white', 
                                strokeWidth: svgHandleWidth,
                            }"
                        />
                        <line
                            :x1="point.tx!"
                            :y1="point.ty!"
                            :x2="transformedCursorHoverX"
                            :y2="transformedCursorHoverY"
                            :style="{
                                stroke: '#333333', 
                                strokeWidth: svgHandleWidth * 0.5,
                            }"
                        />
                    </template>
                </template>
                <template v-for="(point, i) in editControlPoints" :key="i + '_' + point.x + '_' + point.y">
                    <template v-if="point.attachToIndex == null">
                        <rect
                            :x="point.tx! - (svgHandleWidth * 1.4)"
                            :y="point.ty! - (svgHandleWidth * 1.4)"
                            :width="svgHandleWidth * 2.8"
                            :height="svgHandleWidth * 2.8"
                            :stroke-width="0"
                            :class="{ 'og-selection-handle--selected': selectedEditControlPointIndices.includes(i) }"
                        />
                        <rect
                            :x="point.tx! - (svgHandleWidth)"
                            :y="point.ty! - (svgHandleWidth)"
                            :width="svgHandleWidth * 2"
                            :height="svgHandleWidth * 2"
                            :stroke-width="svgHandleWidth * .3"
                            :class="{ 'og-selection-handle--selected': selectedEditControlPointIndices.includes(i) }"
                        />
                        <rect
                            v-if="point.isLast"
                            :x="point.tx! - (svgHandleWidth * 0.5)"
                            :y="point.ty! - (svgHandleWidth * 0.5)"
                            :width="svgHandleWidth * 1"
                            :height="svgHandleWidth * 1"
                            :stroke-width="0"
                            style="fill: black"
                        />
                    </template>
                    <template v-else-if="selectedEditControlAttachPointIndices.includes(i)">
                        <circle
                            :cx="point.tx!"
                            :cy="point.ty!"
                            :r="svgHandleWidth * 1.6"
                            :stroke-width="0"
                            :class="{ 'og-selection-handle--selected': selectedEditControlPointIndices.includes(i) }"
                        />
                        <circle
                            :cx="point.tx!"
                            :cy="point.ty!"
                            :r="svgHandleWidth * 1.2"
                            :stroke-width="svgHandleWidth * .3"
                            :class="{ 'og-selection-handle--selected': selectedEditControlPointIndices.includes(i) }"
                        />
                    </template>
                </template>
            </svg>
        </div>
        <div class="og-tool-overlay-snapping-guides" :style="{ transform: cssViewTransform }">
            <div
                v-if="snapLineX.length > 0"
                class="og-tool-overlay-snapping-guide-vertical"
                :style="{
                    transform: `translate(${snapLineX[0] - (1.0 / zoom)}px, ${snapLineXMinY}px)`,
                    height: (snapLineXMaxY - snapLineXMinY) + 'px',
                    width: (2.0 / zoom) + 'px',
                    outlineWidth: (2.0 / zoom) + 'px',
                }"
            />
            <div
                v-for="i in (snapLineX.length / 2)"
                class="og-tool-overlay-snapping-guide-point"
                :style="{
                    transform: `translate(${snapLineX[(i-1)*2]}px, ${snapLineX[((i-1)*2)+1]}px)`,
                    width: (6.0 / zoom) + 'px',
                    height: (6.0 / zoom) + 'px',
                }"
            />
            <div
                v-if="snapLineY.length > 0"
                class="og-tool-overlay-snapping-guide-horizontal"
                :style="{
                    transform: `translate(${snapLineYMinX}px, ${snapLineY[1] - (1.0 / zoom)}px)`,
                    width: (snapLineYMaxX - snapLineYMinX) + 'px',
                    height: (2.0 / zoom) + 'px',
                    outlineWidth: (2.0 / zoom) + 'px',
                }"
            />
            <div
                v-for="i in (snapLineY.length / 2)"
                class="og-tool-overlay-snapping-guide-point"
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
import { computed, onMounted, onUnmounted, ref, toRefs, watch } from 'vue';

import canvasStore from '@/store/canvas';
import workingFileStore from '@/store/working-file';

import {
    drawShapeToolbarEmitter,
    cursorHoverPosition, isExtendingPaths, previewInvisibleStrokeStart,
    editControlPoints, editControlPointsDirty,
    hoveringEditControlPointIndices,
    selectedEditControlPointIndices, selectedEditControlAttachPointIndices,
    snapLineX, snapLineY,
    selectedShapes, transformDragHandleHighlight, transformRotateHandleHighlight,
    transformBoundsTop, transformBoundsLeft, transformBoundsWidth, transformBoundsHeight,
    transformBoundsRotation, transformOriginX, transformOriginY,
    isTransformBoundsTransparent,
} from '@/canvas/store/draw-shape-state';

defineOptions({
    name: 'CanvasOverlayDrawShape',
});

const props = defineProps({
    cssViewTransform: {
        type: String,
        default: 'matrix(1, 0, 0, 1, 0, 0)',
    },
})

const { transform, viewWidth, viewHeight, viewDirty } = toRefs(canvasStore.state);

/*----------------*\
| General Viewport |
\*----------------*/

const transformedCursorHoverX = ref(0);
const transformedCursorHoverY = ref(0);
const transformedPreviewInvisibleStrokeStartX = ref(0);
const transformedPreviewInvisibleStrokeStartY = ref(0);

const devicePixelRatio = window.devicePixelRatio || 1;

const zoom = computed<number>(() => {
    const decomposedTransform = canvasStore.state.decomposedTransform;
    let appliedZoom: number = decomposedTransform.scaleX;
    return appliedZoom / devicePixelRatio;
});

const svgHandleWidth = computed<number>(() => {
    const zoomRatio = Math.max(workingFileStore.get('width'), workingFileStore.get('height')) / 100;
    return Math.min(5, zoom.value * zoomRatio);
});
const svgBoundsWidth = computed<number>(() => {
    return viewWidth.value / devicePixelRatio;
});
const svgBoundsHeight = computed<number>(() => {
    return viewHeight.value / devicePixelRatio;
});

/*--------------*\
| Control Points |
\*--------------*/

const selectedEditControlPoints = computed(() => {
    return selectedEditControlPointIndices.value.map(
        (index) => editControlPoints.value[index]
    ).filter((point) => point.attachToIndex == null);
});

const selectedEditControlAttachPoints = computed(() => {
    return selectedEditControlAttachPointIndices.value.map((index) => editControlPoints.value[index]);
});

watch([editControlPoints, viewDirty, editControlPointsDirty], () => {
    editControlPointsDirty.value = false;
    for (const point of editControlPoints.value) {
        const position = new DOMPoint(point.x, point.y).matrixTransform(transform.value);
        point.tx = position.x / devicePixelRatio;
        point.ty = position.y / devicePixelRatio;
    }
});

watch([cursorHoverPosition], () => {
    const point = cursorHoverPosition.value.matrixTransform(
        new DOMMatrix().scale(1 / devicePixelRatio).multiply(transform.value)
    );
    transformedCursorHoverX.value = point.x;
    transformedCursorHoverY.value = point.y;

});

watch([previewInvisibleStrokeStart], () => {
    if (!previewInvisibleStrokeStart.value) return;
    const point = previewInvisibleStrokeStart.value.matrixTransform(
        new DOMMatrix().scale(1 / devicePixelRatio).multiply(transform.value)
    );
    transformedPreviewInvisibleStrokeStartX.value = point.x;
    transformedPreviewInvisibleStrokeStartY.value = point.y;
});

/*--------*\
| Snapping |
\*--------*/

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

/*---------------*\
| Shape Transform |
\*---------------*/

const freeTransform = ref<HTMLDivElement>(null as any);

const DRAG_TYPE_TOP = 1;
const DRAG_TYPE_BOTTOM = 2;
const DRAG_TYPE_LEFT = 4;
const DRAG_TYPE_RIGHT = 8;

const transformOverlayWidth = ref<number>(0);
const transformOverlayHeight = ref<number>(0);
const transformOverlayTransform = ref<string>('');
const transformOverlayTransformOrigin = ref<string>('0% 0%');

const hideVerticalSideHandles = ref<boolean>(false);
const hideHorizontalSideHandles = ref<boolean>(false);

const dragHandleHighlightColor: string = '#ecf5ff';
const dragHandleHighlightBorderColor: string= '#b3d8ff';

onMounted(() => {
    drawShapeToolbarEmitter.on('setTransformDimensions', setTransformDimensions);
    setTransformDimensions({
        top: transformBoundsTop.value,
        left: transformBoundsLeft.value,
        width: transformBoundsWidth.value,
        height: transformBoundsHeight.value,
        rotation: transformBoundsRotation.value,
        transformOriginX: transformOriginX.value,
        transformOriginY: transformOriginY.value
    });
});

onUnmounted(() => {
    drawShapeToolbarEmitter.off('setTransformDimensions', setTransformDimensions);
});

function setTransformDimensions(event?: { top?: number, left?: number, width?: number, height?: number, rotation?: number, transformOriginX?: number, transformOriginY?: number }) {
    if (event) {
        transformOverlayTransformOrigin.value = `${transformOriginY.value * 100}% ${transformOriginX.value * 100}%`;
        freeTransform.value.style.transformOrigin = transformOverlayTransformOrigin.value;
        const overlayTransformMatrix =
            new DOMMatrix()
            .translateSelf(event.left ?? transformBoundsLeft.value, event.top ?? transformBoundsTop.value)
            .rotateSelf((event.rotation ?? transformBoundsRotation.value) * Math.RADIANS_TO_DEGREES);
        transformOverlayTransform.value = `matrix(${overlayTransformMatrix.a},${overlayTransformMatrix.b},${overlayTransformMatrix.c},${overlayTransformMatrix.d},${overlayTransformMatrix.e},${overlayTransformMatrix.f})`;
        freeTransform.value.style.transform = transformOverlayTransform.value;
        if (event.width != null) {
            transformOverlayWidth.value = event.width;
            freeTransform.value.style.width = transformOverlayWidth + 'px';
        }
        if (event.height != null) {
            transformOverlayHeight.value = event.height;
            freeTransform.value.style.height = transformOverlayHeight + 'px';
        }
        hideVerticalSideHandles.value = transformBoundsWidth.value < 36;
        hideHorizontalSideHandles.value = transformBoundsHeight.value < 36;
    }
}

</script>
