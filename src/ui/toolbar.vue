<template>
    <div class="ogr-toolbar">
        <suspense>
            <template #default>
                <component :is="'toolbar-' + name" @close="onCloseToolbar" />
            </template>
            <template #fallback>
                <div></div>
            </template>
        </suspense>
    </div>
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent } from 'vue';
import ElLoading from 'element-plus/lib/components/loading/index';
import editorStore from '@/store/editor';

export default defineComponent({
    name: 'Toolbar',
    directives: {
        loading: ElLoading.directive
    },
    components: {
        'toolbar-crop-resize': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-crop-resize' */ `./toolbar-crop-resize.vue`)),
        'toolbar-selection': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-selection' */ `./toolbar-selection.vue`)),
        'toolbar-free-transform': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-free-transform' */ `./toolbar-free-transform.vue`)),
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

        function onCloseToolbar() {
            editorStore.dispatch('setActiveTool', {
                group: editorStore.get('activeToolGroupPrevious') || '',
                tool: editorStore.get('activeToolPrevious') || ''
            });
        }

        return {
            onCloseToolbar
        };
    }
});
</script>
