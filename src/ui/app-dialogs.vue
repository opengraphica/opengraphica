<template>
    <div class="ogr-dialogs">
        <template v-for="dialog of dialogs" :key="dialog.id">
            <suspense>
                <template #default>
                    <el-dialog :title="dialog.title" :custom-class="'el-dialog--' + dialog.size + ' el-dialog--ogr-' + dialog.type" v-model="dialog.visible" destroy-on-close @closed="onDialogClosed(dialog)">
                        <template v-if="dialog.type === 'dock'">
                            <dock :name="dialog.dock.name" @update:title="dialog.title = $event" @close="dialog.visible = false" />
                        </template>
                        <template v-else-if="dialog.type === 'module'">
                            <module :name="dialog.module.name" @update:title="dialog.title = $event" @close="dialog.visible = false" />
                        </template>
                    </el-dialog>
                </template>
                <template #fallback>
                    <div class="is-position-absolute-full" v-loading="true"></div>
                </template>
            </suspense>
        </template>
    </div>
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent, ref, onMounted, onUnmounted } from 'vue';
import Dock from './dock.vue';
import Module from './module.vue';
import ElLoading from 'element-plus/lib/el-loading';
import appEmitter, { AppEmitterEvents } from '@/lib/emitter';

interface DialogCommonDefinition {
    id: number;
    title: string;
    visible: boolean;
    size: 'small' | 'medium' | 'large' | 'big';
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
        ElDialog: defineAsyncComponent(() => import(`element-plus/lib/el-dialog`)),
        Module
    },
    setup() {
        let dialogIdCounter: number = 0;
        const dialogs = ref<DialogDefinition[]>([]);

        onMounted(() => {
            appEmitter.on('app.dialogs.openFromDock', handleDockOpen);
            appEmitter.on('app.dialogs.openFromModule', handleModuleOpen);
        });

        onUnmounted(() => {
            appEmitter.off('app.dialogs.openFromDock', handleDockOpen);
            appEmitter.off('app.dialogs.openFromModule', handleModuleOpen);
        });

        function handleDockOpen(event?: AppEmitterEvents['app.dialogs.openFromDock']) {
            if (event) {
                dialogs.value.push({
                    type: 'dock',
                    id: dialogIdCounter++,
                    title: '',
                    visible: true,
                    dock: event,
                    size: 'medium'
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
                    module: event,
                    size: 'medium'
                });
            }
        }

        function onDialogClosed(dialog: DialogDefinition) {
            dialogs.value.splice(dialogs.value.indexOf(dialog), 1);
        }

        return {
            dialogs,
            onDialogClosed
        };
    }
});
</script>
