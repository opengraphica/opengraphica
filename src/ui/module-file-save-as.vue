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
        <el-alert
            type="info"
            title="If you wish to share or view the image in other programs, use &quot;Export&quot; instead."
            show-icon
            :closable="false"
            class="mb-4">
        </el-alert>
        <el-form-item-group>
            <el-form-item label="File Name" prop="fileName">
                <el-input v-model="formData.workingFile.fileName" clearable></el-input>
            </el-form-item>
        </el-form-item-group>
        <div class="has-text-right">
            <el-button @click="onCancel">Cancel</el-button>
            <el-button type="primary" native-type="submit">Save</el-button>
        </div>
    </el-form>
</template>

<script lang="ts">
import { defineComponent, ref, reactive, watch, nextTick } from 'vue';
import ElAlert from 'element-plus/lib/components/alert/index';
import ElButton from 'element-plus/lib/components/button/index';
import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElFormItemGroup from '@/ui/el-form-item-group.vue';
import ElInput from 'element-plus/lib/components/input/index';
import ElLoading from 'element-plus/lib/components/loading/index';
import workingFileStore from '@/store/working-file';
import { notifyInjector, unexpectedErrorMessage, validationSubmissionErrorMessage } from '@/lib/notify';
import { Rules, RuleItem } from 'async-validator';
import { saveImageAs } from '@/modules/file/save';
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
        ElInput
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
                fileName: workingFileStore.get('fileName')
            }
        });
        const formValidationRules: Rules = {};

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
                    workingFileStore.set('fileName', formData.workingFile.fileName.replace(knownFileExtensions, ''));
                    await saveImageAs({
                        fileName: formData.workingFile.fileName,
                    });
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
            formData,
            formValidationRules,
            onCancel,
            onSave
        };
    }
});
</script>
