<template>
    <div
        ref="dndContainer" class="ogr-layout-dnd-container"
        :style="{
            '--ogr-sidebar-left-width': sidebarLeftWidth + 'px',
            '--ogr-sidebar-right-width': sidebarRightWidth + 'px',
            '--ogr-footer-height': footerHeight + 'px',
        }"
    >
        <header ref="header" :aria-busy="isShowHistoryNotification && !isHistoryNotificationCompleted">
            <h1 class="is-sr-only">OpenGraphica</h1>
            <template v-if="!isActiveToolbarExclusive && config.menuBar && menuBarPosition === 'top'">
                <app-layout-menu-bar :config="config.menuBar" layout-placement="top" @resize="onResizeLayout" />
            </template>
            <toolbar
                ref="headerToolbar"
                v-if="activeToolbar && activeToolbarPosition === 'top'"
                :name="activeToolbar"
                :class="['is-top', { 'is-overlay': !isActiveToolbarExclusive }]"
            />
        </header>
        <div class="ogr-layout-dnd-center" :aria-busy="isShowHistoryNotification && !isHistoryNotificationCompleted">
            <aside aria-label="Left Sidebar" class="ogr-sidebar-left" ref="sidebarLeft">
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
            <aside aria-label="Right Sidebar" class="ogr-sidebar-right" ref="sidebarRight">
                <template v-if="showDock && !isActiveToolbarExclusive && config.dock && dockPosition === 'right'">
                    <app-layout-dock :config="config.dock" layout-placement="right" @resize="onResizeLayout" />
                </template>
                <template v-if="!isActiveToolbarExclusive && config.menuBar && menuBarPosition === 'right'">
                    <app-layout-menu-bar :config="config.menuBar" layout-placement="right"  @resize="onResizeLayout" />
                </template>
            </aside>
        </div>
        <footer ref="footer" :aria-busy="isShowHistoryNotification && !isHistoryNotificationCompleted">
            <toolbar
                ref="footerToolbar"
                v-if="activeToolbar && ['bottom', 'auto'].includes(activeToolbarPosition)"
                :name="activeToolbar"
                :class="['is-bottom', 'is-menu-bar-' + menuBarPosition, { 'is-overlay': !isActiveToolbarExclusive }]"
            />
            <app-layout-menu-bar
                v-if="!isActiveToolbarExclusive && config.menuBar && menuBarPosition === 'bottom'"
                :config="config.menuBar"
                layout-placement="bottom" 
                @resize="onResizeLayout"
            />
        </footer>
        <div
            v-if="isShowHistoryNotification"
            class="ogr-history-notification-overlay theme-dark"
            :class="{ 'ogr-history-notification-overlay--completed': isHistoryNotificationCompleted }"
            @animationend="onAnimationEndHistoryNotificationOverlay()"
            @click="onClickHistoryNotificationOverlay($event)"
        >
            <div class="ogr-history-notification-container">
                <div ref="historyNotification" role="alert" class="ogr-history-notification" :class="{ 'ogr-history-notification--highlight': isHighlightHistoryNotification }">
                    <i
                        class="bi"
                        :class="{
                            'bi-clock-history': !isHistoryNotificationCompleted,
                            'bi-check-circle': isHistoryNotificationCompleted,
                        }"
                        aria-hidden="true"
                    />
                    <div>
                        <h2 v-t="`app.historyNotification.title.${historyNotificationActionTrigger}.${isHistoryNotificationCompleted ? 'complete' : 'inProgress'}`" />
                        <p v-t="currentHistoryStepActionDescription" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, Ref, toRefs, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import AppLayoutDock from '@/ui/app-layout-dock.vue';
