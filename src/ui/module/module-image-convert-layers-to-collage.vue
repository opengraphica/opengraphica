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
        @submit="onApply">
        <template v-if="step === 'selectType'">
            <el-row :gutter="8">
                <el-col
                    v-for="collageTypeOption in collageTypeOptions"
                    :key="collageTypeOption.title"
                    :span="6"
                >
                    <el-button plain class="ogr-mode-select-button" @click="selectType(collageTypeOption.type)">
                        <img :src="collageTypeOption.icon" aria-hidden="true" />
                        <span class="ogr-mode_select-button__title">{{ $t(collageTypeOption.title) }}</span>
                    </el-button>
                </el-col>
            </el-row>
        </template>
        <template v-else>
            <el-form-item-group>
                <el-form-item
                    v-for="param in selectedParams"
                    :key="param.name"
                    :label="$t(`module.imageConvertLayersToCollage.params.${selectedType}.${param.name}`)"
                >
                    <template v-if="param.options">
                        <el-select
                            v-model="formData.params[param.name]"
                        >
                            <el-option
                                v-for="option of param.options"
                                :key="option.key"
                                :label="$t(`module.imageConvertLayersToCollage.params.${selectedType}.${param.name}Option.${option.key}`)"
                                :value="option.value"
                            >
                            </el-option>
                        </el-select>
                    </template>
                    <template v-else-if="param.type === 'number'">
                        <el-input-number
                            v-model="formData.params[param.name]" :min="param.min" :max="param.max"
                            :suffix-text="param.units"
                        />
                    </template>
                </el-form-item>
                <el-form-item :label="$t(`module.imageConvertLayersToCollage.params.shared.reverseLayerOrder`)">
                    <el-switch v-model="formData.params.reverseLayerOrder" />
                </el-form-item>
            </el-form-item-group>
        </template>
        <div class="has-text-right mt-4">
            <el-button @click="onCancel">{{ $t('button.cancel') }}</el-button>
            <el-button v-if="step === 'editParams'" type="primary" native-type="submit">{{ $t('button.apply') }}</el-button>
        </div>
    </el-form>
</template>

<script lang="ts">
import { computed, defineComponent, ref, reactive } from 'vue';
import ElButton from 'element-plus/lib/components/button/index';
import ElSwitch from 'element-plus/lib/components/switch/index';
import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElFormItemGroup from '@/ui/el/el-form-item-group.vue';
import ElInputNumber from '@/ui/el/el-input-number.vue';
import ElRow from 'element-plus/lib/components/row/index';
import ElCol from 'element-plus/lib/components/col/index';
import ElLoading from 'element-plus/lib/components/loading/index';
import ElSelect, { ElOption } from 'element-plus/lib/components/select/index';
import workingFileStore from '@/store/working-file';
import { notifyInjector, unexpectedErrorMessage, validationSubmissionErrorMessage } from '@/lib/notify';
import { Rules, RuleItem } from 'async-validator';
import { collageTypeCallbacks, convertLayersToCollage, type CollageTypeCallbackParam } from '@/modules/image/conversion';
import { camelCaseToKebabCase } from '@/lib/string';

export default defineComponent({
    name: 'ModuleImageConvertLayersToCollage',
    inheritAttrs: false,
    directives: {
        loading: ElLoading.directive
    },
    components: {
        ElButton,
        ElSwitch,
        ElForm,
        ElFormItem,
        ElFormItemGroup,
        ElInputNumber,
        ElRow,
        ElCol,
        ElSelect,
        ElOption,
    },
    emits: [
        'update:title',
        'update:dialogSize',
        'close'
    ],
    setup(props, { emit }) {
        emit('update:title', 'module.imageConvertLayersToCollage.title');
        emit('update:dialogSize', 'medium-large');

        const step = ref('selectType');
        const selectedType = ref('');
        const selectedParams = ref<CollageTypeCallbackParam[]>([]);

        const $notify = notifyInjector('$notify');
        const form = ref<typeof ElForm>();
        const loading = ref<boolean>(false);
       
        const formData = reactive<{ params: Record<string, any> }>({
            params: {
                reverseLayerOrder: false,
            }
        });
        const formValidationRules: Rules = {};

        const collageTypeOptions = computed(() => {
            return collageTypeCallbacks.map((definition) => ({
                type: definition.type,
                title: 'module.imageConvertLayersToCollage.collageType.' + definition.type,
                icon: `images/module/image/convert-layers-to-collage/${camelCaseToKebabCase(definition.type)}.svg`
            }));
        });

        function selectType(type: string) {
            selectedType.value = type;
            const typeDefinition = collageTypeCallbacks.find((definition) => definition.type === type);
            selectedParams.value = typeDefinition?.params ?? [];
            for (const param of selectedParams.value) {
                if (param.default !== undefined) {
                    formData.params[param.name] = param.default;
                }
            }
            step.value = 'editParams';
        }

        function onCancel() {
            emit('close');
        }

        async function onApply() {
            if (!form.value) {
                return;
            }
            try {
                await form.value.validate();
                loading.value = true;
                try {
                    await convertLayersToCollage({
                        type: selectedType.value,
                        params: formData.params,
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
            step,
            selectedType,
            selectedParams,
            collageTypeOptions,
            selectType,
            onCancel,
            onApply
        };
    }
});
</script>
