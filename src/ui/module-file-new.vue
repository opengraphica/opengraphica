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
                    <el-input v-model="formData.workingFile.width">
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
                    </el-input>
                </el-form-item>
                <el-form-item label="Height">
                    <el-input v-model="formData.workingFile.height">
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
                    </el-input>
                </el-form-item>
                <el-form-item label="Resolution">
                    <el-input v-model="formData.workingFile.resolution">
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
                    </el-input>
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
                    <el-input v-model="formData.workingFile.scaleFactor">
                        <template #append>
                            %
                        </template>
                    </el-input>
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
import { defineComponent, ref, reactive } from 'vue';
import defaultNewFilePresets from '@/config/default-new-file-presets.json';
import ElButton from 'element-plus/lib/el-button';
import ElForm from 'element-plus/lib/el-form';
import ElFormItem from 'element-plus/lib/el-form-item';
import ElFormItemGroup from '@/ui/el-form-item-group.vue';
import ElFormItemAlignedGroups from '@/ui/el-form-item-aligned-groups.vue';
import ElInput from 'element-plus/lib/el-input';
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
