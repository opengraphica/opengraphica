<template>
    <div
        class="ogr-layout-menu-bar theme-dark"
        :class="[
            'is-positioned-' + layoutPlacement,
            {
                'is-vertical': direction === 'vertical',
                'is-menu-drawer-open': activeMenuDrawerComponentName != null
            }
        ]"
        @touchmove="onTouchMoveMenuBar($event)">
        <div ref="flexContainer" class="is-flex container mx-auto">
            <div
                v-for="(actionGroupSection, actionGroupSectionName) of actionGroups"
                :key="actionGroupSectionName"
                class="ogr-menu-section my-2"
                :class="['ogr-menu-' + actionGroupSectionName, { 'px-3': actionGroupSectionName !== 'tools' }]"
            >
                <span v-if="actionGroupSectionName === 'tools'" class="ogr-menu-section__title">{{ $t('menuBar.toolsHeading') }}</span>
                <component v-if="displayMode === 'all' || actionGroupSectionName === 'tools'" :is="actionGroupSectionName === 'tools' ? 'el-scrollbar' : 'v-fragment'">
                    <template v-for="actionGroup of actionGroupSection" :key="actionGroup.id">
                        <component :is="actionGroup.controls.length === 1 ? 'div' : 'el-button-group'" :class="{ 'ogr-single-button-group': actionGroup.controls.length === 1 }">
                            <template v-for="control of actionGroup.controls" :key="control.label">
                                <el-popover
                                    v-model:visible="control.popoverVisible"
                                    :trigger="'manual'"
                                    effect="light"
                                    :placement="popoverPlacement"
                                    :popper-class="'ogr-dock-popover'"
                                    :show-after="0"
                                    :hide-after="0"
                                    :transition="control.showDock ? 'el-fade-in-linear' : 'none'"
                                    :popper-options="{ boundariesElement: 'body' }"
                                    append-to=".opengraphica"
                                    @after-leave="onAfterLeavePopover(control)">
                                    <template #reference>
                                        <el-button
                                            :aria-label="$t(control.label)"
                                            :type="[activeToolGroup, activeMenuDrawerComponentName].includes(control.action && control.action.target) ? 'primary' : undefined"
                                            :plain="![activeToolGroup, activeMenuDrawerComponentName].includes(control.action && control.action.target)"
                                            :circle="!control.expanded"
                                            :round="control.expanded"
                                            :class="{
                                                'el-button--expanded-group': control.expanded,
                                                'el-button--expanded-popover': control.showDock
                                            }"
                                            @touchstart="onTouchStartControlButton($event, control)"
                                            @touchend="onTouchEndControlButton($event, control)"
                                            @mousedown="onMouseDownControlButton($event, control)"
                                            @mouseup="onMouseUpControlButton($event, control)"
                                            @mouseenter="onMouseEnterControlButton($event, control)"
                                            @mouseleave="onMouseLeaveControlButton($event, control)"
                                            @keydown="onKeyDownControlButton($event, control)"
                                        >
                                            <span class="el-icon" :class="control.icon" aria-hidden="true" />
                                            <span v-if="control.expanded" class="ml-2">{{ $t(control.label) }}</span>
                                            <el-tag v-if="control.expanded" type="info" class="ml-2 el-tag--mini">Ctrl + K</el-tag>
                                        </el-button>
                                    </template>
                                    <template v-if="control.showDock">
                                        <div v-if="control.displayTitle" class="ogr-dock-title" v-t="control.displayTitle" />
                                        <dynamically-loaded-dock
                                            :name="control.action.target" :key="'dock-' + control.action.target"
                                            @update:title="control.displayTitle = $event"
                                            @close="control.popoverVisible = false"
                                        />
                                    </template>
                                    <template v-else>
                                        <div class="px-3 py-2">
                                            {{ $t(control.label) }}
                                        </div>
                                    </template>
                                </el-popover>
                            </template>
                        </component>
                    </template>
                </component>
            </div>
            <div v-if="isTouchUser" class="ogr-menu-end px-3">
                <el-button circle round class="el-button--no-hover" :aria-label="$t('dock.settings.history.undo')" @click="onClickUndo">
                    <span class="el-icon bi bi-arrow-counterclockwise" aria-hidden="true" />
                </el-button>
            </div>
            <div v-else class="ogr-menu-end px-3" style="height: 0px; overflow: hidden; visibility: hidden;">
                <el-button aria-hidden="true" circle round>
                    <span class="el-icon" aria-hidden="true" />
                </el-button>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, computed, nextTick, watch, PropType, ref, onMounted, onUnmounted, toRefs, defineAsyncComponent } from 'vue';
