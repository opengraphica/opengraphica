<template>
    <el-form ref="form" class="el-form--connected-labels" label-position="left">
        <el-form-item-group>
            <el-form-item label="Units">
                <el-select v-model="formData.workingFile.measuringUnits">
                    <el-option
                        v-for="option in unitOptions"
                        :key="option.value"
                        :label="option.label"
                        :value="option.value">
                    </el-option>
                </el-select>
            </el-form-item>
            <el-form-item label="Width">
                <el-input v-model="formData.workingFile.width">
                    <template #append>
                        {{ formData.workingFile.measuringUnits }}
                    </template>
                </el-input>
            </el-form-item>
            <el-form-item label="Height">
                <el-input v-model="formData.workingFile.height">
                    <template #append>
                        {{ formData.workingFile.measuringUnits }}
                    </template>
                </el-input>
            </el-form-item>
            <el-form-item label="DPI">
                <el-input v-model="formData.workingFile.dpi"></el-input>
            </el-form-item>
        </el-form-item-group>
        <div class="has-text-right">
            <el-button>Cancel</el-button>
            <el-button type="primary" @click="onSubmit">Create</el-button>
        </div>
    </el-form>
</template>

<script lang="ts">
import { defineComponent, reactive } from 'vue';
import ElButton from 'element-plus/lib/el-button';
import ElForm from 'element-plus/lib/el-form';
import ElFormItem from 'element-plus/lib/el-form-item';
import ElFormItemGroup from '@/ui/el-form-item-group.vue';
import ElInput from 'element-plus/lib/el-input';
import ElOption from 'element-plus/lib/el-option';
import ElSelect from 'element-plus/lib/el-select';

export default defineComponent({
    name: 'ModuleFileNew',
    components: {
        ElButton,
        ElForm,
        ElFormItem,
        ElFormItemGroup,
        ElInput,
        ElOption,
        ElSelect
    },
    emits: [
        'dialog-title'
    ],
    setup(props, { emit }) {
        emit('dialog-title', 'New File');
        const unitOptions = [
            { value: 'px', label: 'Pixels' },
            { value: 'mm', label: 'Millimeters' },
            { value: 'cm', label: 'Centimeters' },
            { value: 'in', label: 'Inches' }
        ];
        const formData = reactive({
            workingFile: {
                measuringUnits: 'px',
                width: 100,
                height: 100,
                dpi: 300
            }
        });
        
        return {
            unitOptions,
            formData
        };
    }
});
</script>
