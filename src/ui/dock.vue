<template>
    <div class="ogr-dock">
        <suspense>
            <template #default>
                <component
                    :is="name"
                    :is-dialog="isDialog"
                    :dialog-opened="dialogOpened"
                    v-bind:="props"
                    @close="onCloseDock"
                    @update:dialogSize="onUpdateDialogSize"
                    @update:title="onUpdateTitle"
                />
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
        'color-picker': defineAsyncComponent(() => import(/* webpackChunkName: 'dock-color-picker' */ `./dock-color-picker.vue`)),
        'layers': defineAsyncComponent(() => import(/* webpackChunkName: 'dock-layers' */ `./dock-layers.vue`)),
        'settings': defineAsyncComponent(() => import(/* webpackChunkName: 'dock-settings' */ `./dock-settings.vue`))
    },
    emits: [
        'close',
        'update:dialogSize',
        'update:title'
    ],
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
    setup(props, { emit }) {

        function onCloseDock() {
            emit('close', ...arguments);
        }

        function onUpdateDialogSize() {
            emit('update:dialogSize', ...arguments);
        }

        function onUpdateTitle() {
            emit('update:title', ...arguments);
        }
        
        return {
            onCloseDock,
            onUpdateDialogSize,
            onUpdateTitle
        };
    }
});
</script>
