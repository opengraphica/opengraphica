<template>
    <div
        ref="root" class="opengraphica"
        :style="{ '--ogr-sidebar-left-width': sidebarLeftWidth + 'px', '--ogr-sidebar-right-width': sidebarRightWidth + 'px' }"
        @scroll="onScrollRoot($event)"
        @touchstart="onTouchStartRoot($event)"
    >
        <template v-if="isMounted">
            <app-canvas />
            <template v-if="isLoaded">
                <app-layout-dnd-container
                    :key="'app-layout-dnd-container-' + languageOverride"
                    @dnd-ready="onDndLayoutReady($event)"
                    @resize="onResizeLayoutContainer($event)"
                />
                <app-menu-drawers
                    :key="'app-menu-drawers-' + languageOverride"
                />
                <app-dialogs
                    :key="'app-dialogs-' + languageOverride"
                />
                <app-wait
                    :key="'wait-' + languageOverride"
                />
                <app-dnd-drop-overlay
                    v-if="showDndDropOverlay"
                    ref="dndDropOverlay"
                    @click="showDndDropOverlay = false"
                />
            </template>
        </template>
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, ref, provide, onMounted, onUnmounted, watch } from 'vue';
import AppCanvas from '@/ui/app-canvas.vue';
import AppDialogs from '@/ui/app-dialogs.vue';
import AppDndDropOverlay from '@/ui/app-dnd-drop-overlay.vue';
import AppLayoutDndContainer from '@/ui/app-layout-dnd-container.vue';
import AppMenuDrawers from '@/ui/app-menu-drawers.vue';
import AppWait from '@/ui/app-wait.vue';
import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import preferencesStore from '@/store/preferences';
import ResizeObserver from 'resize-observer-polyfill';
import appEmitter from '@/lib/emitter';
import { initializeI18n } from '@/i18n';
import { getModuleDefinition, preloadModules } from '@/modules';

import type { Eruda } from 'eruda';

