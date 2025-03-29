<template>
    <div ref="drawerContainer" class="og-menu-drawers" :hidden="menuDrawers.length === 0" :class="{ 'is-fade-out': isAllDrawersClosing }" @animationend="onAnimationEndDrawers($event)" @click="onCloseAllDrawers($event)">
        <template v-for="menuDrawer of menuDrawers" :key="menuDrawer.id">
            <section :ref="el => { drawers[menuDrawer.id] = el }" class="og-menu-drawer" :class="['is-open-' + menuDrawer.placement, { 'is-closing': !menuDrawer.visible, 'is-immediate': menuDrawer.immediate }]">
                <h1 class="og-menu-drawer__title" v-t="menuDrawer.title || 'empty'" />
                <a href="javascript:void(0)" class="og-menu-drawer__close" title="Close" @click="onMenuDrawerClosed(menuDrawer)">
                    <span class="bi bi-x-circle-fill" aria-hidden="true" />
                </a>
                <div class="og-menu-drawer__content">
                    <template v-if="menuDrawer.type === 'dock'">
                        <dock :name="menuDrawer.dock.name" @update:title="menuDrawer.title = $event" @close="onMenuDrawerClosed(menuDrawer)" />
                    </template>
                    <template v-else-if="menuDrawer.type === 'module'">
                        <module :name="menuDrawer.module.name" @update:title="menuDrawer.title = $event" @close="onMenuDrawerClosed(menuDrawer)" />
                    </template>
                </div>
            </section>
        </template>
    </div>
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent, ref, onMounted, onUnmounted } from 'vue';
import Dock from '@/ui/dock/dock.vue';
import Module from '@/ui/module/module.vue';
import editorStore from '@/store/editor';
import ElLoading from 'element-plus/lib/components/loading/index';
import appEmitter, { AppEmitterEvents } from '@/lib/emitter';

interface MenuDrawerCommonDefinition {
    id: number;
    title: string;
    visible: boolean;
    placement: 'top' | 'bottom' | 'left' | 'right';
    size: 'small' | 'medium' | 'large' | 'big';
    immediate: boolean;
}

interface DockMenuDrawerDefinition extends MenuDrawerCommonDefinition {
    type: 'dock';
    dock: {
        name: string;
    }
}

interface ModuleMenuDrawerDefinition extends MenuDrawerCommonDefinition {
    type: 'module';
    module: {
        name: string;
    };
}

type MenuDrawerDefinition = DockMenuDrawerDefinition | ModuleMenuDrawerDefinition;

export default defineComponent({
    name: 'AppMenuDrawers',
    directives: {
        loading: ElLoading.directive
    },
    components: {
        Dock,
        ElScrollbar: defineAsyncComponent(() => import(`element-plus/lib/components/scrollbar/index`)),
        Module
    },
    setup() {
        const drawerContainerEl = ref<HTMLElement>();
        const drawerEls = ref<HTMLElement[]>([]);
        const isAllDrawersClosing = ref<boolean>(false);

        let dialogIdCounter: number = 0;
        const menuDrawers = ref<MenuDrawerDefinition[]>([]);

        onMounted(() => {
            appEmitter.on('app.menuDrawer.openFromDock', handleDockOpen);
            appEmitter.on('app.menuDrawer.openFromModule', handleModuleOpen);
            appEmitter.on('app.menuDrawer.closeAll', onCloseAllDrawers);
        });

        onUnmounted(() => {
            appEmitter.off('app.menuDrawer.openFromDock', handleDockOpen);
            appEmitter.off('app.menuDrawer.openFromModule', handleModuleOpen);
            appEmitter.off('app.menuDrawer.closeAll', onCloseAllDrawers);
        });

        function handleDockOpen(event?: AppEmitterEvents['app.menuDrawer.openFromDock']) {
            if (event) {
                const canOpen = editorStore.get('activeMenuDrawerComponentName') != event.name;
                onCloseAllDrawers();
                if (canOpen) {
                    isAllDrawersClosing.value = false;
                    menuDrawers.value.push({
                        type: 'dock',
                        id: dialogIdCounter++,
                        title: '',
                        visible: true,
                        placement: event.placement,
                        dock: {
                            name: event.name
                        },
                        size: 'medium',
                        immediate: !!event.immediate
                    });
                    editorStore.set('activeMenuDrawerComponentName', event.name);
                }
            }
        }

        function handleModuleOpen(event?: AppEmitterEvents['app.menuDrawer.openFromModule']) {
            if (event) {
                const canOpen = editorStore.get('activeMenuDrawerComponentName') != event.name;
                onCloseAllDrawers();
                if (canOpen) {
                    isAllDrawersClosing.value = false;
                    menuDrawers.value.push({
                        type: 'module',
                        id: dialogIdCounter++,
                        title: '',
                        visible: true,
                        placement: event.placement,
                        module: {
                            name: event.name
                        },
                        size: 'medium',
                        immediate: !!event.immediate
                    });
                    editorStore.set('activeMenuDrawerComponentName', event.name);
                }
            }
        }

        function onAnimationEndDrawers(event: Event) {
            if (event.target === drawerContainerEl.value && isAllDrawersClosing.value) {
                menuDrawers.value = [];
            }
            for (const id in drawerEls.value) {
                if (event.target === drawerEls.value[id]) {
                    const menuDrawerIndex = menuDrawers.value.map(menuDrawer => menuDrawer.id).indexOf(parseFloat(id));
                    if (menuDrawers.value[menuDrawerIndex].visible === false) {
                        menuDrawers.value.splice(menuDrawerIndex, 1);
                    }
                }
            }
        }

        function onMenuDrawerClosed(menuDrawer: MenuDrawerDefinition) {
            menuDrawer.visible = false;
            let isClosing = true;
            for (const drawer of menuDrawers.value) {
                if (drawer.visible) {
                    isClosing = false;
                    break;
                }
            }
            if (isClosing) {
                editorStore.set('activeMenuDrawerComponentName', null);
            }
            isAllDrawersClosing.value = isClosing;
        }

        function onCloseAllDrawers(event?: Event) {
            if (!event || event.target === drawerContainerEl.value) {
                for (const drawer of menuDrawers.value) {
                    if (drawer.visible) {
                        onMenuDrawerClosed(drawer);
                    }
                }
                editorStore.set('activeMenuDrawerComponentName', null);
            }
        }

        return {
            drawerContainer: drawerContainerEl,
            drawers: drawerEls,
            isAllDrawersClosing,
            menuDrawers,
            onAnimationEndDrawers,
            onMenuDrawerClosed,
            onCloseAllDrawers
        };
    }
});
</script>
