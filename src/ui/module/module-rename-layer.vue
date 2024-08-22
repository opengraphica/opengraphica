<template>
    <div v-loading="loading">
        <el-form
            ref="form"
            action="javascript:void(0)"
            label-position="left"
            :model="formData"
            :rules="formValidationRules"
            novalidate="novalidate"
            hide-required-asterisk
            class="mt-3"
            @submit="onConfirm"
        >
            <el-form-item-aligned-groups>
                <el-form-item-group>
                    <el-form-item :label="$t('module.renameLayer.layerName')">
                        <el-input
                            v-model="formData.layerName"
                            clearable
                        />
                    </el-form-item>
                </el-form-item-group>
            </el-form-item-aligned-groups>
            <div class="has-text-right">
                <el-divider />
                <div class="has-text-right">
                    <el-button @click="onCancel">{{ $t('button.cancel') }}</el-button>
                    <el-button type="primary" @click="onConfirm">{{ $t('button.apply') }}</el-button>
                </div>
            </div>
        </el-form>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, nextTick, reactive, watch, WatchStopHandle } from 'vue';
import { Rules } from 'async-validator';
import ElAutoGrid from '@/ui/el/el-auto-grid.vue';
import ElButton from 'element-plus/lib/components/button/index';
import ElCol from 'element-plus/lib/components/col/index';
import ElDivider from 'element-plus/lib/components/divider/index';
import ElForm, { ElFormItem } from 'element-plus/lib/components/form/index';
import ElFormItemGroup from '@/ui/el/el-form-item-group.vue';
import ElFormItemAlignedGroups from '@/ui/el/el-form-item-aligned-groups.vue';
import ElInput from 'element-plus/lib/components/input/index';
import ElLoading from 'element-plus/lib/components/loading/index';
import ElRow from 'element-plus/lib/components/row/index';

import historyStore from '@/store/history';
import { getLayerById } from '@/store/working-file';
import { UpdateLayerAction } from '@/actions/update-layer';
import { BundleAction } from '@/actions/bundle';

export default defineComponent({
    name: 'ModuleRenameLayer',
    inheritAttrs: false,
    directives: {
        loading: ElLoading.directive,
    },
    components: {
        ElAutoGrid,
        ElButton,
        ElCol,
        ElDivider,
        ElForm,
        ElFormItem,
        ElFormItemGroup,
        ElFormItemAlignedGroups,
        ElInput,
        ElRow,
    },
    emits: [
        'update:title',
        'update:dialogSize',
        'close',
    ],
    props: {
        isDialog: {
            type: Boolean,
            default: false
        },
        dialogOpened: {
            type: Boolean,
            default: false
        },
        layerId: {
            type: Number,
            required: true
        },
    },
    setup(props, { emit }) {
        emit('update:title', 'module.renameLayer.title');
        emit('update:dialogSize', 'medium');

        const hasError = ref(false);
        const loading = ref(false);

        const formData = reactive<{ layerName: string }>({
            layerName: '',
        });
        const formValidationRules = ref<Rules>({});

        onMounted(async () => {
            nextTick(async () => {
                if (props.isDialog) {
                    let stopWatch: WatchStopHandle;
                    stopWatch = watch(() => props.dialogOpened, (dialogOpened) => {
                        if (dialogOpened) {
                            stopWatch?.();
                            initialSetup();
                        }
                    }, { immediate: true });
                } else {
                    initialSetup();
                }
            });
        });

        async function initialSetup() {
            try {
                const layer = getLayerById(props.layerId);
                if (layer) {
                    formData.layerName = layer.name;
                }
            } catch (error) {
                console.error('[src/ui/module-rename-layer.vue] Error during initial setup. ', error);
            }
        }
        function onCancel() {
            emit('close');
        }

        async function onConfirm() {
            await historyStore.dispatch('runAction', {
                action: new BundleAction('renameLayer', 'action.renameLayer', [
                    new UpdateLayerAction({
                        id: props.layerId,
                        name: formData.layerName,
                    })
                ])
            });

            emit('close');
        }
        
        return {
            hasError,
            loading,
            formData,
            formValidationRules,
            onCancel,
            onConfirm
        };
    }
});
</script>
