<template>
    <div ref="root" class="opengraphica" @touchstart="onTouchStartRoot($event)" v-loading="loading">
        <app-canvas />
        <app-layout-dnd-container @dnd-ready="onDndLayoutReady($event)" />
        <app-dialogs />
        <app-wait />
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, provide, onMounted, onUnmounted } from 'vue';
import AppCanvas from '@/ui/app-canvas.vue';
import AppDialogs from '@/ui/app-dialogs.vue';
import AppLayoutDndContainer from '@/ui/app-layout-dnd-container.vue';
import AppWait from '@/ui/app-wait.vue';
import canvasStore from '@/store/canvas';
import ResizeObserver from 'resize-observer-polyfill';
import ElLoading from 'element-plus/lib/el-loading';
import { preloadModules } from '@/modules';

export default defineComponent({
    name: 'App',
    directives: {
        loading: ElLoading.directive
    },
    components: {
        AppCanvas,
        AppDialogs,
        AppLayoutDndContainer,
        AppWait
    },
    setup() {
        const loading = ref<boolean>(true);
        const rootElement = ref<Element | null>(null);
        const mainElement = ref<Element | null>(null);

        onMounted(() => {
            // Full page fixes for quirks in browsers (Chrome)
            if (document.body.classList.contains('ogr-full-page')) {
                // Reset user zoom on some browsers
                try {
                    (document as any).firstElementChild.style.zoom = 'reset';
                } catch (error) {}
                // Chrome for some reason tries to retain scroll position even though the page wasn't scrolled
                // When using two finger movements
                const autoScrollFixIntervalHandle = setInterval(() => {
                    window.document.documentElement.scrollTop = 0;
                    window.document.documentElement.scrollLeft = 0;
                }, 250);
                setTimeout(() => {
                    clearInterval(autoScrollFixIntervalHandle);
                }, 10000);
            }

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

            asyncMountSetup();
        });

        onUnmounted(() => {
            document.removeEventListener('contextmenu', onContextMenu);
            window.removeEventListener('resize', onResizeWindow);
        });

        async function asyncMountSetup() {
            // Preload some modules which need to be executed immediately
            await preloadModules();

            loading.value = false;
        }

        function onContextMenu(e: Event) {
            const target = e.target as Node;
            if ((rootElement.value as Element).contains(target)) {
                e.preventDefault();
            }
        }

        function onTouchStartRoot(e: TouchEvent) {
            if (e.touches.length > 1){
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
            loading,
            root: rootElement,
            onDndLayoutReady,
            onTouchStartRoot
        };
    }
})
</script>

