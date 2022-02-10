<template>
    <div ref="rootEl" class="el-horizontal-scrollbar-arrows">
        <el-button
            type="text" class="is-flex-grow-0 is-border-radius-attach-right px-2 py-0"
            aria-label="Scroll Left" :style="{ visibility: canScrollLeft ? '' : 'hidden' }"
            @click="onClickScrollLeft()">
            <span class="bi bi-chevron-left" aria-hidden="true" />
        </el-button>
        <el-scrollbar ref="scrollbar" @scroll="onScroll">
            <div ref="scrollContentEl" class="is-flex is-align-items-center">
                <slot />
            </div>
        </el-scrollbar>
        <el-button
            type="text" class="is-flex-grow-0 is-border-radius-attach-left px-2 py-0"
            aria-label="Scroll Right" :style="{ visibility: canScrollRight ? '' : 'hidden' }"
            @click="onClickScrollRight()">
            <span class="bi bi-chevron-right" aria-hidden="true" />
        </el-button>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, toRefs, watch, onUnmounted } from 'vue';
import ElButton from 'element-plus/lib/components/button/index';
import ElScrollbar from 'element-plus/lib/components/scrollbar/index';
import ResizeObserver from 'resize-observer-polyfill';
import canvasStore from '@/store/canvas';

export default defineComponent({
    name: 'ElHorizontalScrollbarArrows',
    components: {
        ElButton,
        ElScrollbar
    },
    props: {

    },
    setup(props, { emit }) {
        const rootEl = ref<HTMLDivElement>();
        const scrollContentEl = ref<HTMLDivElement>();
        const scrollbar = ref<InstanceType<typeof ElScrollbar>>();
        const { viewWidth } = toRefs(canvasStore.state);

        const scrollLeft = ref<number>(0);
        const canScrollLeft = ref<boolean>(true);
        const canScrollRight = ref<boolean>(true);

        let resizeObserver: ResizeObserver | null = null;

        watch([viewWidth], () => {
            handleScrollChange();
        });

        onMounted(() => {
            handleScrollChange();

            if (typeof ResizeObserver !== 'undefined') {
                resizeObserver = new ResizeObserver((entries) => {
                    for (let entry of entries) {
                        if (entry.target === rootEl.value) {
                            handleScrollChange();
                        }
                    }
                });
                resizeObserver.observe(rootEl.value as Element);
            }
        });

        onUnmounted(() => {
            resizeObserver?.disconnect();
        });

        function onScroll(scrollInfo: any) {
            scrollLeft.value = scrollInfo.scrollLeft;
            handleScrollChange();
        }

        function handleScrollChange() {
            canScrollLeft.value = scrollLeft.value > 0;
            canScrollRight.value = scrollLeft.value < scrollContentEl.value!.clientWidth - scrollbar.value!.scrollbar$!.clientWidth;
        }

        function onClickScrollLeft() {
            scrollbar.value!.setScrollLeft(scrollLeft.value - (scrollContentEl.value!.clientWidth * .6));
        }

        function onClickScrollRight() {
            scrollbar.value!.setScrollLeft(scrollLeft.value + (scrollContentEl.value!.clientWidth * .6));
        }

        return {
            rootEl,
            scrollContentEl,
            scrollbar,
            canScrollLeft,
            canScrollRight,
            onClickScrollLeft,
            onClickScrollRight,
            onScroll
        };
    }
});
</script>
