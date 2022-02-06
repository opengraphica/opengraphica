<template>
    <div class="ogr-dock">
        <suspense>
            <template #default>
                <component :is="name" @close="onCloseDock" @update:title="onUpdateTitle" />
            </template>
            <template #fallback>
                <div style="width: 5rem; height: 5rem; margin: auto;" v-loading="true" element-loading-background="transparent"></div>
            </template>
        </suspense>
    </div>
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent } from 'vue';
import ElLoading from 'element-plus/lib/components/loading/index';

export default defineComponent({
    name: 'Dock',
    directives: {
        loading: ElLoading.directive
    },
    components: {
        'layers': defineAsyncComponent(() => import(/* webpackChunkName: 'dock-layers' */ `./dock-layers.vue`)),
        'settings': defineAsyncComponent(() => import(/* webpackChunkName: 'dock-settings' */ `./dock-settings.vue`))
    },
    emits: [
        'close',
        'update:title'
    ],
    props: {
        name: {
            type: String,
            required: true
        }
    },
    setup(props, { emit }) {

        function onCloseDock() {
            emit('close', ...arguments);
        }

        function onUpdateTitle() {
            emit('update:title', ...arguments);
        }
        
        return {
            onCloseDock,
            onUpdateTitle
        };
    }
});
</script>
