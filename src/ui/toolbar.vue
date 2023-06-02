<template>
    <div class="ogr-toolbar" :class="{ 'is-swap-in': animationSwap === 'in', 'is-swap-out': animationSwap === 'out' }" @animationend="onToolbarAnimationEnd">
        <suspense @resolve="onLoadToolbarResolve">
            <template #default>
                <component :is="'toolbar-' + currentName" @close="onCloseToolbar" />
            </template>
            <template #fallback>
                <div></div>
            </template>
        </suspense>
    </div>
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent, ref, toRef, watch, onMounted, nextTick } from 'vue';
import ElLoading from 'element-plus/lib/components/loading/index';
import editorStore from '@/store/editor';

export default defineComponent({
    name: 'Toolbar',
    directives: {
        loading: ElLoading.directive
    },
    components: {
        'toolbar-crop-resize': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-crop-resize' */ `./toolbar-crop-resize.vue`)),
        'toolbar-draw': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-draw' */ `./toolbar-draw.vue`)),
        'toolbar-free-transform': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-free-transform' */ `./toolbar-free-transform.vue`)),
        'toolbar-selection': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-selection' */ `./toolbar-selection.vue`)),
        'toolbar-text': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-text' */ `./toolbar-text.vue`)),
        'toolbar-zoom': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-zoom' */ `./toolbar-zoom.vue`))
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
        });

        onMounted(() => {
            currentName.value = props.name;
        });

        function onToolbarAnimationEnd() {
            if (animationSwap.value === 'out') {
                currentName.value = props.name;
            } else if (animationSwap.value === 'in') {
                animationSwap.value = '';
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
            currentName,
            animationSwap,
            onLoadToolbarResolve,
            onToolbarAnimationEnd,
            onCloseToolbar
        };
    }
});
</script>
