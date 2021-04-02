<template>
    <div class="ogr-dock">
        <suspense>
            <template #default>
                <component :is="name" @close-popover="onClosePopover" />
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

export default defineComponent({
    name: 'Dock',
    directives: {
        loading: ElLoading.directive
    },
    components: {
        'settings': defineAsyncComponent(() => import(/* webpackChunkName: 'dock-settings' */ `./dock-settings.vue`))
    },
    emits: [
        'close-popover'
    ],
    props: {
        name: {
            type: String,
            required: true
        }
    },
    setup(props, { emit }) {

        function onClosePopover() {
            emit('close-popover', ...arguments);
        }
        
        return {
            onClosePopover
        };
    }
});
</script>
