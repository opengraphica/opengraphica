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
        <el-form-item-aligned-groups>
            <el-form-item-group>
                <el-form-item :label="$t('module.fileNew.preset')">
                    <el-select
                        v-model="selectedPreset"
                        :placeholder="$t('module.fileNew.presetPlaceholder')"
                        clearable filterable
                        @change="onChangeSelectedPreset">
                        <el-option
                            v-for="option in presetOptions"
                            :key="option.value"
                            :label="option.label"
                            :value="option.value">
                        </el-option>
                    </el-select>
                </el-form-item>
            </el-form-item-group>
            <el-form-item-group>
                <el-form-item :label="$t('module.fileNew.width')" prop="width">
                    <el-input-number :min="0" v-model="formData.workingFile.width" @input="onInputAny">
                        <template #append>
                            <el-select style="width: 6rem" v-model="formData.workingFile.measuringUnits" @change="onInputAny">
                                <el-option
                                    v-for="option in dimensionUnitOptions"
                                    :key="option.value"
                                    :label="option.value"
                                    :value="option.value">
                                    {{ $t(option.label) }}
                                </el-option>
                            </el-select>
                        </template>
                    </el-input-number>
                </el-form-item>
                <el-form-item :label="$t('module.fileNew.height')" prop="height">
                    <el-input-number :min="0" v-model="formData.workingFile.height" @input="onInputAny">
                        <template #append>
                            <el-select style="width: 6rem" v-model="formData.workingFile.measuringUnits" @change="onInputAny">
                                <el-option
                                    v-for="option in dimensionUnitOptions"
                                    :key="option.value"
                                    :label="option.value"
                                    :value="option.value">
                                    {{ $t(option.label) }}
                                </el-option>
                            </el-select>
                        </template>
                    </el-input-number>
                </el-form-item>
                <el-form-item :label="$t('module.fileNew.resolution')" prop="resolution">
                    <el-input-number v-model.lazy="formData.workingFile.resolution" :min="1" :precision="0" @input="onInputAny">
                        <template #append>
                            <el-select style="width: 6rem" v-model="formData.workingFile.resolutionUnits" @change="onInputAny">
                                <el-option
                                    v-for="option in resolutionUnitOptions"
                                    :key="option.value"
                                    :label="option.value"
                                    :value="option.value">
                                    {{ $t(option.label) }}
                                </el-option>
                            </el-select>
                        </template>
                    </el-input-number>
                </el-form-item>
                <el-form-item :label="$t('module.fileNew.colorProfile')" prop="colorProfile" >
                    <el-select v-model="formData.workingFile.colorProfile" @change="onInputAny">
                        <el-option
                            v-for="option in colorProfileOptions"
                            :key="option"
                            :label="option"
                            :value="option">
                        </el-option>
                    </el-select>
                </el-form-item>
                <el-form-item :label="$t('module.fileNew.scaleFactor')" prop="scaleFactor">
                    <el-input-number v-model="formData.workingFile.scaleFactor" :min="1" :precision="0"></el-input-number>
                </el-form-item>
            </el-form-item-group>
        </el-form-item-aligned-groups>
        <div class="has-text-right">
            <el-button @click="onCancel">{{ $t('button.cancel') }}</el-button>
            <el-button type="primary" native-type="submit">{{ $t('button.create') }}</el-button>
        </div>
    </el-form>
</template>

<script lang="ts">
import { defineComponent, ref, reactive, watch, nextTick } from 'vue';
import defaultNewFilePresetsJson from '@/config/default-new-file-presets.json';
import ElButton from 'element-plus/lib/components/button/index';
import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElFormItemGroup from '@/ui/el-form-item-group.vue';
import ElFormItemAlignedGroups from '@/ui/el-form-item-aligned-groups.vue';
import ElInput from 'element-plus/lib/components/input/index';
import ElInputNumber from '@/ui/el-input-number.vue';
import ElLoading from 'element-plus/lib/components/loading/index';
import ElSelect, { ElOption } from 'element-plus/lib/components/select/index';
import { notifyInjector, unexpectedErrorMessage, validationSubmissionErrorMessage } from '@/lib/notify';
import { convertUnits } from '@/lib/metrics';
import { NewFilePreset } from '@/types';
import { Rules, RuleItem } from 'async-validator';
import { createNewFile } from '@/modules/file/new';

const defaultNewFilePresets: NewFilePreset[] = defaultNewFilePresetsJson as any;

