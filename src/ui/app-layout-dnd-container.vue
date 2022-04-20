<template>
    <div
        ref="dndContainer" class="ogr-layout-dnd-container"
        :style="{ '--ogr-sidebar-left-size': sidebarLeftSize + 'px', '--ogr-sidebar-right-size': sidebarRightSize + 'px' }"
    >
        <header ref="header">
            <h1 class="is-sr-only">OpenGraphica</h1>
            <template v-if="!isActiveToolbarExclusive && config.menuBar && menuBarPosition === 'top'">
                <app-layout-menu-bar :config="config.menuBar" layout-placement="top" @resize="onResizeLayout" />
            </template>
            <toolbar v-if="activeToolbar && activeToolbarPosition === 'top'" :name="activeToolbar" :class="['is-top', { 'is-overlay': !isActiveToolbarExclusive }]" />
        </header>
        <div class="ogr-layout-dnd-center">
            <aside aria-label="Left Sidebar" class="sidebar-left" ref="sidebarLeft">
                <template v-if="!isActiveToolbarExclusive && config.menuBar && menuBarPosition === 'left'">
                    <app-layout-menu-bar :config="config.menuBar" layout-placement="left" @resize="onResizeLayout" />
                </template>
                <template v-if="showDock && !isActiveToolbarExclusive && config.dock && dockPosition === 'left'">
                    <app-layout-dock :config="config.dock" layout-placement="left"  @resize="onResizeLayout" />
                </template>
            </aside>
            <main ref="main"
                tabindex="0"
                :class="[{ 'ogr-custom-cursor': !!canvasState.cursor }, canvasState.cursor ? 'ogr-custom-cursor--' + canvasState.cursor : null]"
                :style="{ 'pointer-events': isCanvasInteractable ? null : 'none' }"
                @touchstart="onTouchStartMain"
                @pointerdown="onPointerDownMain"
                @wheel="onWheelMain"
            />
            <aside aria-label="Right Sidebar" class="sidebar-right" ref="sidebarRight">
                <template v-if="showDock && !isActiveToolbarExclusive && config.dock && dockPosition === 'right'">
                    <app-layout-dock :config="config.dock" layout-placement="right" @resize="onResizeLayout" />
                </template>
                <template v-if="!isActiveToolbarExclusive && config.menuBar && menuBarPosition === 'right'">
                    <app-layout-menu-bar :config="config.menuBar" layout-placement="right"  @resize="onResizeLayout" />
                </template>
            </aside>
        </div>
        <footer ref="footer">
            <toolbar ref="toolbar" v-if="activeToolbar && ['bottom', 'auto'].includes(activeToolbarPosition)" :name="activeToolbar" :class="['is-bottom', 'is-menu-bar-' + menuBarPosition, { 'is-overlay': !isActiveToolbarExclusive }]" />
            <app-layout-menu-bar v-if="!isActiveToolbarExclusive && config.menuBar && menuBarPosition === 'bottom'" :config="config.menuBar" layout-placement="bottom"  @resize="onResizeLayout" />
        </footer>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, Ref, toRefs, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import AppLayoutDock from '@/ui/app-layout-dock.vue';
import AppLayoutMenuBar from '@/ui/app-layout-menu-bar.vue';
import Toolbar from '@/ui/toolbar.vue';
import defaultDndLayoutConfig from '@/config/default-dnd-layout.json';
import appEmitter from '@/lib/emitter';
import { translateTouchEventToPointerEvents } from '@/lib/events';
import { isInput } from '@/lib/events';
import { DndLayout } from '@/types';

import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import preferencesStore from '@/store/preferences';

