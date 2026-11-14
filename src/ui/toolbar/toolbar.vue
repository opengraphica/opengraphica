<template>
    <div class="og-toolbar" :class="{ 'is-swap-in': animationSwap === 'in', 'is-swap-out': animationSwap === 'out' }" @animationend="onToolbarAnimationEnd">
        <suspense @resolve="onLoadToolbarResolve">
            <template #default>
                <component v-if="!isAppPreloading" :is="components['toolbar-' + currentName]" @close="onCloseToolbar" />
            </template>
            <template #fallback>
                <div></div>
            </template>
        </suspense>
    </div>
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent, onErrorCaptured, onMounted, ref, toRef, watch } from 'vue';
import { checkWebUpdates } from '@/check-updates';
import { isAppPreloading } from '@/composables/app-preload-blocker';

import ElLoading from 'element-plus/lib/components/loading/index';

import editorStore from '@/store/editor';

import appEmitter from '@/lib/emitter';
import { camelCaseToKebabCase } from '@/lib/string';

const components = {
    'toolbar-clone-brush': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-clone-brush' */ `@/ui/toolbar/toolbar-clone-brush.vue`)),
    'toolbar-crop-resize': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-crop-resize' */ `@/ui/toolbar/toolbar-crop-resize.vue`)),
    'toolbar-deform-blur': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-deform-blur' */ `@/ui/toolbar/toolbar-deform-blur.vue`)),
    'toolbar-deform-sharpen': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-deform-sharpen' */ `@/ui/toolbar/toolbar-deform-sharpen.vue`)),
    'toolbar-draw-brush': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-draw-brush' */ `@/ui/toolbar/toolbar-draw-brush.vue`)),
    'toolbar-draw-bucket-fill': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-draw-bucket-fill' */ `@/ui/toolbar/toolbar-draw-bucket-fill.vue`)),
    'toolbar-draw-color-picker': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-draw-color-picker' */ `@/ui/toolbar/toolbar-draw-color-picker.vue`)),
    'toolbar-draw-gradient': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-draw-gradient' */ `@/ui/toolbar/toolbar-draw-gradient.vue`)),
    'toolbar-draw-shape': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-draw-shape' */ `@/ui/toolbar/toolbar-draw-shape.vue`)),
    'toolbar-effect': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-effect' */ `@/ui/toolbar/toolbar-effect.vue`)),
    'toolbar-erase-brush': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-erase-brush' */ `@/ui/toolbar/toolbar-erase-brush.vue`)),
    'toolbar-erase-bucket-fill': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-erase-bucket-fill' */ `@/ui/toolbar/toolbar-erase-bucket-fill.vue`)),
    'toolbar-free-transform': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-free-transform' */ `@/ui/toolbar/toolbar-free-transform.vue`)),
    'toolbar-layer-opacity': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-layer-opacity' */ `@/ui/toolbar/toolbar-layer-opacity.vue`)),
    'toolbar-selection': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-selection' */ `@/ui/toolbar/toolbar-selection.vue`)),
    'toolbar-text': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-text' */ `@/ui/toolbar/toolbar-text.vue`)),
    'toolbar-zoom': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-zoom' */ `@/ui/toolbar/toolbar-zoom.vue`)),
};

export default defineComponent({
    name: 'Toolbar',
    directives: {
        loading: ElLoading.directive
    },
    emits: [
    ],
    props: {
        name: {
            type: String,
            required: true
        }
    },
    setup(props, { emit }) {
        const animationSwap = ref<string>('');
        const currentName = ref<string>('');
        const isPluginToolbarLoaded = ref<boolean>(false);

        watch([toRef(props, 'name')], async ([name]) => {
            animationSwap.value = 'out';
            appEmitter.emit('editor.tool.toolbarSwapping');
        });

        watch(() => currentName.value, async () => {
            const pluginToolDefinition = editorStore.get('pluginTools').find((tool) => {
                return currentName.value == 'plugin-' + camelCaseToKebabCase(tool.group) + '-' + camelCaseToKebabCase(tool.name);
            });
            if (pluginToolDefinition) {
                if (!pluginToolDefinition.toolbar) {
                    isPluginToolbarLoaded.value = false;
                    try {
                        pluginToolDefinition.toolbar = await pluginToolDefinition.getToolbar();
                    } catch (error) {
                        console.warn('[src/ui/toolbar/toolbar.vue] Error retrieving tool plugin toolbar.', error);
                    }
                    isPluginToolbarLoaded.value = true;
                }
                if (pluginToolDefinition.toolbar) {
                    components['toolbar-' + currentName.value] = pluginToolDefinition.toolbar;
                }
            }
        });

        onMounted(() => {
            currentName.value = props.name;
        });

        onErrorCaptured((error) => {
            checkWebUpdates();
            console.error(error);
        });

        function onToolbarAnimationEnd() {
            if (animationSwap.value === 'out') {
                currentName.value = props.name;
            } else if (animationSwap.value === 'in') {
                animationSwap.value = '';
                appEmitter.emit('app.canvas.calculateDndArea');
            }
        }

        function onLoadToolbarResolve() {
            animationSwap.value = 'in';
        }

        function onCloseToolbar() {
            editorStore.dispatch('setActiveTool', {
                group: editorStore.get('activeToolGroupPrevious') || '',
                tool: editorStore.get('activeToolPrevious') || ''
            });
        }

        return {
            isAppPreloading,
            isPluginToolbarLoaded,
            currentName,
            components,
            animationSwap,
            onLoadToolbarResolve,
            onToolbarAnimationEnd,
            onCloseToolbar
        };
    }
});
</script>
