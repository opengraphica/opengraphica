<template>
    <div class="ogr-layout-dnd-container">
        <header ref="header">
            <h1 class="is-sr-only">OpenGraphica</h1>
            <template v-if="!isActiveToolbarExclusive && config.menuBar && menuBarPosition === 'top'">
                <app-layout-menu-bar :config="config.menuBar" layout-placement="top" />
            </template>
            <toolbar v-if="activeToolbar && activeToolbarPosition === 'top'" :name="activeToolbar" :class="{ 'is-overlay': !isActiveToolbarExclusive }" />
        </header>
        <div class="ogr-layout-dnd-center">
            <aside aria-label="Left Sidebar" class="sidebar-left" ref="sidebarLeft">
                <template v-if="!isActiveToolbarExclusive && config.menuBar && menuBarPosition === 'left'">
                    <app-layout-menu-bar :config="config.menuBar" layout-placement="left" />
                </template>
            </aside>
            <main ref="main"
                tabindex="0"
                :class="{ 'ogr-custom-cursor': !!canvasState.cursor }"
                @touchstart="onTouchStartMain"
                @pointerdown="onPointerDownMain"
                @wheel="onWheelMain"
            />
            <aside aria-label="Right Sidebar" class="sidebar-right" ref="sidebarRight">
                <template v-if="!isActiveToolbarExclusive && config.menuBar && menuBarPosition === 'right'">
                    <app-layout-menu-bar :config="config.menuBar" layout-placement="right" />
                </template>
            </aside>
        </div>
        <footer ref="footer">
            <toolbar v-if="activeToolbar && activeToolbarPosition === 'bottom'" :name="activeToolbar" :class="{ 'is-overlay': !isActiveToolbarExclusive }" />
            <template v-if="!isActiveToolbarExclusive && config.menuBar && menuBarPosition === 'bottom'">
                <app-layout-menu-bar :config="config.menuBar" layout-placement="bottom" />
            </template>
        </footer>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, Ref, computed, onMounted, onUnmounted } from 'vue';
import AppLayoutMenuBar from '@/ui/app-layout-menu-bar.vue';
import Toolbar from '@/ui/toolbar.vue';
import defaultDndLayoutConfig from '@/config/default-dnd-layout.json';
import { translateTouchEventToPointerEvents } from '@/lib/events';
import { CanvasRenderingContext2DEnhanced, DndLayout } from '@/types';

import { WorkingFileRasterLayer, RGBAColor } from '@/types';
import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import preferencesStore from '@/store/preferences';
import workingFileStore from '@/store/working-file';
import layerRenderers from '@/canvas/renderers';
import BaseCanvasMovementController from '@/canvas/controllers/base-movement';

export default defineComponent({
    name: 'AppLayoutDndContainer',
    components: {
        AppLayoutMenuBar,
        Toolbar
    },
    emits: ['dnd-ready'],
    setup(props, { emit }) {
        const mainElement = ref<Element>();
        const config = ref<DndLayout>(defaultDndLayoutConfig.dndLayout as DndLayout);
        const isPointerInsideMain = ref<boolean>(false);
        const isPointerEventsSupported: boolean = 'onpointerdown' in document.body;

        const activeToolbar = computed<string | null>(() => {
            return editorStore.state.activeToolbar;
        });
        const activeToolbarPosition = computed<string>(() => {
            return editorStore.state.activeToolbarPosition;
        });
        const isActiveToolbarExclusive = computed<boolean>(() => {
            return editorStore.state.isActiveToolbarExclusive;
        });
        const menuBarPosition = computed<string>(() => {
            return preferencesStore.state.menuBarPosition;
        });

        onMounted(() => {
            editorStore.dispatch('setActiveTool', { group: 'view' });

            window.addEventListener('touchmove', onTouchMoveWindow);
            window.addEventListener('touchend', onTouchEndWindow);
            window.addEventListener('pointerup', onPointerUpWindow);
            window.addEventListener('pointermove', onPointerMoveWindow);

            emit('dnd-ready', { mainElement: mainElement.value });
        });

        onUnmounted(() => {
            window.removeEventListener('touchmove', onTouchMoveWindow);
            window.removeEventListener('touchend', onTouchEndWindow);
            window.removeEventListener('pointerup', onPointerUpWindow);
            window.removeEventListener('pointermove', onPointerMoveWindow);
        });

        function onTouchStartMain(e: TouchEvent) {
            e.preventDefault();
            for (const event of translateTouchEventToPointerEvents('pointerdown', e)) {
                editorStore.get('toolCanvasController').onPointerDown(event);
            }
            (document.body as any).focus();
            return false;
        };
        function onTouchMoveWindow(e: TouchEvent) {
            for (const event of translateTouchEventToPointerEvents('pointermove', e)) {
                editorStore.get('toolCanvasController').onPointerMove(event);
            }
        }
        function onTouchEndWindow(e: TouchEvent) {
            for (const event of translateTouchEventToPointerEvents('pointerup', e)) {
                editorStore.get('toolCanvasController').onPointerUp(event);
            }
        }

        function onPointerDownMain(e: PointerEvent) {
            if (e.pointerType !== 'touch') {
                editorStore.get('toolCanvasController').onPointerDown(e);
                (document.body as any).focus();
                return false;
            }
        };
        function onPointerMoveWindow(e: PointerEvent) {
            if (e.pointerType !== 'touch') {
                editorStore.get('toolCanvasController').onPointerMove(e);
            }
        };
        function onPointerUpWindow(e: PointerEvent) {
            if (e.pointerType !== 'touch') {
                editorStore.get('toolCanvasController').onPointerUp(e);
            }
        };
        function onWheelMain(e: WheelEvent) {
            editorStore.get('toolCanvasController').onWheel(e);
        };

        return {
            main: mainElement,
            config,
            canvasState: canvasStore.state,
            activeToolbar,
            activeToolbarPosition,
            isActiveToolbarExclusive,
            isPointerInsideMain,
            menuBarPosition,
            onPointerDownMain,
            onTouchStartMain,
            onWheelMain
        };
    }
});
</script>
