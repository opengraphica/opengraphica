<template>
    <teleport :to="floatingDocksContainer">
        <div
            ref="dockElement"
            class="og-floating-dock"
            :class="{
                'og-floating-dock--visible': props.visible
            }"
            :style="{
                transform: `translate(${left}px, ${top}px)`,
                maxWidth: `${maxWidth}px`,
                maxHeight: `${maxHeight}px`,
                zIndex: floatingDockRect.order,
            }">
            <div
                class="og-floating-dock__grip"
                v-pointer.dragstart="onDragStartGrip"
                v-pointer.dragend="onDragEndGrip"
                v-pointer.move.window="onPointerMoveGrip"
            >
                <span class="bi bi-grip-vertical" aria-hidden="true" />
            </div>
            <div class="og-floating-dock__content">
                <slot />
            </div>
        </div>
    </teleport>
</template>
<script setup lang="ts">
import { v4 as uuidv4 } from 'uuid';
import { nextTick, onMounted, onUnmounted, reactive, ref, toRef, toRefs, watch } from 'vue';

import vPointer from '@/directives/pointer';

import canvasStore from '@/store/canvas';
import editorStore, { type FloatingDockRect } from '@/store/editor';

type RectPosition = Omit<FloatingDockRect, 'id' | 'width' | 'height' | 'order'>;

const props = defineProps({
    top: {
        type: Number,
        default: 0,
    },
    left: {
        type: Number,
        default: 0,
    },
    visible: {
        type: Boolean,
        default: true,
    }
});

const emit = defineEmits(['update:top', 'update:left']);

const floatingDocksContainer = toRef(editorStore.state, 'floatingDocksContainer');
const { dndAreaLeft, dndAreaTop, dndAreaWidth, dndAreaHeight } = toRefs(canvasStore.state);

const devicePixelRatio = window.devicePixelRatio || 1;
const dockElement = ref<HTMLDivElement>();
const top = ref<number>(0);
const left = ref<number>(0);
const maxHeight = ref<number>(10000000);
const maxWidth = ref<number>(10000000);

let boundingBox: DOMRect;
const placementMargin = 8;

const floatingDockRect: FloatingDockRect = reactive({
    id: uuidv4(),
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    order: 0,
});

onMounted(() => {
    calculateBoundingBox();
    const rects = editorStore.get('floatingDockRects');
    rects.push(floatingDockRect);
    editorStore.set('floatingDockRects', rects);
    nextTick(placeAtBottomCenter);
    nextTick(limitDragBounds);
});

onUnmounted(() => {
    const rects = editorStore.get('floatingDockRects');
    const index = rects.findIndex((rect) => rect.id === floatingDockRect.id);
    rects.splice(index, 1);
    editorStore.set('floatingDockRects', rects);
});

watch(() => [props.top, props.left], (newProps, oldProps) => {
    if (newProps[0] !== oldProps?.[0] || newProps[1] !== oldProps?.[1]) {
        top.value = props.top;
        left.value = props.left;
        if (!dockElement.value) return;
        calculateBoundingBox();
        nextTick(limitDragBounds);
    }
}, { immediate: true });

watch([dndAreaLeft, dndAreaTop, dndAreaWidth, dndAreaHeight], () => {
    calculateBoundingBox();
    nextTick(limitDragBounds);
}, { immediate: true });

