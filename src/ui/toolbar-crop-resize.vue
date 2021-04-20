<template>
    <div class="is-flex container is-align-items-center is-justify-content-space-between mx-auto">
        <div class="py-2 pl-4 is-text-nowrap is-text-ellipsis">
            <div class="is-block my-2 is-text-ellipsis">
                <i class="bi bi-crop" aria-hidden="true" />
                Crop and Resize
            </div>
        </div>
        <div class="py-2 px-3 is-text-nowrap">
            <el-button @click="onCancel">Cancel</el-button>
            <!--el-button aria-label="Settings">Settings</el-button-->
            <el-button type="primary" @click="onDone">Done</el-button>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent } from 'vue';
import ElButton from 'element-plus/lib/el-button';
import ElLoading from 'element-plus/lib/el-loading';
import appEmitter from '@/lib/emitter';
import historyStore from '@/store/history';
import workingFileStore from '@/store/working-file';
import { top as cropTop, left as cropLeft, width as cropWidth, height as cropHeight } from '@/canvas/store/crop-resize-state';
import { WorkingFileLayer, WorkingFileGroupLayer, RGBAColor, UpdateAnyLayerOptions } from '@/types';
import { BundleAction } from '@/actions/bundle';
import { UpdateFileAction } from '@/actions/update-file';
import { UpdateLayerAction } from '@/actions/update-layer';

export default defineComponent({
    name: 'ToolbarCropResize',
    directives: {
        loading: ElLoading.directive
    },
    components: {
        ElButton
    },
    props: {
        
    },
    emits: [
        'close'
    ],
    setup(props, { emit }) {

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
            onCancel,
            onDone
        };
    }
});
</script>
