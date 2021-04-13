<template>
    <div class="ogr-module">
        <suspense>
            <template #default>
                <component
                    :is="name"
                    @update:title="onSetTitle($event)"
                    @close="onCloseModule($event)"
                />
            </template>
            <template #fallback>
                <div style="width: 100%; height: 5rem;" v-loading="true" element-loading-background="transparent"></div>
            </template>
        </suspense>
    </div>
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent } from 'vue';
import ElLoading from 'element-plus/lib/el-loading';

export default defineComponent({
    name: 'Module',
    directives: {
        loading: ElLoading.directive
    },
    components: {
        'file-export': defineAsyncComponent(() => import(/* webpackChunkName: 'module-ui-file-export' */ `./module-file-export.vue`)),
        'file-new': defineAsyncComponent(() => import(/* webpackChunkName: 'module-ui-file-new' */ `./module-file-new.vue`)),
        'file-save-as': defineAsyncComponent(() => import(/* webpackChunkName: 'module-ui-file-save-as' */ `./module-file-save-as.vue`))
    },
    props: {
        name: {
            type: String,
            required: true
        }
    },
    emits: [
        'update:title',
        'close'
    ],
    setup(props, { emit }) {

        function onCloseModule() {
            emit('close', ...arguments);
        }

        function onSetTitle(title: string) {
            emit('update:title', title);
        }

        return {
            onCloseModule,
            onSetTitle
        }
    }
});
</script>
