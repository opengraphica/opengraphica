<template>
    <div ref="canvasArea" class="og-canvas-area" :class="{ 'og-canvas-area--loading': loading }">
        <div v-if="useCanvasBackground" ref="canvasBackground" class="og-canvas-background"></div>
        <div ref="canvasContainer" class="og-canvas-container">
            <canvas ref="canvas" class="og-canvas" />
        </div>
        <overlay ref="canvasOverlays" :css-view-transform="cssViewTransform" />
        <div v-if="loading" v-loading="true" class="og-canvas-area__loading-animation"></div>
    </div>
</template>

<script lang="ts">
import {
    computed, defineComponent, inject, onMounted,
    onUnmounted, ref, toRefs, watch, type Ref
} from 'vue';

import { t } from '@/i18n';

import canvasStore from '@/store/canvas';
import editorStore, { cssViewTransform } from '@/store/editor';
import workingFileStore from '@/store/working-file';
import preferencesStore from '@/store/preferences';

import Overlay from '@/ui/overlay/overlay.vue';
import ElLoading from 'element-plus/lib/components/loading/index';

import { notifyInjector } from '@/lib/notify';
import appEmitter, { AppEmitterEvents } from '@/lib/emitter';
import { DecomposedMatrix } from '@/lib/dom-matrix';
import { isWebGLAvailable } from '@/lib/webgl';

import { useAppPreloadBlocker } from '@/composables/app-preload-blocker';
import { useCanvas2dViewport } from '@/composables/canvas2d-viewport';
import { useViewportCommon } from '@/composables/viewport-common';
import { useThreejsViewport } from '@/composables/threejs-viewport';
import { useRenderer } from '@/renderers';

import type { RendererFrontend } from '@/types';

export default defineComponent({
    name: 'AppCanvas',
    directives: {
        loading: ElLoading.directive
    },
    components: {
        Overlay
    },
    setup(props, { emit }) {
        const $notify = notifyInjector('$notify');

        const { loading } = useAppPreloadBlocker();

        const rootElement = inject<Ref<Element>>('rootElement');
        const mainElement = inject<Ref<Element>>('mainElement');
        const canvas = ref<HTMLCanvasElement>();
        const canvasBackground = ref<HTMLDivElement>();
        const canvasArea = ref<HTMLDivElement>();
        const canvasContainer = ref<HTMLDivElement>();
        const canvasOverlays = ref<HTMLDivElement>();
        const { viewWidth: viewportWidth, viewHeight: viewportHeight } = toRefs(canvasStore.state);
        const { width: imageWidth, height: imageHeight } = toRefs(workingFileStore.state);

        let rendererFrontend: RendererFrontend | undefined;

        useViewportCommon({ canvasArea, loading, mainElement });

        const useCanvasBackground = computed<boolean>(() => {
            return !workingFileStore.state.background.visible || workingFileStore.state.background.color.alpha < 1;
        });

        const hasCanvasOverlays = computed<boolean>(() => {
            return editorStore.state.activeToolOverlays.length > 0;
        });

        canvasStore.set('workingImageBorderColor', getComputedStyle(document.documentElement).getPropertyValue('--og-working-image-border-color'));

        // Update canvas on browser window resize
        watch([viewportWidth, viewportHeight], ([newWidth, newHeight]) => {
            const canvasElement = canvas.value;
            if (canvasElement) {
                canvasElement.width = newWidth;
                canvasElement.height = newHeight;
            }
            canvasStore.set('viewDirty', true);
        });

        // Update canvas on working file resize
        watch([imageWidth, imageHeight], async ([newWidth, newHeight]) => {
            const bufferCanvas = canvasStore.get('bufferCanvas');
            bufferCanvas.width = newWidth;
            bufferCanvas.height = newHeight;

            canvasStore.set('dirty', true);
        });

        watch(() => canvasStore.state.viewDirty, (viewDirty) => {
            if (!viewDirty) return;
            if (hasCanvasOverlays.value) {
                let decomposedTransform: DecomposedMatrix = null as any;
                const devicePixelRatio = window.devicePixelRatio || 1;
                const transform = canvasStore.get('transform');
                decomposedTransform = canvasStore.get('decomposedTransform');
                const offsetX = transform.e / decomposedTransform.scaleX;
                const offsetY = transform.f / decomposedTransform.scaleX;
                const pixelRatioTransform = transform
                    .rotate(-decomposedTransform.rotation * Math.RADIANS_TO_DEGREES)
                    .translate(-offsetX, -offsetY)
                    .scale(1 / devicePixelRatio, 1 / devicePixelRatio)
                    .translate(offsetX, offsetY)
                    .rotate(decomposedTransform.rotation * Math.RADIANS_TO_DEGREES);
                cssViewTransform.value = `matrix(${pixelRatioTransform.a},${pixelRatioTransform.b},${pixelRatioTransform.c},${pixelRatioTransform.d},${pixelRatioTransform.e},${pixelRatioTransform.f})`;
            }
        });

        onMounted(async () => {
            if (canvas.value) {

                // Set up canvas width/height based on view
                if (rootElement?.value) {
                    canvasStore.set('viewWidth', rootElement.value.clientWidth * (window.devicePixelRatio || 1));
                    canvasStore.set('viewHeight', rootElement.value.clientHeight * (window.devicePixelRatio || 1));
                }
                canvas.value.width = viewportWidth.value;
                canvas.value.height = viewportHeight.value;

                // Set up renderer
                useRenderer('webgl2').then((frontend) => {
                    rendererFrontend = frontend;
                    frontend.initialize(canvas.value!).then(() => {
                        loading.value = false;
                        appEmitter.emit('app.canvas.ready');
                    }).catch(() => {
                        loading.value = false;
                        appEmitter.emit('app.notify', {
                            title: t('app.renderer.initializeFailed.title'),
                            message: t('app.renderer.initializeFailed.message'),
                            duration: 0,
                        });
                    });
                });
            }
        });

        return {
            loading,
            canvas,
            canvasArea,
            canvasBackground,
            canvasContainer,
            canvasOverlays,
            cssViewTransform,
            useCanvasBackground,
        };
    }
});
</script>