export default defineComponent({
    name: 'App',
    components: {
        AppCanvas,
        AppDialogs,
        AppDndDropOverlay,
        AppLayoutDndContainer,
        AppMenuDrawers,
        AppWait
    },
    setup() {
        const rootElement = ref<Element | null>(null);
        const mainElement = ref<Element | null>(null);
        const isMounted = ref<boolean>(false);
        const isLoaded = ref<boolean>(false);
        const showDndDropOverlay = ref<boolean>(false);
        const dndDropOverlay = ref<InstanceType<typeof AppDndDropOverlay>>();
        const sidebarLeftWidth = ref<number>(0);
        const sidebarRightWidth = ref<number>(0);

        let erudaDebuggerInstance: Eruda | null = null;

        const languageOverride = computed(() => preferencesStore.state.languageOverride);

        watch(() => preferencesStore.state.useMobileDebugger, async (useMobileDebugger) => {
            if (useMobileDebugger) {
                if (!erudaDebuggerInstance) {
                    erudaDebuggerInstance = (await import('eruda')).default;
                }
                erudaDebuggerInstance?.init();
            } else {
                erudaDebuggerInstance?.destroy();
            }
        }, { immediate: true });

        onMounted(() => {
            isMounted.value = true;
            appEmitter.emit('app.wait.startBlocking', { id: 'appInitialLoad', immediate: true });

            // Full page fixes for quirks in browsers (Chrome)
            if (document.body.classList.contains('ogr-full-page')) {
                // Reset user zoom on some browsers
                try {
                    (document as any).firstElementChild.style.zoom = 'reset';
                } catch (error: any) {}
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

            // Drag & Drop
            window.addEventListener('dragenter', onDragEnterRoot, true);
            window.addEventListener('dragover', onDragOverRoot, true);
            window.addEventListener('dragleave', onDragLeaveRoot, true);
            window.addEventListener('drop', onDropRoot, true);

            // Determine if touchscreen/pen user
            editorStore.set('isTouchUser', false);
            window.addEventListener('touchstart', onTouchStartWindowTouchTest, true);
            editorStore.set('isPenUser', false);
            window.addEventListener('pointerdown', onPointerDownWindowPenTest, true);

            // Breakfix for element plus popper styles
            const opengraphica = document.querySelector('.opengraphica');
            const popperContainer = document.querySelector('[id^="el-popper-container"]');
            if (opengraphica && popperContainer) {
                opengraphica.appendChild(popperContainer);
            }

            asyncMountSetup();
        });

        onUnmounted(() => {
            document.removeEventListener('contextmenu', onContextMenu);
            window.removeEventListener('resize', onResizeWindow);
            window.removeEventListener('dragenter', onDragEnterRoot);
            window.removeEventListener('dragover', onDragOverRoot);
            window.removeEventListener('dragleave', onDragLeaveRoot);
            window.removeEventListener('drop', onDropRoot);
        });

        async function asyncMountSetup() {
            // Preload some modules which need to be executed immediately
            await preloadModules();

            // Initialize i18n user language
            await initializeI18n();

            isLoaded.value = true;

            if (preferencesStore.get('showWelcomeScreenAtStart')) {
                const welcomeModule = getModuleDefinition('tutorial', 'welcome');
                if (welcomeModule) {
                    appEmitter.emit('app.menuDrawer.openFromModule', {
                        name: welcomeModule.action.target,
                        placement: {
                            left: 'right',
                            right: 'left',
                            top: 'bottom',
                            bottom: 'top'
                        }[preferencesStore.get('menuBarPosition')] as any,
                        immediate: true
                    });
                }
            }

            appEmitter.emit('app.wait.stopBlocking', { id: 'appInitialLoad' });
        }

        function onContextMenu(e: Event) {
            const target = e.target as Node;
            if ((rootElement.value as Element).contains(target)) {
                e.preventDefault();
            }
        }

        function onScrollRoot(e: WheelEvent) {
            if (e.target && (e.target as HTMLElement).scrollTop) {
                (e.target as HTMLElement).scrollTop = 0;
            }
        }

        function onTouchStartRoot(e: TouchEvent) {
            if (e.touches.length > 1){
                e.preventDefault();
            }
        }

        function onDragEnterRoot(e: DragEvent) {
            showDndDropOverlay.value = true;
            e.preventDefault();
        }

        function onDragOverRoot(e: DragEvent) {
            e.preventDefault();
        }

        function onDragLeaveRoot(e: DragEvent) {
            if (dndDropOverlay.value && e.target === dndDropOverlay.value.$el) {
                showDndDropOverlay.value = false;
            }
        }

        async function onDropRoot(e: DragEvent) {
            e.preventDefault();
            showDndDropOverlay.value = false;
            if (e.dataTransfer && e.dataTransfer.files?.length > 0) {
                appEmitter.emit('app.wait.startBlocking', { id: 'documentDropFiles', label: 'app.wait.loadingImage' });
                const { openFromFileList } = await import(/* webpackChunkName: 'module-file-open' */ '@/modules/file/open');
                await openFromFileList({ files: e.dataTransfer.files, dialogOptions: { insert: true } });
                appEmitter.emit('app.wait.stopBlocking', { id: 'documentDropFiles' });
                appEmitter.emit('app.workingFile.notifyImageLoadedFromDragAndDrop');
            }
        }

        function onTouchStartWindowTouchTest(e: Event) {
            window.removeEventListener('touchstart', onTouchStartWindowTouchTest);
            editorStore.set('isTouchUser', true);
        }

        function onPointerDownWindowPenTest(e: PointerEvent) {
            if (e.pointerType === 'pen') {
                window.removeEventListener('pointerdown', onPointerDownWindowPenTest);
                editorStore.set('isPenUser', true);
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

        function onResizeLayoutContainer({ sidebarLeftWidth: newSidebarLeftWidth, sidebarRightWidth: newSidebarRightWidth }: any) {
            sidebarLeftWidth.value = newSidebarLeftWidth;
            sidebarRightWidth.value = newSidebarRightWidth;
        }

        provide('rootElement', rootElement);
        provide('mainElement', mainElement);

        return {
            root: rootElement,
            isMounted,
            isLoaded,
            languageOverride,
            sidebarLeftWidth,
            sidebarRightWidth,
            onDndLayoutReady,
            onResizeLayoutContainer,
            showDndDropOverlay,
            dndDropOverlay,
            onScrollRoot,
            onTouchStartRoot
        };
    }
})
</script>

