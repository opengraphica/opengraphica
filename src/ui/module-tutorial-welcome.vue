<template>
    <div class="is-flex is-align-items-center is-justify-content-center" style="height:100%" v-loading="loading">
        <div>
            <div class="ogr-logo">
                <h1 class="px-6">
                    <img src="images/logo-full.svg" alt="OpenGraphica">
                </h1>
            </div>
            <div class="is-flex is-justify-content-center mt-4">
                <div class="is-inline-block">
                    <el-button type="text" class="m-0 is-block" @click="onNewImage()">
                        <span class="bi bi-file-earmark-plus mr-2" style="font-size: 1.2rem" aria-hidden="true" />
                        {{ $t('button.createNewImage') }}
                    </el-button>
                    <el-button type="text" class="m-0 is-block" @click="onOpenImage()">
                        <span class="bi bi-folder2-open mr-2" style="font-size: 1.2rem" aria-hidden="true" />
                        {{ $t('button.openImage') }}
                    </el-button>
                    <el-button type="text" class="m-0 is-block" @click="onTakePhoto()">
                        <span class="bi bi-camera mr-2" style="font-size: 1.2rem" aria-hidden="true" />
                        {{ $t('button.takePhoto') }}
                    </el-button>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">

import { defineComponent, ref, onMounted, onUnmounted } from 'vue';
import ElButton from 'element-plus/lib/components/button/index';
import ElLoading from 'element-plus/lib/components/loading/index';
import appEmitter from '@/lib/emitter';
import { scheduleTutorialNotification } from '@/lib/tutorial';
import { runModule } from '@/modules';
import editorStore from '@/store/editor';

export default defineComponent({
    name: 'ModuleTutorialWelcome',
    directives: {
        loading: ElLoading.directive
    },
    components: {
        ElButton
    },
    emits: [
        'update:title',
        'close'
    ],
    setup(props, { emit }) {
        emit('update:title', 'empty');

        const loading = ref<boolean>(false);
       
        onMounted(async () => {
            appEmitter.on('app.workingFile.notifyImageLoadedFromClipboard', onCancel);
            appEmitter.on('app.workingFile.notifyImageLoadedFromDragAndDrop', onCancel);
        });

        onUnmounted(() => {
            appEmitter.off('app.workingFile.notifyImageLoadedFromClipboard', onCancel);
            appEmitter.off('app.workingFile.notifyImageLoadedFromDragAndDrop', onCancel);

            if (!editorStore.state.tutorialFlags.explainCanvasViewportControls) {
                let message = `
                    <p class="mb-3">No matter which tool is selected, you can control the canvas view.</p>
                    <p class="mb-3">When <strong class="has-text-weight-bold">any tool</strong> is selected:</p>
                `;
                scheduleTutorialNotification({
                    flag: 'explainCanvasViewportControls',
                    title: 'Moving the Canvas',
                    message: {
                        touch: message + `
                            <p class="mb-3"><strong class="has-text-weight-bold"><span class="bi bi-zoom-in"></span> Zooming</strong> - Use two fingers and pinch to zoom in and out.</p>
                            <p><strong class="has-text-weight-bold"><span class="bi bi-arrows-move"></span> Panning</strong> - Use two fingers and slide them together to move the canvas.</p>
                        `,
                        mouse: message + `
                            <p class="mb-3"><strong class="has-text-weight-bold"><span class="bi bi-zoom-in"></span> Zooming</strong> - Use the <em>Mouse Wheel</em> to zoom in and out.</p>
                            <p><strong class="has-text-weight-bold"><span class="bi bi-arrows-move"></span> Panning</strong> - Click and drag with the <em>Right Mouse Button</em> to move the canvas.</p>
                        `
                    }
                })
            }
        });

        async function onNewImage() {
            loading.value = true;
            await runModule('file', 'new');
            loading.value = false;
            onCancel();
        }

        async function onOpenImage() {
            loading.value = true;
            await runModule('file', 'open');
            loading.value = false;
            onCancel();
        }

        async function onTakePhoto() {
            loading.value = true;
            await runModule('file', 'takePhoto');
            loading.value = false;
            onCancel();
        }

        function onCancel() {
            emit('close');
        }
        
        return {
            loading,
            onNewImage,
            onOpenImage,
            onTakePhoto,
            onCancel
        };
    }
});
</script>
