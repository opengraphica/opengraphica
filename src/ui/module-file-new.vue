<template>
    <el-form ref="form" class="el-form--connected-labels" label-position="left">
        <el-form-item-group>
            <el-form-item label="Width">
                <el-input v-model="formData.workingFile.width">
                    <template #append>
                        px
                    </template>
                </el-input>
            </el-form-item>
            <el-form-item label="Height">
                <el-input class="has-text-right" v-model="formData.workingFile.height">
                    <template #append>
                        px
                    </template>
                </el-input>
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

export default defineComponent({
    name: 'ModuleFileNew',
    components: {
        ElButton,
        ElForm,
        ElFormItem,
        ElFormItemGroup,
        ElInput
    },
    emits: [
        'dialog-title'
    ],
    setup(props, { emit }) {
        emit('dialog-title', 'New File');
        const formData = reactive({
            workingFile: {
                width: 100,
                height: 100
            }
        });
        
        return {
            formData
        };
    }
});
</script>
