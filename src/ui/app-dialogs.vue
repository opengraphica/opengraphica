<template>
    <div class="ogr-dialogs">
        <template v-for="dialog of dialogs" :key="dialog.id">
            <el-dialog :title="dialog.title" :custom-class="'el-dialog--' + dialog.size" v-model="dialog.visible" destroy-on-close @closed="onDialogClosed(dialog)">
                <template v-if="dialog.type === 'module'">
                    <module :name="dialog.module.name" @dialog-title="dialog.title = $event" />
                </template>
            </el-dialog>
        </template>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, onUnmounted } from 'vue';
import Module from './module.vue';
import appEmitter, { AppEmitterEvents } from '@/lib/emitter';
import ElDialog from 'element-plus/lib/el-dialog';

interface DialogCommonDefinition {
    id: number;
    title: string;
    visible: boolean;
    size: 'small' | 'medium' | 'large' | 'big'
}

interface ModuleDialogDefinition extends DialogCommonDefinition {
    type: 'module',
    module: AppEmitterEvents['app.dialogs.openFromModule']
}

type DialogDefinition = ModuleDialogDefinition;

export default defineComponent({
    name: 'AppDialogs',
    components: {
        ElDialog,
        Module
    },
    setup() {
        let dialogIdCounter: number = 0;
        const dialogs = ref<DialogDefinition[]>([]);

        onMounted(() => {
            appEmitter.on('app.dialogs.openFromModule', handleModuleOpen);
        });

        onUnmounted(() => {
            appEmitter.off('app.dialogs.openFromModule', handleModuleOpen);
        });

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
