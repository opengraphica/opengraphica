<template>
    <div class="el-auto-grid" :style="{ '--item-desired-width': desiredWidth, '--row-gap': rowGap, '--column-gap': columnGap }">
        <slot />
    </div>
</template>
<script lang="ts">
import { defineComponent, ref, reactive, computed, watch, toRefs, nextTick, onUnmounted } from 'vue';
import canvasStore from '@/store/canvas';
import { throttle } from '@/lib/timing';

import type { PropType, WatchStopHandle } from 'vue';

interface AutoGridBreakpoint {
    maxWidth: number,
    itemWidth: string
}

export default defineComponent({
    name: 'ElAutoGrid',
    inheritAttrs: false,
    props: {
        itemWidth: {
            type: String,
            default: '10rem'
        },
        breakpoints: {
            type: Array as PropType<AutoGridBreakpoint[]>,
            default: () => []
        },
        useDeviceRatio: {
            type: Boolean,
            default: false
        },
        rowGap: {
            type: String,
            default: '.4rem'
        },
        columnGap: {
            type: String,
            default: '.4rem'
        }
    },
    setup(props) {
        let currentBreakpointItemWidth = ref(props.itemWidth);

        const desiredWidth = computed(() => {
            const itemWidth = currentBreakpointItemWidth.value;
            const deviceRatio = props.useDeviceRatio ? window.devicePixelRatio : 1;
            const itemWidthNumber = parseFloat(itemWidth);
            const itemWidthUnit = itemWidth.replace(itemWidthNumber + '', '');
            return (itemWidthNumber / deviceRatio) + itemWidthUnit;
        });

        const { viewWidth } = toRefs(canvasStore.state);

        const sortedBreakpoints = computed(() => {
            return props.breakpoints.sort((a, b) => {
                if (a.maxWidth > b.maxWidth) return -1;
                if (a.maxWidth < b.maxWidth) return 1;
                return 0;
            });
        });

        let viewWidthUnwatch: WatchStopHandle | null = null;

        watch(() => props.itemWidth, () => {
            recalculateBreakpoint(viewWidth.value);
        })

        watch([sortedBreakpoints], ([sortedBreakpoints]) => {
            if (sortedBreakpoints.length > 0 && !viewWidthUnwatch) {
                viewWidthUnwatch = watch([viewWidth], throttle(([viewWidth]) => {
                    recalculateBreakpoint(viewWidth);
                }, 50), { immediate: true });
            }
            if (sortedBreakpoints.length === 0 && viewWidthUnwatch) {
                viewWidthUnwatch();
            }
        }, { immediate: true });

        function recalculateBreakpoint(viewWidth: number) {
            viewWidth = viewWidth / (window.devicePixelRatio ?? 1);
            let itemWidth = props.itemWidth;
            for (const breakpoint of props.breakpoints) {
                if (viewWidth <= breakpoint.maxWidth) {
                    itemWidth = breakpoint.itemWidth;
                    break;
                }
            }
            currentBreakpointItemWidth.value = itemWidth;
        }

        onUnmounted(() => {
            viewWidthUnwatch?.();
        });

        return {
            desiredWidth
        };
    }
});
</script>