export default defineComponent({
    name: 'AppLayoutDndContainer',
    components: {
        AppLayoutDock,
        AppLayoutMenuBar,
        Toolbar
    },
    emits: ['dnd-ready', 'resize'],
    setup(props, { emit }) {
        const dndContainerElement = ref<Element>();
        const mainElement = ref<Element>();
        const sidebarLeftElement = ref<Element>();
        const sidebarRightElement = ref<Element>();
        const toolbarComponent = ref<InstanceType<typeof Toolbar>>();
        const config = ref<DndLayout>(defaultDndLayoutConfig.dndLayout as DndLayout);
        const isPointerInsideMain = ref<boolean>(false);
        const isPointerEventsSupported: boolean = 'onpointerdown' in document.body;
        const sidebarLeftSize = ref<number>(0);
        const sidebarRightSize = ref<number>(0);
        const showDock = ref<boolean>(true);

        const { viewWidth, viewHeight } = toRefs(canvasStore.state);

        const activeToolbar = computed<string | null>(() => {
            return editorStore.state.activeToolbar;
        });
        const activeToolbarPosition = computed<string>(() => {
            return editorStore.state.activeToolbarPosition;
        });
        const dockPosition = computed<string>(() => {
            return preferencesStore.state.dockPosition;
        });
        const isActiveToolbarExclusive = computed<boolean>(() => {
            return editorStore.state.isActiveToolbarExclusive;
        });
        const isCanvasInteractable = computed<boolean>(() => {
            return editorStore.state.activePopoverIds.length === 0;
        });
        const menuBarPosition = computed<string>(() => {
            return preferencesStore.state.menuBarPosition;
        });

        let resizeDebounceHandle: number | undefined = undefined;
        watch([viewWidth, viewHeight, menuBarPosition, activeToolbar], () => {
            clearTimeout(resizeDebounceHandle);
            resizeDebounceHandle = window.setTimeout(async () => {
                showDock.value = viewWidth.value / (window.devicePixelRatio || 1) > preferencesStore.state.dockHideBreakpoint;
                await nextTick();
                calculateDndArea();
                onResizeLayout();
            }, 400);
        });

        onMounted(async () => {
            if (editorStore.state.activeToolGroupRestore) {
                editorStore.dispatch('setActiveTool', { group: editorStore.state.activeToolGroupRestore });
            }

            showDock.value = viewWidth.value / (window.devicePixelRatio || 1) > preferencesStore.state.dockHideBreakpoint;

            appEmitter.on('app.canvas.calculateDndArea', calculateDndArea);
            window.addEventListener('touchmove', onTouchMoveWindow);
            window.addEventListener('touchend', onTouchEndWindow);
            window.addEventListener('pointerup', onPointerUpWindow);
            window.addEventListener('pointermove', onPointerMoveWindow);

            emit('dnd-ready', { mainElement: mainElement.value });
            appEmitter.emit('app.canvas.resetTransform');
        });

        onUnmounted(() => {
            appEmitter.off('app.canvas.calculateDndArea', calculateDndArea);
            window.removeEventListener('touchmove', onTouchMoveWindow);
            window.removeEventListener('touchend', onTouchEndWindow);
            window.removeEventListener('pointerup', onPointerUpWindow);
            window.removeEventListener('pointermove', onPointerMoveWindow);
        });

        function calculateDndArea() {
            if (dndContainerElement.value && mainElement.value) {
                let toolbarHeight = 0;
                const dndContainerRect = dndContainerElement.value.getBoundingClientRect();
                const mainRect = mainElement.value.getBoundingClientRect();
                if (toolbarComponent.value?.$el) {
                    const toolbarRect = toolbarComponent.value.$el.getBoundingClientRect();
                    toolbarHeight = toolbarRect.height;
                }
                const devicePixelRatio = window.devicePixelRatio || 1;
                canvasStore.set('dndAreaLeft', (mainRect.left - dndContainerRect.left) * devicePixelRatio);
                canvasStore.set('dndAreaTop', (mainRect.top - dndContainerRect.top) * devicePixelRatio);
                canvasStore.set('dndAreaWidth', mainRect.width * devicePixelRatio);
                canvasStore.set('dndAreaHeight', (mainRect.height - toolbarHeight) * devicePixelRatio);
            }
        }

        function onTouchStartMain(e: TouchEvent) {
            e.preventDefault();
            if (e.target == mainElement.value) {
                const activeElement: any = document.activeElement;
                if (activeElement && activeElement?.blur && isInput(activeElement)) {
                    activeElement?.blur();
                }
                if (isCanvasInteractable.value === true) {
                    for (const event of translateTouchEventToPointerEvents('pointerdown', e)) {
                        editorStore.get('toolCanvasController').onPointerDown(event);
                    }
                }
            }
            (document.body as any).focus();
            return false;
        };
        function onTouchMoveWindow(e: TouchEvent) {
            if (isCanvasInteractable.value === true) {
                for (const event of translateTouchEventToPointerEvents('pointermove', e)) {
                    editorStore.get('toolCanvasController').onPointerMove(event);
                }
            }
        }
        function onTouchEndWindow(e: TouchEvent) {
            if (isCanvasInteractable.value === true) {
                for (const event of translateTouchEventToPointerEvents('pointerup', e)) {
                    editorStore.get('toolCanvasController').onPointerUp(event);
                }
            }
        }

        function onPointerDownMain(e: PointerEvent) {
            if (e.pointerType !== 'touch') {
                if (isCanvasInteractable.value === true) {
                    editorStore.get('toolCanvasController').onPointerDown(e);
                }
                (document.body as any).focus();
                return false;
            }
        };
        function onPointerMoveWindow(e: PointerEvent) {
            if (e.pointerType !== 'touch') {
                if (isCanvasInteractable.value === true) {
                    editorStore.get('toolCanvasController').onPointerMove(e);
                }
            }
        };
        function onPointerUpWindow(e: PointerEvent) {
            if (e.pointerType !== 'touch') {
                if (isCanvasInteractable.value === true) {
                    editorStore.get('toolCanvasController').onPointerUp(e);
                }
            }
        };
        function onWheelMain(e: WheelEvent) {
            if (isCanvasInteractable.value === true) {
                editorStore.get('toolCanvasController').onWheel(e);
            }
        };

        function onResizeLayout() {
            sidebarLeftSize.value = sidebarLeftElement.value?.clientWidth || 0;
            sidebarRightSize.value = sidebarRightElement.value?.clientWidth || 0;
            emit('resize', { sidebarLeftSize: sidebarLeftSize.value, sidebarRightSize: sidebarRightSize.value });
        }

        return {
            dndContainer: dndContainerElement,
            main: mainElement,
            sidebarLeft: sidebarLeftElement,
            sidebarLeftSize,
            sidebarRightSize,
            sidebarRight: sidebarRightElement,
            showDock,
            toolbar: toolbarComponent,
            config,
            canvasState: canvasStore.state,
            activeToolbar,
            activeToolbarPosition,
            dockPosition,
            isCanvasInteractable,
            isActiveToolbarExclusive,
            isPointerInsideMain,
            menuBarPosition,
            onPointerDownMain,
            onTouchStartMain,
            onResizeLayout,
            onWheelMain
        };
    }
});
</script>
