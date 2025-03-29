<template>
    <div ref="canvasArea" class="og-canvas-area" :class="{ 'og-canvas-area--loading': loading }">
        <div v-if="useCanvasBackground" ref="canvasBackground" class="og-canvas-background"></div>
        <div ref="canvasContainer" class="og-canvas-container" :class="{ 'og-canvas-viewport-css': useCssViewport, 'og-canvas-viewport-css--pixelated': isPixelatedZoomLevel }">
            <canvas ref="canvas" class="og-canvas" />
        </div>
        <canvas ref="selectionMaskCanvas" class="og-canvas-selection-mask" />
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
        const isPixelatedZoomLevel = ref<boolean>(false);

        let renderer: typeof canvasStore.state.renderer = '2d';
        const preferredRenderer = preferencesStore.get('renderer');
        if (preferredRenderer === 'webgl' && isWebGLAvailable()) {
            renderer = 'webgl';
        }
        const {
            ctx,
            initializeRenderer,
            renderCanvas,
            updateRendererForDirtyViewport,
            selectionMaskCanvas,
        } = (renderer === 'webgl' ? useThreejsViewport({ canvas }) : useCanvas2dViewport({ canvas }));

        useViewportCommon({ canvasArea, loading, mainElement, renderCanvas });

        const useCssViewport = computed<boolean>(() => {
            return canvasStore.state.useCssViewport;
        });

        const useCanvasBackground = computed<boolean>(() => {
            return !workingFileStore.state.background.visible || workingFileStore.state.background.color.alpha < 1;
        });

        const hasCanvasOverlays = computed<boolean>(() => {
            return editorStore.state.activeToolOverlays.length > 0;
        });

        canvasStore.set('workingImageBorderColor', getComputedStyle(document.documentElement).getPropertyValue('--og-working-image-border-color'));

        // Toggle between CSS and 2D canvas-rendered viewport
        watch([useCssViewport], ([isUseCssViewport]) => {
            const canvasElement = canvasStore.get('viewCanvas');
            const bufferCanvas = canvasStore.get('bufferCanvas');
            if (isUseCssViewport) {
                canvasElement.width = workingFileStore.get('width');
                canvasElement.height = workingFileStore.get('height');
                bufferCanvas.width = 1;
                bufferCanvas.height = 1;
            } else {
                (canvasContainer.value as HTMLDivElement).style.transform = '';
                canvasElement.width = viewportWidth.value;
                canvasElement.height = viewportHeight.value;
                bufferCanvas.width = workingFileStore.get('width');
                bufferCanvas.height = workingFileStore.get('height');
            }
            canvasStore.set('dirty', true);
        });

        // Update canvas on browser window resize
        watch([viewportWidth, viewportHeight], ([newWidth, newHeight]) => {
            const canvasElement = canvas.value;
            if (canvasElement) {
                if (useCssViewport.value === false) {
                    canvasElement.width = newWidth;
                    canvasElement.height = newHeight;
                }
                renderCanvas();
            }
            canvasStore.set('viewDirty', true);
        });

        // Update canvas on working file resize
        watch([imageWidth, imageHeight], async ([newWidth, newHeight]) => {
            const canvasElement = canvasStore.get('viewCanvas');
            const bufferCanvas = canvasStore.get('bufferCanvas');
            if (useCssViewport.value === true) {
                canvasElement.width = newWidth;
                canvasElement.height = newHeight;
                bufferCanvas.width = 10;    
                bufferCanvas.height = 10;    
            } else {
                bufferCanvas.width = newWidth;
                bufferCanvas.height = newHeight;
            }

            canvasStore.set('dirty', true);
        });

        onMounted(async () => {
            if (canvas.value) {

                // Set up canvas width/height based on view
                if (rootElement?.value) {
                    canvasStore.set('viewWidth', rootElement.value.clientWidth * (window.devicePixelRatio || 1));
                    canvasStore.set('viewHeight', rootElement.value.clientHeight * (window.devicePixelRatio || 1));
                }
                if (useCssViewport.value === false) {
                    canvas.value.width = viewportWidth.value;
                    canvas.value.height = viewportHeight.value;
                } else {
                    canvas.value.width = imageWidth.value;
                    canvas.value.height = imageHeight.value;
                }

                // Set up renderer
                let renderer: typeof canvasStore.state.renderer = '2d';
                const preferredRenderer = preferencesStore.get('renderer');
                if (preferredRenderer === 'webgl' && isWebGLAvailable()) {
                    renderer = 'webgl';
                }

                try {
                    await initializeRenderer();
                } catch (error) {
                    appEmitter.emit('app.notify', {
                        title: t('app.renderer.initializeFailed.title'),
                        message: t('app.renderer.initializeFailed.message'),
                        duration: 0,
                    });
                }

                ctx.value && canvasStore.set('viewCtx', ctx.value);
                canvasStore.set('viewCanvas', canvas.value);

                drawLoop();
            }

            loading.value = false;
            appEmitter.emit('app.canvas.ready');
        });


        function drawLoop() {
            try {
                const isViewDirty = canvasStore.get('viewDirty');
                const isPlayingAnimation = canvasStore.get('playingAnimation');

                let decomposedTransform: DecomposedMatrix = null as any;
                if (isViewDirty && (useCssViewport.value === true || hasCanvasOverlays)) {
                    const devicePixelRatio = window.devicePixelRatio || 1;
                    const transform = canvasStore.get('transform');
                    decomposedTransform = canvasStore.get('decomposedTransform');
                    isPixelatedZoomLevel.value = decomposedTransform.scaleX / devicePixelRatio >= 1.25;
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

                if (isViewDirty) {
                    canvasStore.set('viewDirty', false);
                    if (useCssViewport.value === true) {
                        (canvasContainer.value as HTMLDivElement).style.transform = cssViewTransform.value;
                    } else {
                        renderCanvas();
                    }

                    // Update background transform
                    if (canvasBackground.value) {
                        canvasBackground.value.style.width = imageWidth.value + 'px';
                        canvasBackground.value.style.height = imageHeight.value + 'px';
                        canvasBackground.value.style.transform = cssViewTransform.value;
                        canvasBackground.value.style.backgroundSize = (16 * 1 / decomposedTransform.scaleX) + 'px';
                    }

                    updateRendererForDirtyViewport();
                }

                if ((canvasStore.get('dirty') || isPlayingAnimation)) {
                    canvasStore.set('dirty', false);
                    canvasStore.set('drawing', true);

                    if (isPlayingAnimation) {
                        const now = performance.now();
                        const { timelinePlayStartTime, timelineStart, timelineEnd } = editorStore.state;
                        const timelineRange = timelineEnd - timelineStart;
                        const cursor = ((now - timelinePlayStartTime) % timelineRange) + timelineStart;
                        editorStore.dispatch('setTimelineCursor', cursor);
                    }

                    renderCanvas();

                    canvasStore.set('drawing', false);
                }
            } catch (error: any) {
                if (preferencesStore.get('useCanvasViewport') === false && (error || '').toString().includes('NS_ERROR_FAILURE')) {
                    preferencesStore.set('useCanvasViewport', true);
                    canvasStore.set('useCssViewport', false);
                    canvasStore.set('viewDirty', false);
                    canvasStore.set('dirty', false);
                    $notify({
                        type: 'info',
                        message: 'Switching viewport to optimize for large images. Some features such as high quality scaling are disabled.'
                    });
                } else {
                    canvasStore.set('viewDirty', false);
                    canvasStore.set('dirty', false);
                    $notify({
                        type: 'error',
                        title: 'Can\'t Draw Image',
                        message: 'The image could be too large or some other error could have occurred.'
                    });
                }
            }
            requestAnimationFrame(drawLoop);
        }

        return {
            loading,
            canvas,
            canvasArea,
            canvasBackground,
            canvasContainer,
            canvasOverlays,
            cssViewTransform,
            selectionMaskCanvas,
            isPixelatedZoomLevel,
            useCanvasBackground,
            useCssViewport,
        };
    }
});
</script>
