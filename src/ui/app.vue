<template>
    <div ref="root" class="opengraphica">
        <app-canvas />
        <app-layout-dnd-container @dnd-ready="onDndLayoutReady($event)" />
        <app-dialogs />
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, provide, onMounted, onUnmounted } from 'vue';
import AppCanvas from '@/ui/app-canvas.vue';
import AppDialogs from '@/ui/app-dialogs.vue';
import AppLayoutDndContainer from '@/ui/app-layout-dnd-container.vue';
import canvasStore from '@/store/canvas';
import ResizeObserver from 'resize-observer-polyfill';

export default defineComponent({
    name: 'App',
    components: {
        AppCanvas,
        AppDialogs,
        AppLayoutDndContainer
    },
    setup() {
        const rootElement = ref<Element | null>(null);
        const mainElement = ref<Element | null>(null);

        onMounted(() => {
            // Disable context menu inside the application
            document.addEventListener('contextmenu', onContextMenu);

            // App resize handler
            if (typeof ResizeObserver !== 'undefined') {
                let resizeObserver = new ResizeObserver((entries) => {
                    for (let entry of entries) {
                        if (entry.target === rootElement.value) {
                            const contentRect = entry.contentRect;
                            canvasStore.set({
                                viewWidth: contentRect.width * (window.devicePixelRatio || 1),
                                viewHeight: contentRect.height * (window.devicePixelRatio || 1)
                            });
                        }
                    }
                });
                resizeObserver.observe(rootElement.value as Element);
            } else {
                window.addEventListener('resize', onResizeWindow);
            }

        });

        onUnmounted(() => {
            document.removeEventListener('contextmenu', onContextMenu);
            window.removeEventListener('resize', onResizeWindow);
        });

        function onContextMenu(e: Event) {
            const target = e.target as Node;
            if ((rootElement.value as Element).contains(target)) {
                e.preventDefault();
            }
        }
        function onResizeWindow(e: Event) {
            canvasStore.set({
                viewWidth: (rootElement.value as Element).clientWidth * (window.devicePixelRatio || 1),
                viewHeight: (rootElement.value as Element).clientHeight * (window.devicePixelRatio || 1)
            });
        }

        function onDndLayoutReady({ mainElement: main }: { mainElement: Element }) {
            mainElement.value = main;
        }

        provide('rootElement', rootElement);
        provide('mainElement', mainElement);

        return {
            root: rootElement,
            onDndLayoutReady
        };
    }
})
</script>

