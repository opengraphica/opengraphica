<template>
    <div class="is-flex container is-align-items-center is-justify-content-space-between mx-auto">
        <div class="py-2 pl-4 is-text-nowrap is-text-ellipsis">
            <div class="is-block my-2 is-text-ellipsis">
                <i class="bi bi-crop" aria-hidden="true" />
                Crop and Resize
            </div>
        </div>
        <div class="py-2 px-3 is-text-nowrap">
            <el-button plain type="text" class="px-4" aria-label="Cancel" @click="onCancel">
                <template v-if="isMobileView">
                    <i class="el-icon-close"></i>
                </template>
                <template v-else>
                    Cancel
                </template>
            </el-button>
            <el-popover placement="bottom" :popper-class="'ogr-dock-popover'" trigger="click" :width="250" :append-to-body="false">
                <template #reference>
                    <el-button plain type="text" class="px-4 ml-0 mr-2" aria-label="Settings">
                        <template v-if="isMobileView">
                            <i class="bi bi-sliders"></i>
                        </template>
                        <template v-else>
                            Settings
                        </template>
                    </el-button>
                </template>
                <h2 class="mt-3 mx-4.5">Settings</h2>
                <el-form novalidate="novalidate" action="javascript:void(0)">
                    <div class="px-4.5 mb-3">
                        <el-button-group class="el-button-group--flex is-fullwidth">
                            <el-input-number v-model="resizeWidth" size="small" class="is-flex-grow-1" suffix-text="px" />
                            <el-button size="small" aria-label="Link Width/Height" class="px-3">
                                <i class="bi bi-lock-fill" aria-hidden="true" />
                            </el-button>
                            <el-input-number v-model="resizeHeight" size="small" class="is-flex-grow-1" suffix-text="px" />
                        </el-button-group>
                    </div>
                    <el-form-item class="el-form-item--menu-item mb-1" label="DPI">
                        <el-input-number style="width: 5rem" size="small" />
                    </el-form-item>
                    <el-form-item class="el-form-item--menu-item mb-1" label="Resample">
                        <el-switch />
                    </el-form-item>
                    <el-form-item class="el-form-item--menu-item mb-1" label="Snapping">
                        <el-switch />
                    </el-form-item>
                </el-form>
            </el-popover>
            <el-button aria-label="Done" plain type="primary" @click="onDone">
                <template v-if="isMobileView">
                    <i class="el-icon-check"></i>
                </template>
                <template v-else>
                    Done
                </template>
            </el-button>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent, ref, onMounted, toRefs, watch } from 'vue';
import ElButton from 'element-plus/lib/el-button';
import ElButtonGroup from 'element-plus/lib/el-button-group';
import ElForm from 'element-plus/lib/el-form';
import ElFormItem from 'element-plus/lib/el-form-item';
import ElInputNumber from '@/ui/el-input-number.vue';
import ElLoading from 'element-plus/lib/el-loading';
import ElPopover from 'element-plus/lib/el-popover';
import ElSwitch from 'element-plus/lib/el-switch';
import appEmitter from '@/lib/emitter';
import canvasStore from '@/store/canvas';
import historyStore from '@/store/history';
import workingFileStore from '@/store/working-file';
import { top as cropTop, left as cropLeft, width as cropWidth, height as cropHeight } from '@/canvas/store/crop-resize-state';
import { WorkingFileLayer, WorkingFileGroupLayer, RGBAColor, UpdateAnyLayerOptions } from '@/types';
import { BundleAction } from '@/actions/bundle';
import { UpdateFileAction } from '@/actions/update-file';
import { UpdateLayerAction } from '@/actions/update-layer';
import { width as resizeWidth, height as resizeHeight } from '@/canvas/store/crop-resize-state';

export default defineComponent({
    name: 'ToolbarCropResize',
    directives: {
        loading: ElLoading.directive
    },
    components: {
        ElButton,
        ElButtonGroup,
        ElForm,
        ElFormItem,
        ElInputNumber,
        ElPopover,
        ElSwitch
    },
    props: {
        
    },
    emits: [
        'close'
    ],
    setup(props, { emit }) {
        const isMobileView = ref<boolean>(false);
        const { viewWidth: viewportWidth } = toRefs(canvasStore.state);

        watch([viewportWidth], () => {
            toggleMobileView();
        });

        onMounted(() => {
            toggleMobileView();
        });

        function toggleMobileView() {
            isMobileView.value = viewportWidth.value < 500;
        }

        function onCancel() {
            emit('close');
        }

        async function onDone() {
            appEmitter.emit('app.wait.startBlocking', { id: 'toolCropResizeCalculating', label: 'Crop and Resize' });
            try {
                const layers = workingFileStore.get('layers');
                let layerUpdateActions: UpdateLayerAction<UpdateAnyLayerOptions<RGBAColor>>[] = await generateResizeLayerActions(layers);
                await historyStore.dispatch('runAction', {
                    action: new BundleAction('moduleCropResize', 'Crop and Resize', [
                        ...layerUpdateActions,
                        new UpdateFileAction({
                            width: cropWidth.value,
                            height: cropHeight.value
                        })
                    ])
                });
            } catch (error) {
                
            }
            appEmitter.emit('app.wait.stopBlocking', { id: 'toolCropResizeCalculating' });
            emit('close');
        }

        async function generateResizeLayerActions(layers: WorkingFileLayer<RGBAColor>[]): Promise<UpdateLayerAction<UpdateAnyLayerOptions<RGBAColor>>[]> {
            let actions: UpdateLayerAction<UpdateAnyLayerOptions<RGBAColor>>[] = [];
            for (let layer of layers) {
                if (layer.type === 'group') {
                    await generateResizeLayerActions((layer as WorkingFileGroupLayer<RGBAColor>).layers);
                } else if (layer.type === 'raster') {
                    actions.push(
                        new UpdateLayerAction<UpdateAnyLayerOptions<RGBAColor>>({
                            id: layer.id,
                            x: layer.x - cropLeft.value,
                            y: layer.y - cropTop.value
                        })
                    );
                }
            }
            return actions;
        }

        return {
            resizeWidth,
            resizeHeight,
            isMobileView,
            onCancel,
            onDone
        };
    }
});
</script>
