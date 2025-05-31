<template>
    <div class="og-toolbar" :class="{ 'is-swap-in': animationSwap === 'in', 'is-swap-out': animationSwap === 'out' }" @animationend="onToolbarAnimationEnd">
        <suspense @resolve="onLoadToolbarResolve">
            <template #default>
                <component v-if="!isAppPreloading" :is="'toolbar-' + currentName" @close="onCloseToolbar" />
            </template>
            <template #fallback>
                <div></div>
            </template>
        </suspense>
    </div>
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent, ref, toRef, watch, onMounted, nextTick } from 'vue';
import { isAppPreloading } from '@/composables/app-preload-blocker';
import ElLoading from 'element-plus/lib/components/loading/index';
import editorStore from '@/store/editor';
import appEmitter from '@/lib/emitter';

export default defineComponent({
    name: 'Toolbar',
    directives: {
        loading: ElLoading.directive
    },
    components: {
        'toolbar-crop-resize': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-crop-resize' */ `@/ui/toolbar/toolbar-crop-resize.vue`)),
        'toolbar-deform-blur': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-deform-blur' */ `@/ui/toolbar/toolbar-deform-blur.vue`)),
        'toolbar-draw-brush': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-draw-brush' */ `@/ui/toolbar/toolbar-draw-brush.vue`)),
        'toolbar-draw-color-picker': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-draw-color-picker' */ `@/ui/toolbar/toolbar-draw-color-picker.vue`)),
        'toolbar-draw-gradient': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-draw-gradient' */ `@/ui/toolbar/toolbar-draw-gradient.vue`)),
        'toolbar-effect': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-effect' */ `@/ui/toolbar/toolbar-effect.vue`)),
        'toolbar-erase-brush': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-erase-brush' */ `@/ui/toolbar/toolbar-erase-brush.vue`)),
        'toolbar-free-transform': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-free-transform' */ `@/ui/toolbar/toolbar-free-transform.vue`)),
        'toolbar-selection': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-selection' */ `@/ui/toolbar/toolbar-selection.vue`)),
        'toolbar-text': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-text' */ `@/ui/toolbar/toolbar-text.vue`)),
        'toolbar-zoom': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-zoom' */ `@/ui/toolbar/toolbar-zoom.vue`))
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

        watch([toRef(props, 'name')], async () => {
            animationSwap.value = 'out';
            appEmitter.emit('editor.tool.toolbarSwapping');
        });

        onMounted(() => {
            currentName.value = props.name;
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
            currentName,
            animationSwap,
            onLoadToolbarResolve,
            onToolbarAnimationEnd,
            onCloseToolbar
        };
    }
});
</script>
