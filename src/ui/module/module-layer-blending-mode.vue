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
                <div style="max-height: 35vh">
                    <el-scrollbar>
                        <el-radio-group ref="blendingModeRadioGroup" v-model="formData.blendingMode" class="el-radio-group--vertical pr-3">
                            <el-radio-button label="normal">
                                {{ $t('layerBlendingMode.normal') }}
                            </el-radio-button>
                            <!-- <el-radio-button label="colorErase">
                                {{ $t('layerBlendingMode.colorErase') }}
                            </el-radio-button> -->
                            <el-radio-button label="erase">
                                {{ $t('layerBlendingMode.erase') }}
                            </el-radio-button>
                            <el-radio-button label="lightenOnly" class="el-radio-button--section-break">
                                {{ $t('layerBlendingMode.lightenOnly') }}
                            </el-radio-button>
                            <el-radio-button label="lumaLightenOnly">
                                {{ $t('layerBlendingMode.lumaLightenOnly') }}
                            </el-radio-button>
                            <el-radio-button label="screen">
                                {{ $t('layerBlendingMode.screen') }}
                            </el-radio-button>
                            <el-radio-button label="dodge">
                                {{ $t('layerBlendingMode.dodge') }}
                            </el-radio-button>
                            <el-radio-button label="linearDodge">
                                {{ $t('layerBlendingMode.linearDodge') }}
                            </el-radio-button>
                            <el-radio-button label="addition">
                                {{ $t('layerBlendingMode.addition') }}
                            </el-radio-button>
                            <el-radio-button label="darkenOnly" class="el-radio-button--section-break">
                                {{ $t('layerBlendingMode.darkenOnly') }}
                            </el-radio-button>
                            <el-radio-button label="lumaDarkenOnly">
                                {{ $t('layerBlendingMode.lumaDarkenOnly') }}
                            </el-radio-button>
                            <el-radio-button label="multiply">
                                {{ $t('layerBlendingMode.multiply') }}
                            </el-radio-button>
                            <el-radio-button label="burn">
                                {{ $t('layerBlendingMode.burn') }}
                            </el-radio-button>
                            <el-radio-button label="linearBurn">
                                {{ $t('layerBlendingMode.linearBurn') }}
                            </el-radio-button>
                            <el-radio-button label="overlay" class="el-radio-button--section-break">
                                {{ $t('layerBlendingMode.overlay') }}
                            </el-radio-button>
                            <el-radio-button label="softLight">
                                {{ $t('layerBlendingMode.softLight') }}
                            </el-radio-button>
                            <el-radio-button label="hardLight">
                                {{ $t('layerBlendingMode.hardLight') }}
                            </el-radio-button>
                            <el-radio-button label="vividLight">
                                {{ $t('layerBlendingMode.vividLight') }}
                            </el-radio-button>
                            <el-radio-button label="pinLight">
                                {{ $t('layerBlendingMode.pinLight') }}
                            </el-radio-button>
                            <el-radio-button label="linearLight">
                                {{ $t('layerBlendingMode.linearLight') }}
                            </el-radio-button>
                            <el-radio-button label="hardMix">
                                {{ $t('layerBlendingMode.hardMix') }}
                            </el-radio-button>
                            <el-radio-button label="difference" class="el-radio-button--section-break">
                                {{ $t('layerBlendingMode.difference') }}
                            </el-radio-button>
                            <el-radio-button label="exclusion">
                                {{ $t('layerBlendingMode.exclusion') }}
                            </el-radio-button>
                            <el-radio-button label="subtract">
                                {{ $t('layerBlendingMode.subtract') }}
                            </el-radio-button>
                            <el-radio-button label="grainExtract">
                                {{ $t('layerBlendingMode.grainExtract') }}
                            </el-radio-button>
                            <el-radio-button label="grainMerge">
                                {{ $t('layerBlendingMode.grainMerge') }}
                            </el-radio-button>
                            <el-radio-button label="divide">
                                {{ $t('layerBlendingMode.divide') }}
                            </el-radio-button>
                            <el-radio-button label="hue" class="el-radio-button--section-break">
                                {{ $t('layerBlendingMode.hue') }}
                            </el-radio-button>
                            <el-radio-button label="chroma">
                                {{ $t('layerBlendingMode.chroma') }}
                            </el-radio-button>
                            <el-radio-button label="color">
                                {{ $t('layerBlendingMode.color') }}
                            </el-radio-button>
                            <el-radio-button label="lightness">
                                {{ $t('layerBlendingMode.lightness') }}
                            </el-radio-button>
                        </el-radio-group>
                    </el-scrollbar>
                </div>
                <div class="is-flex-grow-1 pl-4">
                    <div class="is-flex is-flex-direction-row is-align-items-center is-justify-content-center">
                        <div class="is-flex is-flex-shrink-1 is-flex-direction-column is-align-items-center">
                            <img :src="previewImages.top" class="og-module-layer-blending-mode__image-preview" :alt="$t('module.layerBlendingMode.layerTop')" width="256" height="256">
                            <div>
                                <span class="bi bi-plus is-size-3" />
                            </div>
                            <img :src="previewImages.bottom" class="og-module-layer-blending-mode__image-preview" :alt="$t('module.layerBlendingMode.layerBottom')" width="256" height="256">
                        </div>
                        <div class="is-flex-shrink-0 px-2">
                            <span class="bi bi-arrow-right-short is-size-3" />
                        </div>
                        <div class="is-flex is-flex-shrink-1 is-flex-direction-column">
                            <img :src="previewImages.result" class="og-module-layer-blending-mode__image-preview" :alt="$t('module.layerBlendingMode.result')" width="256" height="256">
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

import layerBlendingModePreviews from '@/config/layer-blending-mode-previews.json';

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
import ElScrollbar from 'element-plus/lib/components/scrollbar/index';

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
        ElScrollbar,
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

        const blendingModeRadioGroup = ref<typeof ElRadioGroup>();

        const hasError = ref(false);
        const loading = ref(false);

        const formData = reactive<{ blendingMode: WorkingFileLayerBlendingMode }>({
            blendingMode: getLayerById(props.layerId)?.blendingMode ?? 'normal',
        });
        const formValidationRules = ref<Rules>({});

        const previewImages = computed(() => {
            return (layerBlendingModePreviews as Record<string, unknown>)[formData.blendingMode];
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
                    await nextTick();
                    blendingModeRadioGroup.value?.$el.querySelector('.is-active')?.scrollIntoView();
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
            blendingModeRadioGroup,

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
