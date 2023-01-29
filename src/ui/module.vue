<template>
    <div class="ogr-module">
        <suspense>
            <template #default>
                <component
                    :is="name"
                    :is-dialog="isDialog"
                    v-bind:="props"
                    @update:dialogSize="onSetDialogSize($event)"
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
import ElLoading from 'element-plus/lib/components/loading/index';

export default defineComponent({
    name: 'Module',
    directives: {
        loading: ElLoading.directive
    },
    components: {
        'file-export': defineAsyncComponent(() => import(/* webpackChunkName: 'module-ui-file-export' */ `./module-file-export.vue`)),
        'file-new': defineAsyncComponent(() => import(/* webpackChunkName: 'module-ui-file-new' */ `./module-file-new.vue`)),
        'file-save-as': defineAsyncComponent(() => import(/* webpackChunkName: 'module-ui-file-save-as' */ `./module-file-save-as.vue`)),
        'file-take-photo': defineAsyncComponent(() => import(/* webpackChunkName: 'module-ui-file-take-photo' */ `./module-file-take-photo.vue`)),
        'image-convert-layers-to-image-sequence': defineAsyncComponent(() => import(/* webpackChunkName: 'module-image-convert-layers-to-image-sequence' */ `./module-image-convert-layers-to-image-sequence.vue`)),
        'layer-effect-browser': defineAsyncComponent(() => import(/* webpackChunkName: 'module-layer-effect-browser' */ `./module-layer-effect-browser.vue`)),
        'layer-effect-edit': defineAsyncComponent(() => import(/* webpackChunkName: 'module-layer-effect-edit' */ `./module-layer-effect-edit.vue`)),
        'tutorial-welcome': defineAsyncComponent(() => import(/* webpackChunkName: 'module-ui-tutorial-welcome' */ `./module-tutorial-welcome.vue`))
    },
    props: {
        isDialog: {
            type: Boolean,
            default: false
        },
        name: {
            type: String,
            required: true
        },
        props: {
            type: Object
        }
    },
    emits: [
        'update:title',
        'update:dialogSize',
        'close'
    ],
    setup(props, { emit }) {

        function onCloseModule() {
            emit('close', ...arguments);
        }

        function onSetDialogSize(size: string) {
            emit('update:dialogSize', size);
        }

        function onSetTitle(title: string) {
            emit('update:title', title);
        }

        return {
            onCloseModule,
            onSetDialogSize,
            onSetTitle
        }
    }
});
</script>
