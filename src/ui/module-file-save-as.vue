<template>
    <el-form
        ref="form"
        v-loading="loading"
        action="javascript:void(0)"
        label-position="left"
        :model="formData.workingFile"
        :rules="formValidationRules"
        novalidate="novalidate"
        hide-required-asterisk
        @submit="onSave">
        <template v-if="canSaveBackDirectly">
            <el-alert
                type="info"
                :title="'You have opened a project file named ' + fileHandle.name + ''"
                show-icon
                :closable="false"
                class="mb-4">
            </el-alert>
            <el-form-item label="Save back to the original file?">
                <el-switch v-model="formData.workingFile.saveBackDirectly" active-text="Yes" inactive-text="No" />
            </el-form-item>
        </template>
        <template v-else>
            <el-alert
                type="info"
                title="If you wish to share or view the image in other programs, use &quot;Export&quot; instead."
                show-icon
                :closable="false"
                class="mb-4">
            </el-alert>
        </template>
        <transition name="scale-down">
            <el-form-item-group v-if="!formData.workingFile.saveBackDirectly">
                <el-form-item label="File Name" prop="fileName">
                    <el-input v-model="formData.workingFile.fileName" clearable></el-input>
                </el-form-item>
            </el-form-item-group>
        </transition>
        <div class="has-text-right">
            <el-button @click="onCancel">Cancel</el-button>
            <el-button type="primary" native-type="submit">Save</el-button>
        </div>
    </el-form>
</template>

<script lang="ts">
import { defineComponent, ref, reactive, computed, watch, nextTick } from 'vue';
import ElAlert from 'element-plus/lib/components/alert/index';
import ElButton from 'element-plus/lib/components/button/index';
import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElFormItemGroup from '@/ui/el-form-item-group.vue';
import ElInput from 'element-plus/lib/components/input/index';
import ElLoading from 'element-plus/lib/components/loading/index';
import ElSwitch from 'element-plus/lib/components/switch/index';
import workingFileStore from '@/store/working-file';
import { notifyInjector, unexpectedErrorMessage, validationSubmissionErrorMessage } from '@/lib/notify';
import { Rules, RuleItem } from 'async-validator';
import { saveImage, saveImageAs } from '@/modules/file/save';
import { knownFileExtensions } from '@/lib/regex';

export default defineComponent({
    name: 'ModuleFileSaveAs',
    directives: {
        loading: ElLoading.directive
    },
    components: {
        ElAlert,
        ElButton,
        ElForm,
        ElFormItem,
        ElFormItemGroup,
        ElInput,
        ElSwitch
    },
    emits: [
        'update:title',
        'close'
    ],
    setup(props, { emit }) {
        emit('update:title', 'Save Image As');

        const $notify = notifyInjector('$notify');
        const form = ref<typeof ElForm>();
        const loading = ref<boolean>(false);
       
        const formData = reactive({
            workingFile: {
                saveBackDirectly: ref<boolean>(false),
                fileName: workingFileStore.get('fileName')
            }
        });
        const formValidationRules: Rules = {};

        const fileHandle = workingFileStore.get('fileHandle');
        let canSaveBackDirectly: boolean = !!(fileHandle && fileHandle.name.endsWith('.json'));
        if (canSaveBackDirectly) {
            formData.workingFile.saveBackDirectly = true;
        }

        function onCancel() {
            emit('close');
        }

        async function onSave() {
            if (!form.value) {
                return;
            }
            try {
                await form.value.validate();
                loading.value = true;
                try {
                    if (formData.workingFile.saveBackDirectly && fileHandle) {
                        await saveImage(fileHandle);
                    } else {
                        workingFileStore.set('fileName', formData.workingFile.fileName.replace(knownFileExtensions, ''));
                        await saveImageAs({
                            fileName: formData.workingFile.fileName,
                        });
                    }
                } catch (error: any) {
                    $notify({
                        type: 'error',
                        dangerouslyUseHTMLString: true,
                        message: unexpectedErrorMessage
                    });
                }
                emit('close');
                loading.value = false;
            } catch (error: any) {
                $notify({
                    type: 'error',
                    dangerouslyUseHTMLString: true,
                    message: validationSubmissionErrorMessage
                });
            }
        }
        
        return {
            form,
            loading,
            canSaveBackDirectly,
            fileHandle,
            formData,
            formValidationRules,
            onCancel,
            onSave
        };
    }
});
</script>
