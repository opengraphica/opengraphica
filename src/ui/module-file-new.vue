<template>
    <el-form ref="form" label-position="left">
        <el-form-item-aligned-groups>
            <el-form-item-group>
                <el-form-item label="Preset">
                    <el-select v-model="selectedPreset" placeholder="Select (Optional)" clearable filterable :popper-append-to-body="false">
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
                <el-form-item label="Width">
                    <el-input-number v-model="formData.workingFile.width">
                        <template #append>
                            <el-select style="width: 6rem" v-model="formData.workingFile.dimensionUnits" :popper-append-to-body="false">
                                <el-option
                                    v-for="option in dimensionUnitOptions"
                                    :key="option.value"
                                    :label="option.value"
                                    :value="option.value">
                                    {{ option.label }}
                                </el-option>
                            </el-select>
                        </template>
                    </el-input-number>
                </el-form-item>
                <el-form-item label="Height">
                    <el-input-number v-model="formData.workingFile.height">
                        <template #append>
                            <el-select style="width: 6rem" v-model="formData.workingFile.dimensionUnits" :popper-append-to-body="false">
                                <el-option
                                    v-for="option in dimensionUnitOptions"
                                    :key="option.value"
                                    :label="option.value"
                                    :value="option.value">
                                    {{ option.label }}
                                </el-option>
                            </el-select>
                        </template>
                    </el-input-number>
                </el-form-item>
                <el-form-item label="Resolution">
                    <el-input-number v-model="formData.workingFile.resolution">
                        <template #append>
                            <el-select style="width: 6rem" v-model="formData.workingFile.resolutionUnits" :popper-append-to-body="false">
                                <el-option
                                    v-for="option in resolutionUnitOptions"
                                    :key="option.value"
                                    :label="option.value"
                                    :value="option.value">
                                    {{ option.label }}
                                </el-option>
                            </el-select>
                        </template>
                    </el-input-number>
                </el-form-item>
                <el-form-item label="Color Profile">
                    <el-select v-model="formData.workingFile.colorProfile" :popper-append-to-body="false">
                        <el-option
                            v-for="option in colorProfileOptions"
                            :key="option"
                            :label="option"
                            :value="option">
                        </el-option>
                    </el-select>
                </el-form-item>
                <el-form-item label="Scale Factor">
                    <el-input v-model="formData.workingFile.scaleFactor"></el-input>
                </el-form-item>
            </el-form-item-group>
        </el-form-item-aligned-groups>
        <div class="has-text-right">
            <el-button>Cancel</el-button>
            <el-button type="primary">Create</el-button>
        </div>
    </el-form>
</template>

<script lang="ts">
import { defineComponent, ref, reactive, watch } from 'vue';
import defaultNewFilePresets from '@/config/default-new-file-presets.json';
import ElButton from 'element-plus/lib/el-button';
import ElForm from 'element-plus/lib/el-form';
import ElFormItem from 'element-plus/lib/el-form-item';
import ElFormItemGroup from '@/ui/el-form-item-group.vue';
import ElFormItemAlignedGroups from '@/ui/el-form-item-aligned-groups.vue';
import ElInput from 'element-plus/lib/el-input';
import ElInputNumber from '@/ui/el-input-number.vue';
import ElOption from 'element-plus/lib/el-option';
import ElSelect from 'element-plus/lib/el-select';
import { convertUnits } from '@/lib/metrics';

export default defineComponent({
    name: 'ModuleFileNew',
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
        'dialog-title'
    ],
    setup(props, { emit }) {
        emit('dialog-title', 'New File');
        const dimensionUnitOptions = [
            { value: 'px', label: 'Pixels' },
            { value: 'mm', label: 'Millimeters' },
            { value: 'cm', label: 'Centimeters' },
            { value: 'in', label: 'Inches' }
        ];
        const resolutionUnitOptions = [
            { value: 'px/in', label: 'Pixels/Inch' },
            { value: 'px/mm', label: 'Pixels/Millimeter' },
            { value: 'px/cm', label: 'Pixels/Centimeter' }
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
                dimensionUnits: 'px',
                width: 100, // Always pixels
                height: 100, // Always pixels
                resolution: 300,
                resolutionUnits: 'px/in',
                colorProfile: 'sRGB',
                scaleFactor: 1
            }
        });
        let lastNonZeroResolution: number = 300;

        watch(() => formData.workingFile.dimensionUnits, (newDimensionUnits: any, oldDimensionUnits: any) => {
            formData.workingFile.width = convertUnits(formData.workingFile.width, oldDimensionUnits, newDimensionUnits, formData.workingFile.resolution, formData.workingFile.resolutionUnits as any);
            formData.workingFile.height = convertUnits(formData.workingFile.height, oldDimensionUnits, newDimensionUnits, formData.workingFile.resolution, formData.workingFile.resolutionUnits as any);
        });

        watch(() => formData.workingFile.resolution, (newResolution, oldResolution) => {
            if (oldResolution !== 0) {
                lastNonZeroResolution = oldResolution;
            }
            if (formData.workingFile.dimensionUnits === 'px' && newResolution !== 0) {
                formData.workingFile.width *= lastNonZeroResolution / newResolution;
                formData.workingFile.height *= lastNonZeroResolution / newResolution;
            }
        });
        
        return {
            presetOptions,
            dimensionUnitOptions,
            resolutionUnitOptions,
            colorProfileOptions,
            selectedPreset,
            formData
        };
    }
});
</script>
