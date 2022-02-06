<template>
    <div class="ogr-layout-menu-bar theme-dark" :class="{ 'is-vertical': direction === 'vertical' }" @touchmove="onTouchMoveMenuBar($event)">
        <div ref="flexContainer" class="is-flex container mx-auto">
            <div v-for="(actionGroupSection, actionGroupSectionName) of actionGroups" :key="actionGroupSectionName" class="ogr-menu-section my-2" :class="['ogr-menu-' + actionGroupSectionName, { 'px-3': actionGroupSectionName !== 'center' }]">
                <span v-if="actionGroupSectionName === 'center' && direction === 'vertical'" class="ogr-menu-section__title">
                    Tools
                </span>
                <component :is="actionGroupSectionName === 'center' ? 'el-scrollbar' : 'div'">
                    <template v-for="actionGroup of actionGroupSection" :key="actionGroup.id">
                        <component :is="actionGroup.controls.length === 1 ? 'div' : 'el-button-group'" :class="{ 'ogr-single-button-group': actionGroup.controls.length === 1 }">
                            <template v-for="control of actionGroup.controls" :key="control.label">
                                <el-popover
                                    v-model:visible="control.popoverVisible"
                                    :trigger="control.showDock || control.expanded ? 'manual' : 'hover'"
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
                                            :aria-label="control.label"
                                            :type="activeToolGroup === (control.action && control.action.target) ? 'primary' : undefined"
                                            plain
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
                                            @mouseleave="onMouseLeaveControlButton($event)"
                                            @keydown="onKeyDownControlButton($event, control)"
                                        >
                                            <span class="el-icon" :class="control.icon" aria-hidden="true" />
                                            <span v-if="control.expanded" class="ml-2">{{ control.label }}</span>
                                            <el-tag v-if="control.expanded" type="info" class="ml-2 el-tag--mini">Ctrl + K</el-tag>
                                        </el-button>
                                    </template>
                                    <template v-if="control.showDock">
                                        <div v-if="control.displayTitle" class="ogr-dock-title">{{ control.displayTitle }}</div>
                                        <dynamically-loaded-dock
                                            :name="control.action.target" :key="'dock-' + control.action.target"
                                            @update:title="control.displayTitle = $event"
                                            @close="control.popoverVisible = false"
                                        />
                                    </template>
                                    <template v-else>
                                        <div class="px-3 py-2">
                                            {{ control.label }}
                                        </div>
                                    </template>
                                </el-popover>
                            </template>
                        </component>
                    </template>
                </component>
            </div>
            <div v-if="displayMode === 'favorites'" class="ogr-menu-section ogr-menu-end py-2 px-3">
                <div class="ogr-single-button-group">
                    <el-popover
                        v-model:visible="showMoreActionsTooltip"
                        :trigger="showMoreActionsMenu ? 'manual' : 'hover'"
                        effect="light"
                        :placement="popoverPlacement"
                        :popper-class="'ogr-dock-popover'"
                        :show-after="0"
                        :append-to-body="false"
                        :popper-options="{ boundariesElement: 'body' }">
                        <template #reference>
                            <el-button
                                aria-label="More Tools"
                                icon="bi bi-list"
                                plain
                                circle
                                @click="showMoreActionsMenu = true; showMoreActionsTooltip = false"
                            ></el-button>
                        </template>
                        <div class="px-3 py-2">
                            More Tools
                        </div>
                    </el-popover>
                </div>
                <el-drawer
                    v-model="showMoreActionsMenu"
                    title="Tools and Settings"
                    :size="300"
                    :append-to-body="false">
                    <div class="is-position-absolute-full">
                        <el-scrollbar>
                            <el-menu :default-active="activeToolGroup">
                                <template v-for="(actionGroupSection, actionGroupSectionName) of allActionGroups" :key="actionGroupSectionName">
                                    <template v-for="actionGroup of actionGroupSection" :key="actionGroup.id">
                                        <template v-for="control of actionGroup.controls" :key="control.label">
                                            <el-menu-item
                                                v-if="actionGroup.id !== 'search'"
                                                :index="control.action && control.action.type === 'toolGroup' ? actionGroup.id : null"
                                                @click="onPressControlButton('modal', 0, control)"
                                            >
                                                <i :class="control.icon + ' mr-3'" aria-hidden="true"></i>
                                                <span>{{ control.label }}</span>
                                            </el-menu-item>
                                        </template>
                                    </template>
                                </template>
                            </el-menu>
                        </el-scrollbar>
                    </div>
                </el-drawer>
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
import Dock from './dock.vue';
import { runModule } from '@/modules';

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
        ElTag
    },
    props: {
        config: {
            type: Object as PropType<DndLayoutMenuBar>,
            required: true
        },
        direction: {
            type: String as PropType<'horizontal' | 'vertical'>,
            default: 'horizontal'
        },
        layoutPlacement: {
            type: String as PropType<'top' | 'bottom' | 'left' | 'right'>,
            default: 'top'
        },
    },
    setup(props, options) {
        let activeControlDock: LayoutShortcutGroupDefinitionControlButton | null = null;
        let pendingActiveControlCall: IArguments | null = null;
        let flexContainer = ref<HTMLDivElement>();
        let displayMode = ref<'all' | 'favorites'>('all');
        let showMoreActionsMenu = ref<boolean>(false);
        let showMoreActionsTooltip = ref<boolean>(false);
        let popoverPlacement = ref<'top' | 'bottom'>('top');

        let resizeDebounceHandle: number | undefined = undefined;
        let pointerDownElement: EventTarget | null = null;
        let pointerDownId: number;
        let pointerDownButton: number;
        let pointerDownShowDock: boolean = false;
        let pointerPressHoldTimeoutHandle: number | undefined;
        const { viewWidth: viewportWidth, viewHeight: viewportHeight } = toRefs(canvasStore.state);
        const { activeToolGroup, activeTool } = toRefs(editorStore.state);

        const actionGroups = ref<{ [key: string]: LayoutShortcutGroupDefinition[] }>(createActionGroups());
        const allActionGroups = ref<{ [key: string]: LayoutShortcutGroupDefinition[] }>(createActionGroups('all'));

        watch([displayMode], () => {
            actionGroups.value = createActionGroups();
            showMoreActionsMenu.value = false;
        });
        watch(() => props.layoutPlacement, (layoutPlacement) => {
            popoverPlacement.value = {
                bottom: 'top',
                top: 'bottom',
                left: 'right',
                right: 'left'
            }[layoutPlacement] as any;
        }, { immediate: true });

        if (props.direction === 'horizontal') {
            watch([viewportWidth], () => {
                toggleMobileView();
            });
        }

        onMounted(() => {
            window.addEventListener('mousedown', onMouseDownWindow);
            window.addEventListener('mouseup', onMouseUpWindow);
            window.addEventListener('touchstart', onTouchStartWindow);
            window.addEventListener('touchend', onTouchEndWindow);
            toggleMobileView();
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
                displayMode.value = 'all';
                await nextTick();
                const flexContainerEl = flexContainer.value;
                if (flexContainerEl && flexContainerEl.scrollWidth > flexContainerEl.clientWidth + 1) {
                    displayMode.value = 'favorites';
                }
            }, 100);
        }

        function createActionGroups(forceDisplayMode?: string): { [key: string]: LayoutShortcutGroupDefinition[] } {
            activeControlDock = null;
            pendingActiveControlCall = null;
            forceDisplayMode = forceDisplayMode || displayMode.value;
            let actionGroups: { [key: string]: LayoutShortcutGroupDefinition[] } = {};
            const sectionNames = (forceDisplayMode === 'all' ? ['start', 'center', 'end'] : ['favorites']) as ('start' | 'center' | 'end' | 'favorites')[];
            for (let section of sectionNames) {
                if (props.config.actionGroupLayout[section]) {
                    const sectionActionGroups: LayoutShortcutGroupDefinition[] = [];
                    for (let tool of props.config.actionGroupLayout[section]) {
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
        function onMouseLeaveControlButton(event: MouseEvent) {
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
                                activeControlDock = control;
                                control.showDock = true;
                                control.popoverVisible = true;
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

        return {
            showMoreActionsMenu,
            showMoreActionsTooltip,
            popoverPlacement,
            displayMode,
            flexContainer,
            actionGroups,
            allActionGroups,
            activeToolGroup,
            activeTool,
            onAfterLeavePopover,
            onKeyDownControlButton,
            onTouchStartControlButton,
            onTouchEndControlButton,
            onTouchMoveMenuBar,
            onMouseDownControlButton,
            onMouseUpControlButton,
            onMouseLeaveControlButton,
            onPressControlButton
        };
    }
});
</script>
