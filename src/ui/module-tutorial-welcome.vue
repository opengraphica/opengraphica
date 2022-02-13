<template>
    <div class="is-flex is-align-items-center is-justify-content-center" style="height:100%" v-loading="loading">
        <div>
            <div class="ogr-logo">
                <h1 class="has-text-centered">OpenGraphica</h1>
                <p class="has-text-centered">Image Editor</p>
            </div>
            <div class="is-flex is-justify-content-center mt-5">
                <div class="is-inline-block">
                    <el-button type="text" class="m-0 is-block" @click="onNewImage()">
                        <span class="bi bi-file-earmark-plus mr-2" style="font-size: 1.2rem" aria-hidden="true" />
                        Create New Image
                    </el-button>
                    <el-button type="text" class="m-0 is-block" @click="onOpenImage()">
                        <span class="bi bi-folder2-open mr-2" style="font-size: 1.2rem" aria-hidden="true" />
                        Open Image
                    </el-button>
                    <el-button type="text" class="m-0 is-block" @click="onTakePhoto()">
                        <span class="bi bi-camera mr-2" style="font-size: 1.2rem" aria-hidden="true" />
                        Take Photo
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
import { notifyInjector, unexpectedErrorMessage } from '@/lib/notify';
import { runModule } from '@/modules';

export default defineComponent({
    name: 'ModuleWelcome',
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
        emit('update:title', '');

        const $notify = notifyInjector('$notify');
        const loading = ref<boolean>(false);
       
        onMounted(async () => {
            appEmitter.on('app.workingFile.notifyImageLoadedFromClipboard', onCancel);
            appEmitter.on('app.workingFile.notifyImageLoadedFromDragAndDrop', onCancel);
        });

        onUnmounted(() => {
            appEmitter.off('app.workingFile.notifyImageLoadedFromClipboard', onCancel);
            appEmitter.off('app.workingFile.notifyImageLoadedFromDragAndDrop', onCancel);
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
