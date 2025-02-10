<template>
    <div class="ogr-dock" :class="{ 'ogr-dock--loading': loading }">
        <div v-if="loading" class="ogr-dock__spinner">
            <div style="width: 5rem; height: 5rem; margin: auto;" v-loading="true" element-loading-background="transparent"></div>
        </div>
        <suspense
            @pending="componentSuspsenseUpdate('pending')"
            @resolve="componentSuspsenseUpdate('resolve')"
            @fallback="componentSuspsenseUpdate('fallback')"
        >
            <template #default>
                <component
                    :is="name"
                    :key="name + '_' + languageOverride"
                    :is-dialog="isDialog"
                    :dialog-opened="dialogOpened"
                    v-bind:="props"
                    @hide="onHideDock"
                    @show="onShowDock"
                    @close="onCloseDock"
                    @update:dialogSize="onUpdateDialogSize"
                    @update:title="onUpdateTitle"
                    @update:loading="onUpdateLoading"
                />
            </template>
        </suspense>
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, defineAsyncComponent, ref, watch } from 'vue';
import preferencesStore from '@/store/preferences'
import ElLoading from 'element-plus/lib/components/loading/index';

export default defineComponent({
    name: 'Dock',
    directives: {
        loading: ElLoading.directive
    },
    components: {
        'color-picker': defineAsyncComponent(() => import(/* webpackChunkName: 'dock-color-picker' */ `./dock-color-picker.vue`)),
        'gradient-editor': defineAsyncComponent(() => import(/* webpackChunkName: 'dock-gradient-editor' */ `./dock-gradient-editor.vue`)),
        'layers': defineAsyncComponent(() => import(/* webpackChunkName: 'dock-layers' */ `./dock-layers.vue`)),
        'settings': defineAsyncComponent(() => import(/* webpackChunkName: 'dock-settings' */ `./dock-settings.vue`))
    },
    emits: [
        'hide',
        'show',
        'close',
        'update:dialogSize',
        'update:title',
        'update:loading',
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
        emit('update:loading', true);

        const loading = computed(() => {
            return (
                componentLoadingState.value === 'pending' ||
                componentLoadingState.value === 'fallback' ||
                componentContentLoading.value
            );
        });
        const componentContentLoading = ref(false);
        const componentLoadingState = ref('pending');

        watch(() => loading.value, (loading) => {
            emit('update:loading', loading);
        }, { immediate: true });

        const languageOverride = computed(() => preferencesStore.state.languageOverride);

        function onHideDock() {
            emit('hide');
        }

        function onShowDock() {
            emit('show');
        }

        function onCloseDock() {
            emit('close', ...arguments);
        }

        function onUpdateDialogSize() {
            emit('update:dialogSize', ...arguments);
        }

        function onUpdateTitle() {
            emit('update:title', ...arguments);
        }

        function onUpdateLoading(value: boolean) {
            componentContentLoading.value = value;
        }

        function componentSuspsenseUpdate(loadingState: string) {
            componentLoadingState.value = loadingState;
        }
        
        return {
            loading,
            languageOverride,

            componentLoadingState,
            componentSuspsenseUpdate,

            onHideDock,
            onShowDock,
            onCloseDock,
            onUpdateDialogSize,
            onUpdateTitle,
            onUpdateLoading
        };
    }
});
</script>
