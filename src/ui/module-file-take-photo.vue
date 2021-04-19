<template>
    <div v-loading="loading">
        <el-alert
            v-if="hasCameraError"
            title="Camera Unavailable"
            type="warning"
            show-icon>
            Either the device has no cameras or access to the camera was declined.
        </el-alert>
        <template v-else>
            <video ref="video" autoplay="true" style="width: 100%"></video>
            <div class="has-text-right mt-4">
                <el-button @click="onCancel">Cancel</el-button>
                <el-button type="primary" @click="onTake">Take</el-button>
            </div>
        </template>
    </div>
</template>

<script lang="ts">
/**
 * Parts of this file were adapted from miniPaint
 * @license MIT https://github.com/viliusle/miniPaint/blob/master/MIT-LICENSE.txt
 */

import { defineComponent, ref, onMounted, onUnmounted } from 'vue';
import ElAlert from 'element-plus/lib/el-alert';
import ElButton from 'element-plus/lib/el-button';
import ElLoading from 'element-plus/lib/el-loading';
import historyStore from '@/store/history';
import workingFileStore from '@/store/working-file';
import { notifyInjector, unexpectedErrorMessage } from '@/lib/notify';
import { BundleAction } from '@/actions/bundle';
import { InsertLayerAction } from '@/actions/insert-layer';
import { UpdateFileAction } from '@/actions/update-file';

let webcamPhotoCount: number = 1;

export default defineComponent({
    name: 'ModuleFileTakePhoto',
    directives: {
        loading: ElLoading.directive
    },
    components: {
        ElAlert,
        ElButton
    },
    emits: [
        'update:title',
        'close'
    ],
    setup(props, { emit }) {
        emit('update:title', 'Take Photo');

        const $notify = notifyInjector('$notify');
        const loading = ref<boolean>(true);
        const video = ref<HTMLVideoElement>();
        const tracks = ref<MediaStreamTrack[]>();
        const activeTrack = ref<MediaStreamTrack>();
        const hasCameraError = ref<boolean>(false);
        let videoElement: HTMLVideoElement;
       
        onMounted(async () => {
            videoElement = video.value as HTMLVideoElement;
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
                tracks.value = stream.getTracks();
                activeTrack.value = tracks.value[0];
                videoElement.srcObject = stream;
            } catch (error) {
                hasCameraError.value = true;
            }
            loading.value = false;
        });

        onUnmounted(() => {
            if (activeTrack.value != null){
                activeTrack.value.stop();
            }
            videoElement.pause();
            videoElement.src = '';
            videoElement.load();
        });

        function onCancel() {
            emit('close');
        }

        async function onTake() {
            loading.value = true;
            try {
                const width = videoElement.videoWidth;
                const height = videoElement.videoHeight;
                const tmpCanvas = document.createElement('canvas');
                const tmpCanvasCtx = tmpCanvas.getContext('2d');
                if (tmpCanvasCtx) {
                    tmpCanvas.width = width;
                    tmpCanvas.height = height;
                    tmpCanvasCtx.drawImage(videoElement, 0, 0);
                    let image = new Image;
                    await new Promise<void>((resolve, reject) => {
                        image.onload = () => {
                            resolve();
                        };
                        image.onerror = () => {
                            reject();
                        }
                        image.src = tmpCanvas.toDataURL('image/png');
                    });
                    await historyStore.dispatch('runAction', {
                        action: new BundleAction('fileTakePhoto', 'Take a Photo', [
                            ...(workingFileStore.get('layers').length === 0 ? [
                                new UpdateFileAction({
                                    width,
                                    height
                                })
                            ] : []),
                            new InsertLayerAction({
                                type: 'raster',
                                name: 'Webcam #' + (webcamPhotoCount++),
                                width,
                                height,
                                data: {
                                    sourceImage: image
                                }
                            })
                        ])
                    });
                }
            } catch(error) {
                $notify({
                    type: 'error',
                    title: 'Error Occurred',
                    message: unexpectedErrorMessage
                });
            }
            loading.value = false;
            emit('close');
        }
        
        return {
            hasCameraError,
            loading,
            video,
            onCancel,
            onTake
        };
    }
});
</script>