import AppLayoutMenuBar from '@/ui/app-layout-menu-bar.vue';
import Toolbar from '@/ui/toolbar.vue';
import defaultDndLayoutConfig from '@/config/default-dnd-layout.json';
import appEmitter, { type AppEmitterEvents } from '@/lib/emitter';
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
        const footerElement = ref<Element>();
        const headerToolbarComponent = ref<InstanceType<typeof Toolbar> | undefined>();
        const footerToolbarComponent = ref<InstanceType<typeof Toolbar> | undefined>();
        const config = ref<DndLayout>(defaultDndLayoutConfig.dndLayout as DndLayout);
        const isPointerInsideMain = ref<boolean>(false);
        const isPointerEventsSupported: boolean = 'onpointerdown' in document.body;
        const sidebarLeftWidth = ref<number>(0);
        const sidebarRightWidth = ref<number>(0);
        const footerHeight = ref<number>(0);
        const showDock = ref<boolean>(true);

        const historyNotificationElement = ref<Element>();
        const historyNotificationActionTrigger = ref<'do' | 'undo' | 'redo'>('do');
        const isShowHistoryNotification = ref<boolean>(false);
        const isHistoryNotificationCompleted = ref<boolean>(false);
        const isHighlightHistoryNotification = ref<boolean>(false);
        const currentHistoryStepActionDescription = ref<string>('');

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

        watch(() => [footerToolbarComponent.value, footerElement.value], () => {
            calculateFooterHeight();
        }, { immediate: true })

        onMounted(async () => {
            if (editorStore.state.activeToolGroupRestore) {
                editorStore.dispatch('setActiveTool', { group: editorStore.state.activeToolGroupRestore });
            }

            showDock.value = viewWidth.value / (window.devicePixelRatio || 1) > preferencesStore.state.dockHideBreakpoint;

            appEmitter.on('app.canvas.calculateDndArea', calculateDndArea);
            appEmitter.on('editor.history.startBlocking', showHistoryNotification);
            appEmitter.on('editor.history.step', stepHistoryNotification);
            appEmitter.on('editor.history.stopBlocking', hideHistoryNotification);
            window.addEventListener('touchmove', onTouchMoveWindow);
            window.addEventListener('touchend', onTouchEndWindow);
            window.addEventListener('pointerup', onPointerUpWindow);
            window.addEventListener('pointermove', onPointerMoveWindow);

            nextTick(() => {
                calculateDndArea();
                onResizeLayout();
            });

            emit('dnd-ready', { mainElement: mainElement.value });
            appEmitter.emit('app.canvas.resetTransform');
        });

        onUnmounted(() => {
            appEmitter.off('app.canvas.calculateDndArea', calculateDndArea);
            appEmitter.off('editor.history.startBlocking', showHistoryNotification);
            appEmitter.off('editor.history.step', stepHistoryNotification);
            appEmitter.off('editor.history.stopBlocking', hideHistoryNotification);
            window.removeEventListener('touchmove', onTouchMoveWindow);
            window.removeEventListener('touchend', onTouchEndWindow);
            window.removeEventListener('pointerup', onPointerUpWindow);
            window.removeEventListener('pointermove', onPointerMoveWindow);
        });

        function calculateDndArea() {
            if (dndContainerElement.value && mainElement.value) {
                let footerToolbarHeight = 0;
                const dndContainerRect = dndContainerElement.value.getBoundingClientRect();
                const mainRect = mainElement.value.getBoundingClientRect();
                if (footerToolbarComponent.value?.$el) {
                    const toolbarRect = footerToolbarComponent.value.$el.getBoundingClientRect();
                    footerToolbarHeight = toolbarRect.height;
                }
                const devicePixelRatio = window.devicePixelRatio || 1;
                canvasStore.set('dndAreaLeft', (mainRect.left - dndContainerRect.left) * devicePixelRatio);
                canvasStore.set('dndAreaTop', (mainRect.top - dndContainerRect.top) * devicePixelRatio);
                canvasStore.set('dndAreaWidth', mainRect.width * devicePixelRatio);
                canvasStore.set('dndAreaHeight', (mainRect.height - footerToolbarHeight) * devicePixelRatio);
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
            sidebarLeftWidth.value = sidebarLeftElement.value?.clientWidth || 0;
            sidebarRightWidth.value = sidebarRightElement.value?.clientWidth || 0;
            calculateFooterHeight();
            emit('resize', { sidebarLeftWidth: sidebarLeftWidth.value, sidebarRightWidth: sidebarRightWidth.value });
        }

        function calculateFooterHeight () {
            if (dndContainerElement.value && footerToolbarComponent?.value?.$el) {
                const dndContainerRect = dndContainerElement.value.getBoundingClientRect();
                const toolbarRect = footerToolbarComponent.value.$el.getBoundingClientRect();
                footerHeight.value = dndContainerRect.y + dndContainerRect.height - toolbarRect.y;
                return;
            }

            let totalFooterHeight = 0;

            if (footerToolbarComponent?.value?.$el) {
                const toolbarRect = footerToolbarComponent.value.$el.getBoundingClientRect();
                totalFooterHeight += toolbarRect.height;
            }
            if (footerElement.value) {
                const footerRect = footerElement.value.getBoundingClientRect();
                totalFooterHeight += footerRect.height;
            }
            footerHeight.value = totalFooterHeight;
        }

        function showHistoryNotification(event?: AppEmitterEvents['editor.history.startBlocking']) {
            calculateFooterHeight();
            historyNotificationActionTrigger.value = event?.trigger ?? 'do';
            currentHistoryStepActionDescription.value = event?.actions[0].description ?? 'pleaseWait';
            isShowHistoryNotification.value = true;
            isHighlightHistoryNotification.value = false;
            isHistoryNotificationCompleted.value = false;
        }

        function stepHistoryNotification(event?: AppEmitterEvents['editor.history.step']) {
            currentHistoryStepActionDescription.value = event?.action.description ?? 'action.pleaseWait';
        }

        function hideHistoryNotification() {
            isHistoryNotificationCompleted.value = true;
        }

        async function onClickHistoryNotificationOverlay(event: MouseEvent) {
            if (historyNotificationElement.value?.contains(event?.target as Node)) return;
            isHighlightHistoryNotification.value = false;
            await nextTick();
            setTimeout(() => {
                isHighlightHistoryNotification.value = true;
            }, 50);
        }

        function onAnimationEndHistoryNotificationOverlay() {
            if (isHistoryNotificationCompleted.value === true) {
                isShowHistoryNotification.value = false;
            }
        }

        return {
            dndContainer: dndContainerElement,
            main: mainElement,
            sidebarLeft: sidebarLeftElement,
            sidebarLeftWidth,
            sidebarRightWidth,
            footer: footerElement,
            footerHeight,
            sidebarRight: sidebarRightElement,
            showDock,
            headerToolbar: headerToolbarComponent,
            footerToolbar: footerToolbarComponent,
            config,
            canvasState: canvasStore.state,
            activeToolbar,
            activeToolbarPosition,
            dockPosition,
            isCanvasInteractable,
            isActiveToolbarExclusive,
            isPointerInsideMain,
            menuBarPosition,

            historyNotification: historyNotificationElement,
            historyNotificationActionTrigger,
            currentHistoryStepActionDescription,
            isShowHistoryNotification,
            isHistoryNotificationCompleted,
            isHighlightHistoryNotification,

            onPointerDownMain,
            onTouchStartMain,
            onResizeLayout,
            onWheelMain,
            onClickHistoryNotificationOverlay,
            onAnimationEndHistoryNotificationOverlay,
        };
    }
});
</script>
