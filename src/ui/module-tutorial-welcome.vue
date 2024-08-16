<template>
    <div class="is-flex is-align-items-center is-justify-content-center" style="height:100%" v-loading="loading">
        <div>
            <div class="ogr-logo">
                <h1 class="px-6">
                    <img :src="`images/logo-full-${logoThemeColor}.svg`" alt="OpenGraphica">
                </h1>
            </div>
            <div class="is-flex is-justify-content-center mt-4">
                <div class="is-inline-block">
                    <el-button v-if="showRestoreImage" link type="primary" class="m-0 is-block" @click="onRestoreImage()">
                        <span class="bi bi-recycle mr-2" style="font-size: 1.2rem" aria-hidden="true" />
                        {{ $t('button.restoreLastImage') }}
                    </el-button>
                    <el-button link type="primary" class="m-0 is-block" @click="onNewImage()">
                        <span class="bi bi-file-earmark-plus mr-2" style="font-size: 1.2rem" aria-hidden="true" />
                        {{ $t('button.createNewImage') }}
                    </el-button>
                    <el-button link type="primary" class="m-0 is-block" @click="onOpenImage()">
                        <span class="bi bi-folder2-open mr-2" style="font-size: 1.2rem" aria-hidden="true" />
                        {{ $t('button.openImage') }}
                    </el-button>
                    <el-button link type="primary" class="m-0 is-block" @click="onTakePhoto()">
                        <span class="bi bi-camera mr-2" style="font-size: 1.2rem" aria-hidden="true" />
                        {{ $t('button.takePhoto') }}
                    </el-button>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">

import { defineComponent, computed, ref, onMounted, onUnmounted } from 'vue';
import { hasWorkingFile } from '@/store/data/working-file-database';
import ElButton from 'element-plus/lib/components/button/index';
import ElLoading from 'element-plus/lib/components/loading/index';
import appEmitter from '@/lib/emitter';
import { scheduleTutorialNotification } from '@/lib/tutorial';
import { runModule } from '@/modules';
import editorStore from '@/store/editor';
import { t, tm, rt } from '@/i18n';

export default defineComponent({
    name: 'ModuleTutorialWelcome',
    inheritAttrs: false,
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
        const showRestoreImage = ref<boolean>(false);

        const logoThemeColor = computed<string>(() => {
            return (editorStore.state.activeTheme?.name === 'dark') ? 'light' : 'dark';
        });
       
        onMounted(async () => {
            appEmitter.on('app.workingFile.notifyImageLoadedFromClipboard', onCancel);
            appEmitter.on('app.workingFile.notifyImageLoadedFromDragAndDrop', onCancel);

            if (editorStore.get('showBackupRestore')) {
                try {
                    showRestoreImage.value = await hasWorkingFile();
                } catch (error) { /* Ignore */ }
            }
        });

        onUnmounted(() => {
            appEmitter.off('app.workingFile.notifyImageLoadedFromClipboard', onCancel);
            appEmitter.off('app.workingFile.notifyImageLoadedFromDragAndDrop', onCancel);

            if (!editorStore.state.tutorialFlags.explainCanvasViewportControls) {
                let message = (tm('tutorialTip.explainCanvasViewportControls.introduction') as string[]).map((message) => {
                    return `<p class="mb-3">${rt(message, {
                        anyTool: `<strong class="has-text-weight-bold">${t('tutorialTip.explainCanvasViewportControls.anyTool')}</strong>`
                    })}</p>`;
                }).join('');
                scheduleTutorialNotification({
                    flag: 'explainCanvasViewportControls',
                    title: t('tutorialTip.explainCanvasViewportControls.title'),
                    message: {
                        touch: message + (tm('tutorialTip.explainCanvasViewportControls.body.touch') as string[]).map((message) => {
                            return `<p class="mb-3">${rt(message, {
                                zooming: `<strong class="has-text-weight-bold"><span class="bi bi-zoom-in"></span> ${t('tutorialTip.explainCanvasViewportControls.bodyTitle.zooming')}</strong>`,
                                panning: `<strong class="has-text-weight-bold"><span class="bi bi-arrows-move"></span> ${t('tutorialTip.explainCanvasViewportControls.bodyTitle.panning')}</strong>`,
                            })}</p>`
                        }).join(''),
                        mouse: message + (tm('tutorialTip.explainCanvasViewportControls.body.mouse') as string[]).map((message) => {
                            return `<p class="mb-3">${rt(message, {
                                zooming: `<strong class="has-text-weight-bold"><span class="bi bi-zoom-in"></span> ${t('tutorialTip.explainCanvasViewportControls.bodyTitle.zooming')}</strong>`,
                                panning: `<strong class="has-text-weight-bold"><span class="bi bi-arrows-move"></span> ${t('tutorialTip.explainCanvasViewportControls.bodyTitle.panning')}</strong>`,
                                mouseWheel: `<em>${t('tutorialTip.explainCanvasViewportControls.bodyTitle.mouseWheel')}</em>`,
                                rightMouseButton: `<em>${t('tutorialTip.explainCanvasViewportControls.bodyTitle.rightMouseButton')}</em>`,
                            })}</p>`
                        }).join(''),
                    }
                })
            }
        });

        async function onRestoreImage() {
            loading.value = true;
            await runModule('file', 'restoreBackup');
            editorStore.set('showBackupRestore', false);
            loading.value = false;
            onCancel();
        }

        async function onNewImage() {
            loading.value = true;
            await runModule('file', 'new');
            editorStore.set('showBackupRestore', false);
            loading.value = false;
            onCancel();
        }

        async function onOpenImage() {
            loading.value = true;
            await runModule('file', 'open');
            editorStore.set('showBackupRestore', false);
            loading.value = false;
            onCancel();
        }

        async function onTakePhoto() {
            loading.value = true;
            await runModule('file', 'takePhoto');
            editorStore.set('showBackupRestore', false);
            loading.value = false;
            onCancel();
        }

        function onCancel() {
            emit('close');
        }
        
        return {
            loading,
            showRestoreImage,
            logoThemeColor,
            onRestoreImage,
            onNewImage,
            onOpenImage,
            onTakePhoto,
            onCancel
        };
    }
});
</script>
