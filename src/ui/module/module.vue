<template>
    <div class="og-module">
        <suspense>
            <template #default>
                <component
                    :is="name"
                    :is-dialog="isDialog"
                    :dialog-opened="dialogOpened"
                    v-bind:="props"
                    @update:dialogSize="onSetDialogSize"
                    @update:title="onSetTitle"
                    @hide="onHideModule"
                    @show="onShowModule"
                    @close="onCloseModule"
                />
            </template>
            <template #fallback>
                <div style="width: 100%; height: 100%; min-height: 5rem;" v-loading="true" element-loading-background="transparent"></div>
            </template>
        </suspense>
    </div>
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent, onErrorCaptured } from 'vue';
import { checkUpdates } from '@/check-updates';
import ElLoading from 'element-plus/lib/components/loading/index';

export default defineComponent({
    name: 'Module',
    directives: {
        loading: ElLoading.directive
    },
    components: {
        'design-system': defineAsyncComponent(() => import(/* webpackChunkName: 'module-ui-design-system' */ `@/ui/module/module-design-system.vue`)),
        'file-export': defineAsyncComponent(() => import(/* webpackChunkName: 'module-ui-file-export' */ `@/ui/module/module-file-export.vue`)),
        'file-new': defineAsyncComponent(() => import(/* webpackChunkName: 'module-ui-file-new' */ `@/ui/module/module-file-new.vue`)),
        'file-open-confirm': defineAsyncComponent(() => import(/* webpackChunkName: 'module-ui-file-open-confirm' */ `@/ui/module/module-file-open-confirm.vue`)),
        'file-save-as': defineAsyncComponent(() => import(/* webpackChunkName: 'module-ui-file-save-as' */ `@/ui/module/module-file-save-as.vue`)),
        'file-take-photo': defineAsyncComponent(() => import(/* webpackChunkName: 'module-ui-file-take-photo' */ `@/ui/module/module-file-take-photo.vue`)),
        'image-convert-layers-to-collage': defineAsyncComponent(() => import(/* webpackChunkName: 'module-image-convert-layers-to-collage' */ `@/ui/module/module-image-convert-layers-to-collage.vue`)),
        'image-convert-layers-to-image-sequence': defineAsyncComponent(() => import(/* webpackChunkName: 'module-image-convert-layers-to-image-sequence' */ `@/ui/module/module-image-convert-layers-to-image-sequence.vue`)),
        'layer-blending-mode': defineAsyncComponent(() => import(/* webpackChunkName: 'module-layer-blending-mode' */ `@/ui/module/module-layer-blending-mode.vue`)),
        'layer-effect-browser': defineAsyncComponent(() => import(/* webpackChunkName: 'module-layer-effect-browser' */ `@/ui/module/module-layer-effect-browser.vue`)),
        'layer-effect-edit': defineAsyncComponent(() => import(/* webpackChunkName: 'module-layer-effect-edit' */ `@/ui/module/module-layer-effect-edit.vue`)),
        'rename-layer': defineAsyncComponent(() => import(/* webpackChunkName: 'module-rename-layer' */ `@/ui/module/module-rename-layer.vue`)),
        'tutorial-welcome': defineAsyncComponent(() => import(/* webpackChunkName: 'module-ui-tutorial-welcome' */ `@/ui/module/module-tutorial-welcome.vue`))
    },
    props: {
        isDialog: {
            type: Boolean,
            default: false
        },
        dialogOpened: {
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
        'hide',
        'show',
        'close'
    ],
    setup(props, { emit }) {

        onErrorCaptured((error) => {
            checkUpdates();
            console.error(error);
        });

        function onHideModule() {
            emit('hide');
        }

        function onShowModule() {
            emit('show');
        }

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
            onHideModule,
            onShowModule,
            onCloseModule,
            onSetDialogSize,
            onSetTitle
        }
    }
});
</script>
