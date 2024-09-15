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
            <div class="is-flex">
                <el-radio-group v-model="formData.blendingMode" class="el-radio-group--vertical">
                    <el-radio-button label="normal">
                        {{ $t('layerBlendingMode.normal') }}
                    </el-radio-button>
                    <el-radio-button label="erase">
                        {{ $t('layerBlendingMode.erase') }}
                    </el-radio-button>
                    <!-- <el-radio-button label="multiply">
                        {{ $t('layerBlendingMode.multiply') }}
                    </el-radio-button> -->
                </el-radio-group>
                <div class="is-flex-grow-1 pl-4">
                    <div class="is-flex is-flex-direction-row is-align-items-center is-justify-content-center">
                        <div class="is-flex is-flex-shrink-1 is-flex-direction-column is-align-items-center">
                            <img :src="previewImages.top" class="ogr-module-layer-blending-mode__image-preview" :alt="$t('module.layerBlendingMode.layerTop')" width="256" height="256">
                            <div>
                                <span class="bi bi-plus is-size-3" />
                            </div>
                            <img :src="previewImages.bottom" class="ogr-module-layer-blending-mode__image-preview" :alt="$t('module.layerBlendingMode.layerBottom')" width="256" height="256">
                        </div>
                        <div class="is-flex-shrink-0 px-2">
                            <span class="bi bi-arrow-right-short is-size-3" />
                        </div>
                        <div class="is-flex is-flex-shrink-1 is-flex-direction-column">
                            <img :src="previewImages.result" class="ogr-module-layer-blending-mode__image-preview" :alt="$t('module.layerBlendingMode.result')" width="256" height="256">
                        </div>
                    </div>
                </div>
            </div>
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
import ElLoading from 'element-plus/lib/components/loading/index';
import { ElRadioGroup, ElRadioButton } from 'element-plus/lib/components/radio/index';
import ElRow from 'element-plus/lib/components/row/index';
import ElSelect, { ElOption } from 'element-plus/lib/components/select/index';

import historyStore from '@/store/history';
import { getLayerById } from '@/store/working-file';
import { UpdateLayerAction } from '@/actions/update-layer';
import { BundleAction } from '@/actions/bundle';

import type { WorkingFileLayerBlendingMode } from '@/types';

export default defineComponent({
    name: 'ModuleLayerBlendingMode',
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
        ElOption,
        ElRadioButton,
        ElRadioGroup,
        ElRow,
        ElSelect,
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
        emit('update:title', 'module.layerBlendingMode.title');
        emit('update:dialogSize', 'medium-large');

        const hasError = ref(false);
        const loading = ref(false);

        const formData = reactive<{ blendingMode: WorkingFileLayerBlendingMode }>({
            blendingMode: getLayerById(props.layerId)?.blendingMode ?? 'normal',
        });
        const formValidationRules = ref<Rules>({});

        const previewImages = computed(() => {
            switch (formData.blendingMode) {
                case 'normal':
                    return {
                        top: '../images/module/layer/blending-mode/blend-demo-foreground-flower.png',
                        bottom: '../images/module/layer/blending-mode/blend-demo-apple.png',
                        result: '../images/module/layer/blending-mode/blend-demo-result-normal.png',
                    }
                case 'erase':
                    return {
                        top: '../images/module/layer/blending-mode/blend-demo-foreground-flower.png',
                        bottom: '../images/module/layer/blending-mode/blend-demo-apple.png',
                        result: '../images/module/layer/blending-mode/blend-demo-result-erase.png',
                    }
                case 'multiply':
                    return {
                        top: '../images/module/layer/blending-mode/blend-demo-foreground-flower.png',
                        bottom: '../images/module/layer/blending-mode/blend-demo-apple.png',
                        result: '../images/module/layer/blending-mode/blend-demo-result-multiply.png',
                    }
            }
            return {
                top: '',
                bottom: '',
                result: '',
            };
        });

        onMounted(async () => {
            nextTick(async () => {
                if (props.isDialog) {
                    initialSetup();

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
                    formData.blendingMode = layer.blendingMode;
                }
            } catch (error) {
                console.error('[src/ui/module-layer-blending-mode.vue] Error during initial setup. ', error);
            }
        }
        function onCancel() {
            emit('close');
        }

        async function onConfirm() {
            await historyStore.dispatch('runAction', {
                action: new BundleAction('updateLayerBlendingMode', 'action.updateLayerBlendingMode', [
                    new UpdateLayerAction({
                        id: props.layerId,
                        blendingMode: formData.blendingMode,
                    })
                ])
            });

            emit('close');
        }
        
        return {
            hasError,
            loading,
            previewImages,

            formData,
            formValidationRules,

            onCancel,
            onConfirm
        };
    }
});
</script>
