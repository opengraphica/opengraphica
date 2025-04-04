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
        <template v-if="canSaveBackDirectly">
            <el-alert
                type="info"
                :title="$t('module.fileExport.saveBackIntroduction', { fileName: fileHandle.name })"
                show-icon
                :closable="false"
                class="mb-4">
            </el-alert>
            <el-form-item :label="$t('module.fileExport.saveBackQuestion')">
                <el-switch v-model="formData.workingFile.saveBackDirectly" :active-text="$t('button.yes')" :inactive-text="$t('button.no')" />
            </el-form-item>
        </template>
        <el-form-item-group>
            <transition name="og-transition-scale-down">
                <el-form-item v-if="!formData.workingFile.saveBackDirectly" :label="$t('module.fileExport.fileName')" prop="fileName">
                    <el-input v-model="formData.workingFile.fileName" clearable></el-input>
                </el-form-item>
            </transition>
            <transition name="og-transition-scale-down">
                <el-form-item v-if="!formData.workingFile.saveBackDirectly" :label="$t('module.fileExport.fileType')" prop="fileType" >
                    <el-select v-model="formData.workingFile.fileType">
                        <el-option
                            v-for="option in fileTypeOptions"
                            :key="option.value"
                            :label="option.label"
                            :value="option.value">
                        </el-option>
                    </el-select>
                </el-form-item>
            </transition>
            <el-form-item :label="$t('module.fileExport.layers')" prop="layerSelection" >
                <el-select v-model="formData.workingFile.layerSelection">
                    <el-option
                        v-for="option in layerSelectionOptions"
                        :key="option.value"
                        :label="option.label"
                        :value="option.value">
                    </el-option>
                </el-select>
            </el-form-item>
            <transition name="og-transition-scale-down">
                <el-form-item v-if="showQualitySetting" :label="$t('module.fileExport.quality')" prop="quality">
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
            <transition name="og-transition-scale-down">
                <el-form-item v-if="showDitheringSetting" :label="$t('module.fileExport.dithering')" prop="dithering">
                    <el-select v-model="formData.workingFile.dithering">
                        <el-option
                            v-for="option in ditheringOptions"
                            :key="option.value"
                            :label="$t(option.label)"
                            :value="option.value">
                        </el-option>
                    </el-select>
                </el-form-item>
            </transition>
        </el-form-item-group>
        <div class="text-right">
            <el-button @click="onCancel">{{ $t('button.cancel') }}</el-button>
            <el-button type="primary" native-type="submit">{{ $t('button.export') }}</el-button>
        </div>
    </el-form>
</template>

<script lang="ts">
import { defineComponent, ref, reactive, computed, watch, nextTick } from 'vue';
import ElAlert from 'element-plus/lib/components/alert/index';
import ElButton from 'element-plus/lib/components/button/index';
import ElCol from 'element-plus/lib/components/col/index';
import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElFormItemGroup from '@/ui/el/el-form-item-group.vue';
import ElInput from 'element-plus/lib/components/input/index';
import ElInputNumber from '@/ui/el/el-input-number.vue';
import ElLoading from 'element-plus/lib/components/loading/index';
import ElRow from 'element-plus/lib/components/row/index';
import ElSelect, { ElOption } from 'element-plus/lib/components/select/index';
import ElSlider from 'element-plus/lib/components/slider/index';
import ElSwitch from 'element-plus/lib/components/switch/index';
import workingFileStore from '@/store/working-file';
import { notifyInjector, unexpectedErrorMessage, validationSubmissionErrorMessage } from '@/lib/notify';
import { Rules, RuleItem } from 'async-validator';
import { exportAsImage, ExportAsImageOptions, isfileFormatSupported } from '@/modules/file/export';
import { knownFileExtensions } from '@/lib/regex';

export default defineComponent({
    name: 'ModuleFileExport',
    inheritAttrs: false,
    directives: {
        loading: ElLoading.directive
    },
    components: {
        ElAlert,
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
        ElSlider,
        ElSwitch
    },
    emits: [
        'update:title',
        'close'
    ],
    setup(props, { emit }) {
        emit('update:title', 'module.fileExport.title');

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
        const ditheringOptions = [
            { value: '', label: 'module.fileExport.ditheringOption.none' },
            { value: 'Atkinson', label: 'module.fileExport.ditheringOption.atkinson' },
            { value: 'Atkinson-serpentine', label: 'module.fileExport.ditheringOption.atkinsonSerpentine' },
            { value: 'FloydSteinberg', label: 'module.fileExport.ditheringOption.floydSteinberg' },
            { value: 'FloydSteinberg-serpentine', label: 'module.fileExport.ditheringOption.floydSteinbergSerpentine' },
            { value: 'FalseFloydSteinberg', label: 'module.fileExport.ditheringOption.falseFloydSteinberg' },
            { value: 'FalseFloydSteinberg-serpentine', label: 'module.fileExport.ditheringOption.falseFloydSteinbergSerpentine' },
            { value: 'Stucki', label: 'module.fileExport.ditheringOption.stucki' },
            { value: 'Stucki-serpentine', label: 'module.fileExport.ditheringOption.stuckiSerpentine' },
        ];

        const showQualitySetting = computed<boolean>(() => {
            return ['jpg', 'gif', 'webp'].includes(formData.workingFile.fileType);
        });

        const showDitheringSetting = computed<boolean>(() => {
            return ['gif'].includes(formData.workingFile.fileType);
        });
        
        const formData = reactive({
            workingFile: {
                saveBackDirectly: false,
                fileName: workingFileStore.get('fileName'),
                fileType: 'png' as 'png' | 'jpg' | 'webp' | 'gif' | 'bmp' | 'tiff',
                layerSelection: 'all' as 'all' | 'selected',
                quality: 100,
                dithering: ''
            }
        });
        const formValidationRules: Rules = {};

        const fileHandle = workingFileStore.get('fileHandle');
        let canSaveBackDirectly: boolean = false;
        if (fileHandle) {
            for (const fileTypeOption of fileTypeOptions) {
                if (fileHandle.name.endsWith(fileTypeOption.value)) {
                    canSaveBackDirectly = true;
                    formData.workingFile.fileType = fileTypeOption.value as any;
                    formData.workingFile.saveBackDirectly = true;
                    break;
                }
            }
        }

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
                    const exportOptions: ExportAsImageOptions = {
                        fileType: formData.workingFile.fileType,
                        layerSelection: formData.workingFile.layerSelection,
                        quality: formData.workingFile.quality / 100,
                        dithering: formData.workingFile.dithering
                    };
                    if (formData.workingFile.saveBackDirectly) {
                        exportOptions.toFileHandle = fileHandle;
                    } else {
                        workingFileStore.set('fileName', formData.workingFile.fileName.replace(knownFileExtensions, ''));
                        exportOptions.fileName = formData.workingFile.fileName;
                    }
                    await exportAsImage(exportOptions);
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
            layerSelectionOptions,
            fileTypeOptions,
            ditheringOptions,
            showQualitySetting,
            showDitheringSetting,
            formData,
            formValidationRules,
            onCancel,
            onCreate
        };
    }
});
</script>
