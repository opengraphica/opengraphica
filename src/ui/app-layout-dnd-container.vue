<template>
    <div class="ogr-layout-dnd-container">
        <header ref="header">
            <h1 class="is-sr-only">OpenGraphica</h1>
            <template v-if="config.header">
                <app-layout-menu-bar v-for="(menuBarConfig, index) of config.header" :key="index" :config="menuBarConfig" />
            </template>
        </header>
        <div class="ogr-layout-dnd-center">
            <aside aria-label="Left Sidebar" class="sidebar-left" ref="sidebarLeft"></aside>
            <main ref="main"
                tabindex="0"
                :class="{ 'ogr-custom-cursor': !!canvasState.cursor }"
                @touchstart="onTouchStartMain"
                @pointerdown="onPointerDownMain"
                @wheel="onWheelMain"
            />
            <aside aria-label="Right Sidebar" class="sidebar-right" ref="sidebarRight"></aside>
        </div>
        <footer ref="footer">
        </footer>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, Ref, inject, onMounted, onUnmounted } from 'vue';
import AppLayoutMenuBar from '@/ui/app-layout-menu-bar.vue';
import defaultDndLayoutConfig from '@/config/default-dnd-layout.json';
import { translateTouchEventToPointerEvents } from '@/lib/events';
import { CanvasRenderingContext2DEnhanced, DndLayout } from '@/types';

import { WorkingFileRasterLayer, RGBAColor } from '@/types';
import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import workingFileStore from '@/store/working-file';
import layerRenderers from '@/canvas/renderers';
import BaseCanvasMovementController from '@/canvas/controllers/base-movement';

export default defineComponent({
    name: 'AppLayoutDndContainer',
    components: {
        AppLayoutMenuBar
    },
    emits: ['dnd-ready'],
    setup(props, { emit }) {
        const mainElement = ref<Element>();
        const config = ref<DndLayout>(defaultDndLayoutConfig.dndLayout as DndLayout);
        const isPointerInsideMain = ref<boolean>(false);
        const isPointerEventsSupported: boolean = 'onpointerdown' in document.body;

        onMounted(() => {

            editorStore.dispatch('setActiveTool', { group: 'transform' });

            // Temporary
            const gkhead = new Image();
            gkhead.src = 'http://phrogz.net/tmp/gkhead.jpg';
            gkhead.onload = () => {
                workingFileStore.set('layers', [
                    {
                        type: 'raster',
                        blendingMode: 'source-over',
                        filters: [],
                        id: 0,
                        groupId: 0,
                        height: gkhead.height,
                        width: gkhead.width,
                        name: 'gkhead',
                        opacity: 1,
                        transform: new DOMMatrix(),
                        visible: true,
                        x: 0,
                        y: 0,
                        renderer: layerRenderers.raster,
                        data: {
                            height: gkhead.height,
                            width: gkhead.width,
                            sourceImage: gkhead
                        }
                    } as WorkingFileRasterLayer<RGBAColor>,
                    {
                        type: 'raster',
                        blendingMode: 'source-over',
                        filters: [],
                        id: 0,
                        groupId: 0,
                        height: gkhead.height,
                        width: gkhead.width,
                        name: 'gkhead',
                        opacity: 1,
                        transform: new DOMMatrix(),
                        visible: true,
                        x: 409,
                        y: 0,
                        renderer: layerRenderers.raster,
                        data: {
                            height: gkhead.height,
                            width: gkhead.width,
                            sourceImage: gkhead
                        }
                    } as WorkingFileRasterLayer<RGBAColor>,
                    {
                        type: 'raster',
                        blendingMode: 'source-over',
                        filters: [],
                        id: 0,
                        groupId: 0,
                        height: gkhead.height,
                        width: gkhead.width,
                        name: 'gkhead',
                        opacity: 1,
                        transform: new DOMMatrix(),
                        visible: true,
                        x: 0,
                        y: 446,
                        renderer: layerRenderers.raster,
                        data: {
                            height: gkhead.height,
                            width: gkhead.width,
                            sourceImage: gkhead
                        }
                    } as WorkingFileRasterLayer<RGBAColor>
                ]);
                canvasStore.set('dirty', true);
            };


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
            editorStore.get('toolCanvasController').onPointerDown(translateTouchEventToPointerEvents('pointerdown', e)[0]);
            (document.body as any).focus();
            return false;
        };
        function onTouchMoveWindow(e: TouchEvent) {
            for (const event of translateTouchEventToPointerEvents('pointermove', e)) {
                editorStore.get('toolCanvasController').onPointerMove(event);
            }
        }
        function onTouchEndWindow(e: TouchEvent) {
            editorStore.get('toolCanvasController').onPointerUp(translateTouchEventToPointerEvents('pointerup', e)[0]);
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
            isPointerInsideMain,
            onPointerDownMain,
            onTouchStartMain,
            onWheelMain
        };
    }
});
</script>
