<template>
    <div class="og-dialogs" :hidden="isAllDialogsHidden" :class="{ 'og-dialogs--loading': loading }">
        <template v-for="dialog of dialogs" :key="dialog.id">
            <suspense>
                <template #default>
                    <el-dialog
                        :title="$t(dialog.title || 'empty')"
                        :class="[
                            'el-dialog--' + dialog.size,
                            'el-dialog--og-' + dialog.type,
                        ]"
                        v-model="dialog.visible"
                        :destroy-on-close="!dialog.temporarilyHidden"
                        @closed="onDialogClosed(dialog)"
                        @opened="dialog.opened = true"
                    >
                        <template v-if="dialog.type === 'dock'">
                            <dock
                                :name="dialog.dock.name"
                                :is-dialog="true"
                                :dialog-opened="dialog.opened"
                                :props="dialog.props"
                                @update:title="dialog.title = $event"
                                @update:dialogSize="dialog.size = $event"
                                @update:loading="loading = $event"
                                @hide="onHideDialog(dialog, $event)"
                                @show="onShowDialog(dialog, $event)"
                                @close="onCloseDialog(dialog, $event)"
                            />
                        </template>
                        <template v-else-if="dialog.type === 'module'">
                            <module
                                :name="dialog.module.name"
                                :is-dialog="true"
                                :dialog-opened="dialog.opened"
                                :props="dialog.props"
                                @update:title="dialog.title = $event"
                                @update:dialogSize="dialog.size = $event"
                                @hide="onHideDialog(dialog, $event)"
                                @show="onShowDialog(dialog, $event)"
                                @close="onCloseDialog(dialog, $event)"
                            />
                        </template>
                    </el-dialog>
                </template>
                <template #fallback>
                    <div class="absolute top-0 right-0 left-0 bottom-0" v-loading="true"></div>
                </template>
            </suspense>
        </template>
    </div>
</template>

<script lang="ts">
import { computed, defineComponent, defineAsyncComponent, ref, onErrorCaptured, onMounted, onUnmounted } from 'vue';
import { checkUpdates } from '@/check-updates';
import Dock from '@/ui/dock/dock.vue';
import Module from '@/ui/module/module.vue';
import editorStore from '@/store/editor';
import ElLoading from 'element-plus/lib/components/loading/index';
import appEmitter, { AppEmitterEvents } from '@/lib/emitter';

interface DialogCommonDefinition {
    id: number;
    title: string;
    visible: boolean;
    opened: boolean;
    temporarilyHidden: boolean;
    size: 'small' | 'medium' | 'large' | 'big';
    props?: any;
    onClose?: (event: any) => void;
    closeEventData?: any;
}

interface DockDialogDefinition extends DialogCommonDefinition {
    type: 'dock';
    dock: AppEmitterEvents['app.dialogs.openFromDock']
}

interface ModuleDialogDefinition extends DialogCommonDefinition {
    type: 'module';
    module: AppEmitterEvents['app.dialogs.openFromModule'];
}

type DialogDefinition = DockDialogDefinition | ModuleDialogDefinition;

export default defineComponent({
    name: 'AppDialogs',
    directives: {
        loading: ElLoading.directive
    },
    components: {
        Dock,
        ElDialog: defineAsyncComponent(() => import(`element-plus/lib/components/dialog/index`)),
        Module
    },
    setup() {
        let dialogIdCounter: number = 0;
        const dialogs = ref<DialogDefinition[]>([]);
        const loading = ref(false);

        const isAllDialogsHidden = computed(() => {
            return editorStore.state.isToolHidingDialogs;
        });

        onMounted(() => {
            appEmitter.on('app.dialogs.openFromDock', handleDockOpen);
            appEmitter.on('app.dialogs.openFromModule', handleModuleOpen);
        });

        onUnmounted(() => {
            appEmitter.off('app.dialogs.openFromDock', handleDockOpen);
            appEmitter.off('app.dialogs.openFromModule', handleModuleOpen);
        });

        onErrorCaptured((error) => {
            checkUpdates();
            console.error(error);
        });

        function handleDockOpen(event?: AppEmitterEvents['app.dialogs.openFromDock']) {
            loading.value = true;
            if (event) {
                dialogs.value.push({
                    type: 'dock',
                    id: dialogIdCounter++,
                    title: '',
                    visible: true,
                    opened: false,
                    temporarilyHidden: false,
                    dock: event,
                    size: 'medium',
                    props: event.props,
                    onClose: event.onClose
                });
            }
        }

        function handleModuleOpen(event?: AppEmitterEvents['app.dialogs.openFromModule']) {
            if (event) {
                dialogs.value.push({
                    type: 'module',
                    id: dialogIdCounter++,
                    title: '',
                    visible: true,
                    opened: false,
                    temporarilyHidden: false,
                    module: event,
                    size: 'medium',
                    props: event.props,
                    onClose: event.onClose
                });
            }
        }

        function onHideDialog(dialog: DialogDefinition, event?: any) {
            dialog.temporarilyHidden = true;
            dialog.visible = false;
        }

        function onShowDialog(dialog: DialogDefinition, event?: any) {
            dialog.temporarilyHidden = false;
            dialog.visible = true;
        }

        function onCloseDialog(dialog: DialogDefinition, event?: any) {
            loading.value = false;
            dialog.visible = false;
            let disableCloseTransition = false;
            if (event?.disableCloseTransition) {
                disableCloseTransition = event.disableCloseTransition;
                delete event.disableCloseTransition;
            }
            dialog.closeEventData = event;
            if ((disableCloseTransition || dialog.closeEventData) && dialog.onClose) {
                dialog.onClose(dialog.closeEventData);
            }
            if (disableCloseTransition) {
                dialogs.value.splice(dialogs.value.indexOf(dialog), 1);
            }
        }

        function onDialogClosed(dialog: DialogDefinition) {
            if (dialog.temporarilyHidden) return;
            if (!dialog.closeEventData && dialog.onClose) {
                dialog.onClose(dialog.closeEventData);
            }
            dialogs.value.splice(dialogs.value.indexOf(dialog), 1);
        }

        return {
            loading,
            isAllDialogsHidden,
            dialogs,
            onHideDialog,
            onShowDialog,
            onCloseDialog,
            onDialogClosed
        };
    }
});
</script>
