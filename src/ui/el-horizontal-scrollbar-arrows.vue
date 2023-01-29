<template>
    <div ref="rootEl" class="el-horizontal-scrollbar-arrows">
        <el-button
            link type="primary" class="is-flex-grow-0 is-border-radius-attach-right px-2 py-0"
            :aria-label="$t('el.horizontalScrollbarArrows.scrollLeft')" :style="{ visibility: canScrollLeft ? '' : 'hidden' }"
            @click="onClickScrollLeft()">
            <span class="bi bi-chevron-left" aria-hidden="true" />
        </el-button>
        <el-scrollbar ref="scrollbar" @scroll="onScroll">
            <div ref="scrollContentEl" class="is-flex is-align-items-center">
                <slot />
            </div>
        </el-scrollbar>
        <el-button
            link type="primary" class="is-flex-grow-0 is-border-radius-attach-left px-2 py-0"
            :aria-label="$t('el.horizontalScrollbarArrows.scrollRight')" :style="{ visibility: canScrollRight ? '' : 'hidden' }"
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
import { lerp } from '@/lib/math';
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

        let scrollLeftTarget: number | null = null;
        let isScrollAnimating: boolean = false;

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

        function getScrollLeftMin() {
            return 0;
        }

        function getScrollLeftMax() {
            return scrollContentEl.value!.clientWidth - (scrollbar.value?.wrapRef?.clientWidth ?? 0);
        }

        function handleScrollChange() {
            canScrollLeft.value = scrollLeft.value > getScrollLeftMin();
            canScrollRight.value = scrollLeft.value < getScrollLeftMax();
        }

        function onClickScrollLeft() {
            scrollLeftTarget = scrollLeft.value - (scrollbar.value!.$el.clientWidth * .6);
            if (!isScrollAnimating) {
                scrollAnimate();
            }
        }

        function onClickScrollRight() {
            scrollLeftTarget = scrollLeft.value + (scrollbar.value!.$el.clientWidth * .6);
            if (!isScrollAnimating) {
                scrollAnimate();
            }
        }

        function scrollAnimate() {
            if (scrollLeftTarget == null) {
                isScrollAnimating = false;
                return;
            }
            isScrollAnimating = true;
            scrollLeft.value = lerp(scrollLeft.value, scrollLeftTarget, 0.15);
            scrollbar.value!.setScrollLeft(scrollLeft.value);
            if (Math.abs(scrollLeft.value - scrollLeftTarget) < 1 || scrollLeft.value < getScrollLeftMin() + 1 || scrollLeft.value > getScrollLeftMax() + 1) {
                scrollbar.value!.setScrollLeft(scrollLeftTarget);
                scrollLeftTarget = null;
                isScrollAnimating = false;
                return;
            } else {
                requestAnimationFrame(scrollAnimate);

            }
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