function placeAtBottomCenter() {
    if (props.left !== 0 || props.top !== 0) return;

    const rects = editorStore.get('floatingDockRects');
    const dndTop = dndAreaTop.value / devicePixelRatio;
    const dndLeft = dndAreaLeft.value / devicePixelRatio;
    const dndWidth = dndAreaWidth.value / devicePixelRatio;
    const dndHeight = dndAreaHeight.value / devicePixelRatio;
    const dndCenter = dndLeft + (dndWidth / 2);
    
    if (rects.length === 1) {
        left.value = dndLeft + (dndWidth / 2) - (boundingBox.width / 2);
        top.value = dndTop + dndHeight - boundingBox.height;
    } else {
        let potentialPositions: Array<RectPosition> = [];
        for (const rect of rects) {
            if (rect.id === floatingDockRect.id) continue;
            const bottom = rect.top + rect.height;
            let left: RectPosition = {
                left: rect.left - boundingBox.width - placementMargin,
                top: bottom - boundingBox.height,
            };
            let right: RectPosition = {
                left: rect.left + rect.width + placementMargin,
                top: bottom - boundingBox.height,
            }
            let top: RectPosition = {
                left: dndLeft + (dndWidth / 2) - (boundingBox.width / 2),
                top: rect.top - boundingBox.height - placementMargin,
            };
            if (left.left >= dndLeft) {
                potentialPositions.push(left);
            }
            if (right.left + boundingBox.width < dndLeft + dndWidth) {
                potentialPositions.push(right);
            }
            potentialPositions.push(top);
        }
        potentialPositions.sort((a, b) => {
            if (a.top !== b.top) return a.top > b.top ? -1 : 1;
            return (
                Math.abs((a.left + boundingBox.width / 2) - dndCenter) <
                Math.abs((b.left + boundingBox.width / 2) - dndCenter)
            ) ? -1 : 1;
        });
        let foundPosition: RectPosition | undefined;
        for (const potentialPosition of potentialPositions) {
            let hasConflicts = false;
            for (const rect of rects) {
                if (rect.id === floatingDockRect.id) continue;
                if (
                    rect.left < potentialPosition.left + boundingBox.width
                    && rect.left + rect.width > potentialPosition.left
                    && rect.top < potentialPosition.top + boundingBox.height
                    && rect.top + rect.height > potentialPosition.top
                ) {
                    hasConflicts = true;
                    break;
                }
            }
            if (hasConflicts) continue;
            foundPosition = potentialPosition;
            break;
        }
        if (!foundPosition) foundPosition = potentialPositions[potentialPositions.length - 1];
        left.value = foundPosition.left;
        top.value = foundPosition.top;
    }
}

function calculateBoundingBox() {
    if (!dockElement.value) return;
    boundingBox = dockElement.value.getBoundingClientRect();
    floatingDockRect.left = left.value;
    floatingDockRect.top = top.value;
    floatingDockRect.width = boundingBox.width;
    floatingDockRect.height = boundingBox.height;
}

function limitDragBounds() {
    const dndTop = dndAreaTop.value / devicePixelRatio;
    const dndLeft = dndAreaLeft.value / devicePixelRatio;
    const dndWidth = dndAreaWidth.value / devicePixelRatio;
    const dndHeight = dndAreaHeight.value / devicePixelRatio;
    maxWidth.value = dndWidth;
    maxHeight.value = dndHeight;

    if (top.value + boundingBox.height > dndTop + dndHeight) {
        top.value = dndTop + dndHeight - boundingBox.height;
    }
    if (left.value + boundingBox.width > dndLeft + dndWidth) {
        left.value = dndLeft + dndWidth - boundingBox.width;
    }
    if (top.value < dndTop) {
        top.value = dndTop;
    }
    if (left.value < dndLeft) {
        left.value = dndLeft;
    }

    floatingDockRect.top = top.value;
    floatingDockRect.left = left.value;

    emit('update:top', top.value);
    emit('update:left', left.value);
}

let isDragging = false;
let dragStartLeft = 0;
let dragStartTop = 0;
let dragStartX = 0;
let dragStartY = 0;

function onDragStartGrip(e: PointerEvent) {
    if (!dockElement.value) return;

    isDragging = true;
    dragStartLeft = left.value;
    dragStartTop = top.value;
    dragStartX = e.pageX;
    dragStartY = e.pageY;
    calculateBoundingBox();

    const rects = editorStore.get('floatingDockRects');
    if (floatingDockRect.order !== rects.length) {
        floatingDockRect.order = rects.length;
        for (let rect of rects) {
            if (rect.id === floatingDockRect.id) continue;
            rect.order = Math.max(0, rect.order - 1);
        }
    }
}

function onDragEndGrip() {
    isDragging = false;
    calculateBoundingBox();
}

function onPointerMoveGrip(e: PointerEvent) {
    if (!isDragging) return;
    left.value = dragStartLeft + e.pageX - dragStartX;
    top.value = dragStartTop + e.pageY - dragStartY;
    limitDragBounds();
}

</script>