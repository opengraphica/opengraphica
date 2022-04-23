<template>
    <div v-loading="loading">
        <el-alert
            v-if="hasCameraError"
            :title="$t('module.fileTakePhoto.noCameraError.title')"
            type="warning"
            show-icon
            :closable="false">
            {{ $t('module.fileTakePhoto.noCameraError.message') }}
        </el-alert>
        <template v-else>
            <el-select v-model="facingMode" class="mx-0 mt-0 mb-2 is-fullwidth" :placeholder="$t('module.fileTakePhoto.selectCamera.placeholder')">
                <el-option key="user" value="user" :label="$t('module.fileTakePhoto.selectCamera.user')" />
                <el-option key="environment" value="environment" :label="$t('module.fileTakePhoto.selectCamera.environment')" />
            </el-select>
            <video ref="video" autoplay="true" class="is-fullwidth"></video>
            <div class="has-text-right mt-4">
                <el-button @click="onCancel">{{ $t('button.cancel') }}</el-button>
                <el-button type="primary" @click="onTake">{{ $t('button.take') }}</el-button>
            </div>
        </template>
    </div>
</template>

<script lang="ts">
/**
 * Parts of this file were adapted from miniPaint
 * @license MIT https://github.com/viliusle/miniPaint/blob/master/MIT-LICENSE.txt
 */

import { defineComponent, ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import ElAlert from 'element-plus/lib/components/alert/index';
import ElButton from 'element-plus/lib/components/button/index';
import ElLoading from 'element-plus/lib/components/loading/index';
import ElSelect, { ElOption } from 'element-plus/lib/components/select/index';
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
        ElButton,
        ElOption,
        ElSelect
    },
    emits: [
        'update:title',
        'close'
    ],
    setup(props, { emit }) {
        emit('update:title', 'module.fileTakePhoto.title');

        const $notify = notifyInjector('$notify');
        const loading = ref<boolean>(true);
        const video = ref<HTMLVideoElement>();
        const stream = ref<MediaStream | null>(null);
        const tracks = ref<MediaStreamTrack[]>();
        const activeTrack = ref<MediaStreamTrack | null>(null);
        const hasCameraError = ref<boolean>(false);
        const facingMode = ref<string>('environment');
        let videoElement: HTMLVideoElement;

        watch([facingMode], () => {
            requestStream();
        });

        onMounted(async () => {
            videoElement = video.value as HTMLVideoElement;
            await requestStream();
            loading.value = false;
        });

        onUnmounted(() => {
            stopStream();
        });

        async function requestStream() {
            stopStream();
            try {
                stream.value = await navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: {
                        facingMode: facingMode.value,
                        width: { ideal: 1920 },
                        height: { ideal: 1920 } 
                    }
                });
                tracks.value = stream.value.getTracks();
                activeTrack.value = tracks.value[0];
                videoElement.srcObject = stream.value;
            } catch (error: any) {
                hasCameraError.value = true;
            }
        }

        async function stopStream() {
            if (activeTrack.value != null){
                activeTrack.value.stop();
            }
            videoElement.pause();
            videoElement.src = '';
            videoElement.load();
        }

        function onCancel() {
            emit('close');
        }

        async function onTake() {
            videoElement.pause();
            loading.value = true;
            await nextTick();
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
                        action: new BundleAction('fileTakePhoto', 'action.fileTakePhoto', [
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
            facingMode,
            onCancel,
            onTake
        };
    }
});
</script>