export default defineComponent({
    name: 'ModuleFileNew',
    inheritAttrs: false,
    directives: {
        loading: ElLoading.directive
    },
    components: {
        ElButton,
        ElForm,
        ElFormItem,
        ElFormItemGroup,
        ElFormItemAlignedGroups,
        ElInput,
        ElInputNumber,
        ElOption,
        ElSelect
    },
    emits: [
        'update:title',
        'close'
    ],
    setup(props, { emit }) {
        emit('update:title', 'module.fileNew.title');

        const $notify = notifyInjector('$notify');
        const form = ref<typeof ElForm>();
        const loading = ref<boolean>(false);
        let isLoadingPreset: boolean = false;

        const dimensionUnitOptions = [
            { value: 'px', label: 'measurement.pixels' },
            { value: 'mm', label: 'measurement.millimeters' },
            { value: 'cm', label: 'measurement.centimeters' },
            { value: 'in', label: 'measurement.inches' }
        ];
        const resolutionUnitOptions = [
            { value: 'px/in', label: 'measurement.pixelsPerInch' },
            { value: 'px/mm', label: 'measurement.pixelsPerMillimeter' },
            { value: 'px/cm', label: 'measurement.pixelsPerCentimeter' }
        ];
        const presetOptions = reactive(defaultNewFilePresets.map((preset) => {
            return {
                value: preset.name,
                label: preset.name
            };
        }));
        const selectedPreset = ref<string>();
        const colorProfileOptions = reactive(['sRGB']);
        const formData = reactive({
            workingFile: {
                measuringUnits: 'px' as 'px' | 'mm' | 'cm' | 'in',
                width: 1000, // Always pixels
                height: 1000, // Always pixels
                resolution: 300,
                resolutionUnits: 'px/in' as 'px/in' | 'px/mm' | 'px/cm',
                colorProfile: 'sRGB',
                scaleFactor: 1
            }
        });
        const validateWidth: RuleItem['validator'] = function (rule, value) {
            if (value <= 0) {
                return new Error('Width must be greater than zero');
            } else {
                return true;
            }
        };
        const validateHeight: RuleItem['validator'] = function (rule, value) {
            if (value <= 0) {
                return new Error('Height must be greater than zero');
            } else {
                return true;
            }
        };
        const formValidationRules: Rules = {
            width: [
                { required: true, message: 'Please input a width' },
                { validator: validateWidth, trigger: 'blur' } as any
            ],
            height: [
                { required: true, message: 'Please input a width' },
                { validator: validateHeight }
            ]
        };

        watch(() => formData.workingFile.measuringUnits, (newMeasuringUnits: any, oldMeasuringUnits: any) => {
            if (!isLoadingPreset) {
                let width = convertUnits(formData.workingFile.width, oldMeasuringUnits, newMeasuringUnits, formData.workingFile.resolution, formData.workingFile.resolutionUnits);
                let height = convertUnits(formData.workingFile.height, oldMeasuringUnits, newMeasuringUnits, formData.workingFile.resolution, formData.workingFile.resolutionUnits);
                if (newMeasuringUnits === 'px') {
                    width = Math.round(width);
                    height = Math.round(height);
                }
                formData.workingFile.width = width;
                formData.workingFile.height = height;
            }
        });

        async function onChangeSelectedPreset(newPreset: string) {
            const presetDefinition = defaultNewFilePresets.filter((preset) => preset.name === newPreset)[0];
            if (presetDefinition) {
                isLoadingPreset = true;
                formData.workingFile.measuringUnits = 'px';
                formData.workingFile.width = convertUnits(presetDefinition.width, 'px', presetDefinition.measuringUnits, presetDefinition.resolutionX, presetDefinition.resolutionUnits);
                formData.workingFile.height = convertUnits(presetDefinition.height, 'px', presetDefinition.measuringUnits, presetDefinition.resolutionY, presetDefinition.resolutionUnits);
                formData.workingFile.resolutionUnits = presetDefinition.resolutionUnits;
                formData.workingFile.resolution = presetDefinition.resolutionX;
                formData.workingFile.colorProfile = presetDefinition.colorProfile;
                formData.workingFile.scaleFactor = presetDefinition.scaleFactor;
                formData.workingFile.measuringUnits = presetDefinition.measuringUnits;
                await nextTick();
                isLoadingPreset = false;
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
                // Remove focus from input so keyboard hides on mobile (without this, viewport calculation is off)
                try {
                    (document.activeElement as any).blur();
                    await new Promise((resolve) => {
                        setTimeout(resolve, 100);
                    });
                } catch (e) {
                    // Do nothing
                }
                try {
                    let convertedWidth = convertUnits(formData.workingFile.width, formData.workingFile.measuringUnits, 'px', formData.workingFile.resolution, formData.workingFile.resolutionUnits);
                    let convertedHeight = convertUnits(formData.workingFile.height, formData.workingFile.measuringUnits, 'px', formData.workingFile.resolution, formData.workingFile.resolutionUnits);
                    await createNewFile({
                        measuringUnits: formData.workingFile.measuringUnits,
                        width: Math.max(1, convertedWidth % 1 < 0.0000000000000001 ? Math.floor(convertedWidth) : Math.ceil(convertedWidth)),
                        height: Math.max(1, convertedHeight % 1 < 0.0000000000000001 ? Math.floor(convertedHeight) : Math.ceil(convertedHeight)),
                        resolutionX: formData.workingFile.resolution,
                        resolutionY: formData.workingFile.resolution,
                        resolutionUnits: formData.workingFile.resolutionUnits,
                        scaleFactor: formData.workingFile.scaleFactor
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

        function onInputAny() {
            if (!isLoadingPreset) {
                selectedPreset.value = '';
            }
        }
        
        return {
            form,
            loading,
            presetOptions,
            dimensionUnitOptions,
            resolutionUnitOptions,
            colorProfileOptions,
            selectedPreset,
            formData,
            formValidationRules,
            onCancel,
            onChangeSelectedPreset,
            onCreate,
            onInputAny
        };
    }
});
</script>
