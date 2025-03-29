<template>
    <div ref="rootEl" class="el-horizontal-scrollbar-arrows">
        <el-button
            link type="primary" class="grow-0 !rounded-none !px-2 !py-0"
            :aria-label="$t('el.horizontalScrollbarArrows.scrollLeft')" :style="{ visibility: canScrollLeft ? '' : 'hidden' }"
            @click="onClickScrollLeft()">
            <span class="bi bi-chevron-left" aria-hidden="true" />
        </el-button>
        <el-scrollbar ref="scrollbar" @scroll="onScroll">
            <div ref="scrollContentEl" class="flex items-center">
                <slot />
            </div>
        </el-scrollbar>
        <el-button
            link type="primary" class="grow-0 !rounded-none !px-2 !py-0"
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
        ElScrollbar,
    },
    emits: [
        'scroll',
    ],
    setup(props, { emit }) {
        const scrollOffsetPadding = 4;

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
            emit('scroll', scrollInfo);
        }

        function getScrollLeftMin() {
            return 0;
        }

        function getScrollLeftMax() {
            return scrollContentEl.value!.clientWidth - (scrollbar.value?.wrapRef?.clientWidth ?? 0);
        }

        function getScrollViewWidth() {
            return scrollbar.value!.$el.clientWidth;
        }

        function handleScrollChange() {
            canScrollLeft.value = scrollLeft.value > getScrollLeftMin();
            canScrollRight.value = scrollLeft.value < getScrollLeftMax();
        }

        function onClickScrollLeft() {
            if (!scrollbar.value || !scrollContentEl.value) return;
            
            const scrollViewWidth = getScrollViewWidth();
            const scrollChildren = Array.from(scrollContentEl.value.childNodes).filter(child => child instanceof HTMLElement) as HTMLElement[];

            // Find the first element that is right of the left side of the scroll view
            let leftChildIndex = -1;
            for (const [childIndex, child] of scrollChildren.entries()) {
                if (child.offsetLeft >= scrollLeft.value) {
                    leftChildIndex = childIndex;
                    break;
                }
            }
            if (leftChildIndex == -1) {
                leftChildIndex = scrollChildren.length - 1;
            }

            // Scroll to the beginning of the previous element that is cut off by the scroll view
            let traversedWidth = 0;
            for (let i = leftChildIndex - 1; i >= 0; i--) {
                const child = scrollChildren[i];
                const clientRect = child.getBoundingClientRect();
                traversedWidth += clientRect.width;
                if (traversedWidth <= scrollViewWidth || Math.abs(i - leftChildIndex) <= 1) {
                    if (i === 0) {
                        scrollLeftTarget = 0;    
                    } else {
                        scrollLeftTarget = child.offsetLeft - scrollOffsetPadding;
                    }
                }
                if (traversedWidth > scrollViewWidth) {
                    break;
                }
            }

            if (!isScrollAnimating) {
                scrollAnimate();
            }
        }

        function onClickScrollRight() {
            if (!scrollbar.value || !scrollContentEl.value) return;

            // Scroll to the beginning of the next element that is cut off by the scroll view
            const scrollViewWidth = getScrollViewWidth();
            const scrollChildren = scrollContentEl.value.childNodes;
            for (const child of Array.from(scrollChildren)) {
                if (child instanceof HTMLElement) {
                    const clientRect = child.getBoundingClientRect();
                    if (child.offsetLeft - scrollOffsetPadding > scrollLeft.value && child.offsetLeft + clientRect.width > scrollLeft.value + scrollViewWidth) {
                        scrollLeftTarget = child.offsetLeft - scrollOffsetPadding;
                        break;
                    }
                }
            }

            scrollLeftTarget = Math.min(scrollLeftTarget ?? 0, getScrollLeftMax());

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
