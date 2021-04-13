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
        @submit="onCreate">
        <el-form-item-group>
            <el-form-item label="File Name" prop="fileName">
                <el-input v-model="formData.workingFile.fileName" clearable></el-input>
            </el-form-item>
            <el-form-item label="File Type" prop="fileType" >
                <el-select v-model="formData.workingFile.fileType" :popper-append-to-body="false">
                    <el-option
                        v-for="option in fileTypeOptions"
                        :key="option.value"
                        :label="option.label"
                        :value="option.value">
                    </el-option>
                </el-select>
            </el-form-item>
            <el-form-item label="Layers" prop="layerSelection" >
                <el-select v-model="formData.workingFile.layerSelection" :popper-append-to-body="false">
                    <el-option
                        v-for="option in layerSelectionOptions"
                        :key="option.value"
                        :label="option.label"
                        :value="option.value">
                    </el-option>
                </el-select>
            </el-form-item>
            <transition name="scale-down">
                <el-form-item v-if="fileQualityTypes.includes(formData.workingFile.fileType)" label="Quality" prop="quality">
                    <el-row>
                        <el-col :span="14">
                            <el-slider v-model="formData.workingFile.quality" :show-tooltip="false"></el-slider>
                        </el-col>
                        <el-col :span="10">
                            <el-input-number v-model="formData.workingFile.quality" :min="0" :max="100" :precision="0" class="el-input--text-right">
                                <template v-slot:append>%</template>
                            </el-input-number>
                        </el-col>
                    </el-row>                    
                </el-form-item>
            </transition>
        </el-form-item-group>
        <div class="has-text-right">
            <el-button @click="onCancel">Cancel</el-button>
            <el-button type="primary" native-type="submit">Export</el-button>
        </div>
    </el-form>
</template>

<script lang="ts">
import { defineComponent, ref, reactive, watch, nextTick } from 'vue';
import defaultNewFilePresetsJson from '@/config/default-new-file-presets.json';
import ElButton from 'element-plus/lib/el-button';
import ElCol from 'element-plus/lib/el-col';
import ElForm from 'element-plus/lib/el-form';
import ElFormItem from 'element-plus/lib/el-form-item';
import ElFormItemGroup from '@/ui/el-form-item-group.vue';
import ElInput from 'element-plus/lib/el-input';
import ElInputNumber from '@/ui/el-input-number.vue';
import ElLoading from 'element-plus/lib/el-loading';
import ElOption from 'element-plus/lib/el-option';
import ElRow from 'element-plus/lib/el-row';
import ElSelect from 'element-plus/lib/el-select';
import ElSlider from 'element-plus/lib/el-slider';
import workingFileStore from '@/store/working-file';
import { notifyInjector, unexpectedErrorMessage, validationSubmissionErrorMessage } from '@/lib/notify';
import { NewFilePreset } from '@/types';
import { Rules, RuleItem } from 'async-validator';
import { exportAsImage, isfileFormatSupported } from '@/modules/file/export';

const defaultNewFilePresets: NewFilePreset[] = defaultNewFilePresetsJson as any;

export default defineComponent({
    name: 'ModuleFileExport',
    directives: {
        loading: ElLoading.directive
    },
    components: {
        ElButton,
        ElCol,
        ElForm,
        ElFormItem,
        ElFormItemGroup,
        ElInput,
        ElInputNumber,
        ElOption,
        ElRow,
        ElSelect,
        ElSlider
    },
    emits: [
        'update:title',
        'close'
    ],
    setup(props, { emit }) {
        emit('update:title', 'Export Image');

        const $notify = notifyInjector('$notify');
        const form = ref<typeof ElForm>();
        const loading = ref<boolean>(false);
       
        const layerSelectionOptions = [
            { value: 'all', label: 'All' },
            { value: 'selected', label: 'Selected' },
        ];
        const fileTypeOptions = [
            { value: 'png', label: 'PNG' },
            { value: 'jpg', label: 'JPG' },
            { value: 'webp', label: 'WEBP' },
            { value: 'gif', label: 'GIF' },
            { value: 'bmp', label: 'BMP' },
            { value: 'tiff', label: 'TIFF' }
        ].filter((option) => {
            return isfileFormatSupported(option.value);
        });
        const fileQualityTypes = ['jpg', 'webp'];
        
        const formData = reactive({
            workingFile: {
                fileName: workingFileStore.get('fileName'),
                fileType: 'png' as 'png' | 'jpg' | 'webp' | 'gif' | 'bmp' | 'tiff',
                layerSelection: 'all' as 'all' | 'selected',
                quality: 100
            }
        });
        const formValidationRules: Rules = {};

        function onCancel() {
            emit('close');
        }

        async function onCreate() {
            if (!form.value) {
                return;
            }
            try {
                await form.value.validate();
                loading.value = true;
                try {
                    workingFileStore.set('fileName', formData.workingFile.fileName);
                    await exportAsImage({
                        fileName: formData.workingFile.fileName,
                        fileType: formData.workingFile.fileType,
                        layerSelection: formData.workingFile.layerSelection,
                        quality: formData.workingFile.quality / 100
                    });
                } catch (error) {
                    $notify({
                        type: 'error',
                        dangerouslyUseHTMLString: true,
                        message: unexpectedErrorMessage
                    });
                }
                emit('close');
                loading.value = false;
            } catch (error) {
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
            layerSelectionOptions,
            fileTypeOptions,
            fileQualityTypes,
            formData,
            formValidationRules,
            onCancel,
            onCreate
        };
    }
});
</script>
