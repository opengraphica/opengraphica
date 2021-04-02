<template>
    <div class="ogr-layout-menu-bar" @touchmove="onTouchMoveMenuBar($event)">
        <div class="is-flex container mx-auto">
            <div v-for="(actionGroupSection, actionGroupSectionName) of actionGroups" :key="actionGroupSectionName" class="py-2" :class="['menu-' + actionGroupSectionName, { 'px-3': actionGroupSectionName !== 'center' }]">
                <template v-for="actionGroup of actionGroupSection" :key="actionGroup.id">
                    <component :is="actionGroup.controls.length === 1 ? 'div' : 'el-button-group'" :class="{ 'single-button-group': actionGroup.controls.length === 1 }">
                        <template v-for="control of actionGroup.controls" :key="control.label">
                            <el-popover
                                v-model:visible="control.popoverVisible"
                                :trigger="control.showDock || control.expanded ? 'manual' : 'hover'"
                                effect="light"
                                placement="bottom"
                                :popper-class="'ogr-dock-popover'"
                                :show-after="control.showDock ? 0 : 500"
                                :append-to-body="false"
                                :popper-options="{ boundariesElement: 'body' }"
                                @after-leave="onAfterLeavePopover(control)">
                                <template #reference>
                                    <el-button
                                        :aria-label="control.label"
                                        :icon="control.icon"
                                        :type="activeToolGroup === (control.action && control.action.target) || control.showDock ? 'primary' : undefined"
                                        plain
                                        :circle="!control.expanded"
                                        :round="control.expanded"
                                        :class="{ 'el-button--expanded-group': control.expanded }"
                                        @touchstart="onTouchStartControlButton($event, control)"
                                        @touchend="onTouchEndControlButton($event, control)"
                                        @mousedown="onMouseDownControlButton($event, control)"
                                        @mouseup="onMouseUpControlButton($event, control)"
                                        @mouseleave="onMouseLeaveControlButton($event)"
                                        @keydown="onKeyDownControlButton($event, control)"
                                    >
                                        <span v-if="control.expanded" class="ml-2">{{ control.label }}</span>
                                        <el-tag v-if="control.expanded" size="mini" type="info" class="ml-2">Ctrl + K</el-tag>
                                    </el-button>
                                </template>
                                <template v-if="control.showDock">
                                    <dynamically-loaded-dock
                                        :name="control.action.target" :key="'dock-' + control.action.target"
                                        @close-popover="control.popoverVisible = false"
                                    />
                                </template>
                                <template v-else>
                                    <div class="p-2">
                                        {{ control.label }}
                                    </div>
                                </template>
                            </el-popover>
                        </template>
                    </component>
                </template>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, computed, watch, PropType, ref, onMounted, onUnmounted, toRefs } from 'vue';
import ElButton from 'element-plus/lib/el-button';
import ElButtonGroup from 'element-plus/lib/el-button-group';
import ElPopover from 'element-plus/lib/el-popover';
import ElTag from 'element-plus/lib/el-tag';
import { LayoutShortcutGroupDefinition, LayoutShortcutGroupDefinitionControlButton, DndLayoutMenuBar } from '@/types';
import actionGroupsDefinition from '@/config/layout-shortcut-groups.json';
import editorStore from '@/store/editor';
import preferencesStore from '@/store/preferences';
import Dock from './dock.vue';

export default defineComponent({
    name: 'AppLayoutMenuBar',
    components: {
        DynamicallyLoadedDock: Dock,
        ElButton,
        ElButtonGroup,
        ElTag,
        ElPopover
    },
    props: {
        config: {
            type: Object as PropType<DndLayoutMenuBar>,
            required: true
        }
    },
    setup(props, options) {
        let activeControlDock: LayoutShortcutGroupDefinitionControlButton | null = null;
        let pointerDownElement: EventTarget | null = null;
        let pointerDownId: number;
        let pointerDownButton: number;
        let pointerDownShowDock: boolean = false;
        let pointerPressHoldTimeoutHandle: number | undefined;
        const { activeToolGroup, activeTool } = toRefs(editorStore.state);

        const actionGroups = ref((() => {
            let actionGroups: { [key: string]: LayoutShortcutGroupDefinition[] } = {};
            for (let section  of ['start', 'center', 'end'] as ('start' | 'center' | 'end')[]) {
                if (props.config.actionGroupLayout[section]) {
                    const sectionActionGroups: LayoutShortcutGroupDefinition[] = [];
                    for (let tool of props.config.actionGroupLayout[section]) {
                        const actionGroup = {
                            id: tool,
                            ...(actionGroupsDefinition as { [key: string]: LayoutShortcutGroupDefinition })[tool]
                        }
                        if (actionGroup.controls) {
                            for (let control of actionGroup.controls) {
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
        })());

        onMounted(() => {
            window.addEventListener('mousedown', onMouseDownWindow);
            window.addEventListener('mouseup', onMouseUpWindow);
            window.addEventListener('touchstart', onTouchStartWindow);
            window.addEventListener('touchend', onTouchEndWindow);
        });

        onUnmounted(() => {
            window.removeEventListener('mousedown', onMouseDownWindow);
            window.removeEventListener('mouseup', onMouseUpWindow);
            window.removeEventListener('touchstart', onTouchStartWindow);
            window.removeEventListener('touchend', onTouchEndWindow);
        });

        function onKeyDownControlButton(event: KeyboardEvent, control: LayoutShortcutGroupDefinitionControlButton) {
            if (event.key === 'Enter') {
                onPressControlButton(0, control);
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
                onPressControlButton(button, control);
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
        async function onPressControlButton(button: number, control: LayoutShortcutGroupDefinitionControlButton) {
            if (control.action) {
                if (control.action.type === 'toolGroup') {
                    if (button === 0 && activeToolGroup.value !== control.action.target) {
                        editorStore.dispatch('setActiveTool', { group: control.action.target });
                    } else {
                        
                    }
                } else if (control.action.type === 'dock') {
                    if (!pointerDownShowDock) {
                        activeControlDock = control;
                        control.showDock = true;
                        control.popoverVisible = true;
                    } else {
                        control.popoverVisible = false;
                    }
                }
            }
        }
        function onPressHoldControlButton(event: TouchEvent | MouseEvent, control: LayoutShortcutGroupDefinitionControlButton) {
            // TODO - drag & drop
        }

        function onAfterLeavePopover(control: LayoutShortcutGroupDefinitionControlButton) {
            activeControlDock = null;
            control.showDock = false;
        }

        return {
            actionGroups,
            activeToolGroup,
            activeTool,
            onAfterLeavePopover,
            onKeyDownControlButton,
            onTouchStartControlButton,
            onTouchEndControlButton,
            onTouchMoveMenuBar,
            onMouseDownControlButton,
            onMouseUpControlButton,
            onMouseLeaveControlButton
        };
    }
});
</script>
