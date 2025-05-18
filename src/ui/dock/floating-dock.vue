<template>
    <teleport :to="floatingDocksContainer">
        <div
            ref="dockElement"
            class="og-floating-dock"
            :style="{
                transform: `translate(${left}px, ${top}px)`,
                maxWidth: `${maxWidth}px`,
                maxHeight: `${maxHeight}px`,
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
import { nextTick, onMounted, onUnmounted, ref, toRef, toRefs, watch } from 'vue';

import vPointer from '@/directives/pointer';

import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';

const props = defineProps({
    top: {
        type: Number,
        default: 0,
    },
    left: {
        type: Number,
        default: 0,
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

onMounted(() => {
    boundingBox = dockElement.value!.getBoundingClientRect();
    nextTick(limitDragBounds);
});

watch(() => [props.top, props.left], (newProps, oldProps) => {
    if (newProps[0] !== oldProps?.[0] || newProps[1] !== oldProps?.[1]) {
        top.value = props.top;
        left.value = props.left;
        if (!dockElement.value) return;
        boundingBox = dockElement.value.getBoundingClientRect();
        nextTick(limitDragBounds);
    }
}, { immediate: true });

watch([dndAreaLeft, dndAreaTop, dndAreaWidth, dndAreaHeight], () => {
    if (!dockElement.value) return;
    boundingBox = dockElement.value.getBoundingClientRect();
    nextTick(limitDragBounds);
}, { immediate: true });

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
    boundingBox = dockElement.value.getBoundingClientRect();
}

function onDragEndGrip() {
    isDragging = false;
}

function onPointerMoveGrip(e: PointerEvent) {
    if (!isDragging) return;
    left.value = dragStartLeft + e.pageX - dragStartX;
    top.value = dragStartTop + e.pageY - dragStartY;
    limitDragBounds();
}

</script>