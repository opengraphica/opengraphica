<template>
    <teleport to="#og-popover-container">
        <transition
            name="og-transition-fade"
            @after-leave="emit('hidden')"
        >
            <div
                v-if="visible"
                v-pointer.down.window="onPointerDownWindow"
                v-pointer.up.window="onPointerUpWindow"
                ref="popover"
                class="og-popover og-transition-fast"
                :class="['og-popover--' + placement]"
                :style="floatingStyles"
            >
                <div
                    v-if="props.arrow"
                    ref="floatingArrow"
                    class="og-popover__arrow"
                    :style="{
                        position: 'absolute',
                        left:
                            middlewareData.arrow?.x != null
                                ? `${middlewareData.arrow.x}px`
                                : '',
                        top:
                            middlewareData.arrow?.y != null
                                ? `${middlewareData.arrow.y}px`
                                : '',
                    }"
                />
                <slot />
            </div>
        </transition>
    </teleport>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import { arrow, flip, offset, useFloating } from '@floating-ui/vue';

import vPointer from '@/directives/pointer';

import type { PropType, Ref } from 'vue';
import type { Placement } from '@floating-ui/vue';

const props = defineProps({
    arrow: {
        type: Boolean,
        default: false,
    },
    offset: {
        type: Number,
    },
    placement: {
        type: String as PropType<Placement>,
    },
    reference: {
        type: Object as PropType<HTMLElement | undefined>,
        required: true,
    },
    visible: {
        type: Boolean,
        default: false,
    }
});

const emit = defineEmits<{
    (e: 'update:visible', visible: boolean): void;
    (e: 'hidden'): void;
}>();

const popover = ref<HTMLDivElement>();
const floatingArrow = ref<HTMLDivElement>();

const { floatingStyles, middlewareData, placement } = useFloating(
    computed(() => props.reference),
    popover,
    {
        placement: computed(() => props.placement),
        middleware: [
            arrow({
                element: floatingArrow
            }),
            offset(props.offset != null ? props.offset : (props.arrow ? 6 : 0)),
            flip({
                fallbackAxisSideDirection: 'end',
            }),
        ],
    },
);

function onPointerDownWindow(event: PointerEvent) {
    hideIfClickedOutsidePopover(event);
}

function onPointerUpWindow(event: PointerEvent) {
    hideIfClickedOutsidePopover(event);
}

function hideIfClickedOutsidePopover(event: PointerEvent) {
    if (!popover.value || !event.target || !props.visible) return;
    if (
        !popover.value.contains(event.target as HTMLElement)
        && !props.reference?.contains(event.target as HTMLElement)
        && props.visible
    ) {
        emit('update:visible', false);
    }
}

</script>