<template>
    <el-form
        ref="form"
        v-loading="loading"
        action="javascript:void(0)"
        label-position="left"
        :model="formData"
        :rules="formValidationRules"
        novalidate="novalidate"
        hide-required-asterisk
        @submit="onSave">
        <el-form-item-group>
            <el-form-item :label="$t('module.imageConvertLayersToImageSequence.frameDelay')" prop="frameDelay">
                <el-input-number v-model="formData.frameDelay" :min="0.001" suffix-text="ms"></el-input-number>
            </el-form-item>
        </el-form-item-group>
        <div class="text-right">
            <el-button @click="onCancel">{{ $t('button.cancel') }}</el-button>
            <el-button type="primary" native-type="submit">{{ $t('button.convert') }}</el-button>
        </div>
    </el-form>
</template>

<script lang="ts">
import { defineComponent, ref, reactive, watch, nextTick } from 'vue';
import ElButton from 'element-plus/lib/components/button/index';
import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElFormItemGroup from '@/ui/el/el-form-item-group.vue';
import ElInputNumber from '@/ui/el/el-input-number.vue';
import ElLoading from 'element-plus/lib/components/loading/index';
import workingFileStore from '@/store/working-file';
import { notifyInjector, unexpectedErrorMessage, validationSubmissionErrorMessage } from '@/lib/notify';
import { Rules, RuleItem } from 'async-validator';
import { convertLayersToImageSequence } from '@/modules/image/conversion';
import { knownFileExtensions } from '@/lib/regex';

export default defineComponent({
    name: 'ModuleImageConvertLayersToImageSequence',
    inheritAttrs: false,
    directives: {
        loading: ElLoading.directive
    },
    components: {
        ElButton,
        ElForm,
        ElFormItem,
        ElFormItemGroup,
        ElInputNumber
    },
    emits: [
        'update:title',
        'close'
    ],
    setup(props, { emit }) {
        emit('update:title', 'module.imageConvertLayersToImageSequence.title');

        const $notify = notifyInjector('$notify');
        const form = ref<typeof ElForm>();
        const loading = ref<boolean>(false);
       
        const formData = reactive({
            frameDelay: 20
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
                    await convertLayersToImageSequence({
                        frameDelay: formData.frameDelay,
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