import ElButton, { ElButtonGroup } from 'element-plus/lib/components/button/index';
import ElLoading from 'element-plus/lib/components/loading/index';
import ElPopover from '@/ui/el-popover.vue';
import ElTag from 'element-plus/lib/components/tag/index';
import { LayoutShortcutGroupDefinition, LayoutShortcutGroupDefinitionControlButton, DndLayoutMenuBar } from '@/types';
import actionGroupsDefinition from '@/config/layout-shortcut-groups.json';
import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import preferencesStore from '@/store/preferences';
import appEmitter from '@/lib/emitter';
import { runModule } from '@/modules';
import Dock from './dock.vue';
import VFragment from './v-fragment.vue';

export default defineComponent({
    name: 'AppLayoutMenuBar',
    directives: {
        loading: ElLoading.directive
    },
    components: {
        DynamicallyLoadedDock: Dock,
        ElButton,
        ElButtonGroup,
        ElDrawer: defineAsyncComponent(() => import(`element-plus/lib/components/drawer/index`)),
        ElMenu: defineAsyncComponent(() => import(`element-plus/lib/components/menu/index`)),
        ElMenuItem: defineAsyncComponent(async () => (await import(`element-plus/lib/components/menu/index`)).ElMenuItem),
        ElPopover,
        ElScrollbar: defineAsyncComponent(() => import(`element-plus/lib/components/scrollbar/index`)),
        ElTag,
        VFragment
    },
    props: {
        config: {
            type: Object as PropType<DndLayoutMenuBar>,
            required: true
        },
        layoutPlacement: {
            type: String as PropType<'top' | 'bottom' | 'left' | 'right'>,
            default: 'top'
        },
    },
    emit: ['resize'],
    setup(props, { emit }) {
        const mobileWidth: number = 550;

        let activeControlDock: LayoutShortcutGroupDefinitionControlButton | null = null;
        let pendingActiveControlCall: IArguments | null = null;
        let flexContainer = ref<HTMLDivElement>();
        let displayMode = ref<'all' | 'tools'>('all');
        let direction = ref<'horizontal' | 'vertical'>('horizontal');
        let showMoreActionsMenu = ref<boolean>(false);
        let showMoreActionsTooltip = ref<boolean>(false);
        let popoverPlacement = ref<'top' | 'bottom' | 'left' | 'right'>('top');

        let resizeDebounceHandle: number | undefined = undefined;
        let pointerDownElement: EventTarget | null = null;
        let pointerDownId: number;
        let pointerDownButton: number;
        let pointerDownShowDock: boolean = false;
        let pointerPressHoldTimeoutHandle: number | undefined;
        const { viewWidth: viewportWidth, viewHeight: viewportHeight } = toRefs(canvasStore.state);
        const { activeToolGroup, activeTool } = toRefs(editorStore.state);

        const actionGroups = ref<{ [key: string]: LayoutShortcutGroupDefinition[] }>(createActionGroups());

        const activeMenuDrawerComponentName = computed<string | null>(() => {
            return editorStore.state.activeMenuDrawerComponentName;
        });

        const isTouchUser = computed<boolean>(() => {
            return editorStore.state.isTouchUser;
        });

        watch([viewportWidth], () => {
            toggleMobileView();
        });
        watch([displayMode], () => {
            showMoreActionsMenu.value = false;
        });
        watch(() => props.layoutPlacement, (layoutPlacement) => {
            direction.value = ['left', 'right'].includes(layoutPlacement) ? 'vertical' : 'horizontal';
            popoverPlacement.value = {
                bottom: 'top',
                top: 'bottom',
                left: 'right',
                right: 'left'
            }[layoutPlacement] as any;
        }, { immediate: true });

        onMounted(() => {
            window.addEventListener('mousedown', onMouseDownWindow);
            window.addEventListener('mouseup', onMouseUpWindow);
            window.addEventListener('touchstart', onTouchStartWindow);
            window.addEventListener('touchend', onTouchEndWindow);
            
            displayMode.value = viewportWidth.value / (window.devicePixelRatio || 1) > preferencesStore.state.dockHideBreakpoint ? 'tools' : 'all';

            emit('resize');
        });

        onUnmounted(() => {
            window.removeEventListener('mousedown', onMouseDownWindow);
            window.removeEventListener('mouseup', onMouseUpWindow);
            window.removeEventListener('touchstart', onTouchStartWindow);
            window.removeEventListener('touchend', onTouchEndWindow);
        });

        function toggleMobileView() {
            window.clearTimeout(resizeDebounceHandle);
            resizeDebounceHandle = window.setTimeout(async () => {
                displayMode.value = viewportWidth.value / (window.devicePixelRatio || 1) > preferencesStore.state.dockHideBreakpoint ? 'tools' : 'all';
            }, 400);
        }

        function createActionGroups(forceDisplayMode?: string): { [key: string]: LayoutShortcutGroupDefinition[] } {
            activeControlDock = null;
            pendingActiveControlCall = null;
            forceDisplayMode = forceDisplayMode || displayMode.value;
            let actionGroups: { [key: string]: LayoutShortcutGroupDefinition[] } = {};
            const sectionNames = ['docks', 'tools'] as ('docks' | 'tools')[];
            for (let section of sectionNames) {
                if (props.config.layout[section]) {
                    const sectionActionGroups: LayoutShortcutGroupDefinition[] = [];
                    for (let tool of props.config.layout[section] || []) {
                        const actionGroup = {
                            id: tool,
                            ...(actionGroupsDefinition as { [key: string]: LayoutShortcutGroupDefinition })[tool]
                        }
                        if (actionGroup.controls) {
                            for (let control of actionGroup.controls) {
                                control.displayTitle = '';
                                control.popoverVisible = false;
                                control.showDock = false;
                            }
                        }
                        sectionActionGroups.push(actionGroup);
                    }
                    actionGroups[section] = sectionActionGroups;
                }
            }
            return actionGroups;
        };

        function onKeyDownControlButton(event: KeyboardEvent, control: LayoutShortcutGroupDefinitionControlButton) {
            if (event.key === 'Enter') {
                onPressControlButton('popover', 0, control);
            }
        }

        function onTouchStartControlButton(event: TouchEvent, control: LayoutShortcutGroupDefinitionControlButton) {
            onPointerDownControlButton(event, control);
        }
        function onTouchEndControlButton(event: TouchEvent, control: LayoutShortcutGroupDefinitionControlButton) {
            onPointerUpControlButton(event, control);
        }
        function onTouchMoveMenuBar(event: TouchEvent) {
            if (pointerDownElement) {
                for (let i = 0; i < event.touches.length; i++) {
                    if (event.touches[i].identifier === pointerDownId) {
                        if (pointerDownElement !== event.touches[i].target) {
                            clearTimeout(pointerPressHoldTimeoutHandle);
                        }
                        break;
                    }
                }
            }
        }
        function onTouchStartWindow(event: TouchEvent) {
            onPointerDownWindow(event);
        }
        function onTouchEndWindow(event: TouchEvent) {
            onPointerUpWindow(event);
        }

        function onMouseDownControlButton(event: MouseEvent, control: LayoutShortcutGroupDefinitionControlButton) {
            onPointerDownControlButton(event, control);
        }
        function onMouseUpControlButton(event: MouseEvent, control: LayoutShortcutGroupDefinitionControlButton) {
            onPointerUpControlButton(event, control);
        }
        function onMouseEnterControlButton(event: MouseEvent, control: LayoutShortcutGroupDefinitionControlButton) {
            if (!(control.showDock || control.expanded)) {
                control.popoverVisible = true;
            }
        }
        function onMouseLeaveControlButton(event: MouseEvent, control: LayoutShortcutGroupDefinitionControlButton) {
            if (!(control.showDock || control.expanded)) {
                control.popoverVisible = false;
            }
            clearTimeout(pointerPressHoldTimeoutHandle);
        }
        function onMouseDownWindow(event: MouseEvent) {
            onPointerDownWindow(event);
        }
        function onMouseUpWindow(event: MouseEvent) {
            onPointerUpWindow(event);
        }

        function onPointerDownControlButton(event: TouchEvent | MouseEvent, control: LayoutShortcutGroupDefinitionControlButton) {
            event.preventDefault();
            if (event.target && activeControlDock) {
                const target = event.target as Element;
                activeControlDock.popoverVisible = false;
            }
            pointerDownElement = event.target;
            pointerDownId = (event as TouchEvent).touches ? (event as TouchEvent).touches[0].identifier : 0;
            pointerDownButton = (event as MouseEvent).button || 0;
            pointerDownShowDock = control.showDock || false;
            clearTimeout(pointerPressHoldTimeoutHandle);
            pointerPressHoldTimeoutHandle = window.setTimeout(() => {
                pointerDownElement = null;
                pointerDownButton = -1;
                pointerDownId = -1;
                onPressHoldControlButton(event, control);
            }, preferencesStore.get('pointerPressHoldTimeout'));
        }
        function onPointerUpControlButton(event: TouchEvent | MouseEvent, control: LayoutShortcutGroupDefinitionControlButton) {
            clearTimeout(pointerPressHoldTimeoutHandle);
            let id = pointerDownId;
            if ((event as TouchEvent).touches) {
                for (let i = 0; i < (event as TouchEvent).touches.length; i++) {
                    if ((event as TouchEvent).touches[i].identifier === pointerDownId) {
                        pointerDownId = -1;
                        break;
                    }
                }
            }
            const button = (event as MouseEvent).button || 0;
            if (pointerDownElement === event.target && pointerDownButton === button && pointerDownId === id) {
                onPressControlButton('popover', button, control);
                pointerDownElement = null;
                pointerDownButton = -1;
                pointerDownId = -1;
                ((event.target as HTMLButtonElement).closest('button') as any).focus();
            }
        }
        function onPointerDownWindow(event: TouchEvent | MouseEvent) {
            if (event.target && activeControlDock) {
                const target = event.target as Element;
                if (!target.closest || !target.closest('.el-popover')) {
                    activeControlDock.popoverVisible = false;
                }
            }
        }
        function onPointerUpWindow(event: TouchEvent | MouseEvent) {
            clearTimeout(pointerPressHoldTimeoutHandle);
            let id = pointerDownId;
            if ((event as TouchEvent).touches) {
                for (let i = 0; i < (event as TouchEvent).touches.length; i++) {
                    if ((event as TouchEvent).touches[i].identifier === pointerDownId) {
                        pointerDownId = -1;
                        break;
                    }
                }
            }
            const button = (event as MouseEvent).button || 0;
            if (pointerDownButton === button && pointerDownId === id) {
                pointerDownElement = null;
                pointerDownButton = -1;
                pointerDownId = -1;
            }
        }
        async function onPressControlButton(openTarget: 'popover' | 'modal', button: number, control: LayoutShortcutGroupDefinitionControlButton) {
            if (activeControlDock) {
                pendingActiveControlCall = arguments;
            } else {
                if (control.action) {
                    if (control.action.type === 'toolGroup') {
                        if (button === 0 && activeToolGroup.value !== control.action.target) {
                            editorStore.dispatch('setActiveTool', { group: control.action.target });
                            if (openTarget === 'modal') {
                                showMoreActionsMenu.value = false;
                            }
                        } else {
                            
                        }
                    } else if (control.action.type === 'dock') {
                        if (openTarget === 'popover') {
                            if (!pointerDownShowDock) {
                                if (window.innerWidth < mobileWidth) {
                                    control.popoverVisible = false;
                                    appEmitter.emit('app.menuDrawer.openFromDock', {
                                        name: control.action.target,
                                        placement: popoverPlacement.value
                                    });
                                } else {
                                    activeControlDock = control;
                                    control.showDock = true;
                                    control.popoverVisible = true;
                                    appEmitter.emit('app.menuDrawer.closeAll');
                                }
                            } else {
                                control.popoverVisible = false;
                            }
                        } else if (openTarget === 'modal') {
                            appEmitter.emit('app.dialogs.openFromDock', { name: control.action.target });
                            showMoreActionsMenu.value = false;
                        }
                    } else if (control.action.type === 'runModule') {
                        const actionSplit = control.action.target.split('/');
                        await runModule(actionSplit[0], actionSplit[1]);
                    }
                }
            }
        }
        function onPressHoldControlButton(event: TouchEvent | MouseEvent, control: LayoutShortcutGroupDefinitionControlButton) {
            // TODO - drag & drop
        }

        function onAfterLeavePopover(control: LayoutShortcutGroupDefinitionControlButton) {
            if (control === activeControlDock) {
                activeControlDock = null;
                control.showDock = false;
                if (pendingActiveControlCall) {
                    onPressControlButton.apply(window, pendingActiveControlCall as any);
                    pendingActiveControlCall = null;
                }
            }
        }

        function onClickUndo() {
            runModule('history', 'undo');
        }

        return {
            activeMenuDrawerComponentName,
            showMoreActionsMenu,
            showMoreActionsTooltip,
            popoverPlacement,
            displayMode,
            direction,
            flexContainer,
            actionGroups,
            activeToolGroup,
            activeTool,
            isTouchUser,
            onAfterLeavePopover,
            onKeyDownControlButton,
            onTouchStartControlButton,
            onTouchEndControlButton,
            onTouchMoveMenuBar,
            onMouseDownControlButton,
            onMouseUpControlButton,
            onMouseEnterControlButton,
            onMouseLeaveControlButton,
            onPressControlButton,
            onClickUndo
        };
    }
});
</script>
