<template>
    <div class="ogr-toolbar">
        <suspense>
            <template #default>
                <component :is="name" @close="onCloseToolbar" />
            </template>
            <template #fallback>
                <div style="width: 5rem; height: 5rem;" v-loading="true" element-loading-background="transparent"></div>
            </template>
        </suspense>
    </div>
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent } from 'vue';
import ElLoading from 'element-plus/lib/el-loading';
import editorStore from '@/store/editor';

export default defineComponent({
    name: 'Toolbar',
    directives: {
        loading: ElLoading.directive
    },
    components: {
        'crop-resize': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-crop-resize' */ `./toolbar-crop-resize.vue`)),
        'free-transform': defineAsyncComponent(() => import(/* webpackChunkName: 'toolbar-free-transform' */ `./toolbar-free-transform.vue`))
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
