<template>
    <div ref="canvasArea" class="ogr-canvas-area">
        <div ref="canvasContainer" class="ogr-canvas-container" :class="{ 'ogr-canvas-viewport-css': useCssViewport, 'ogr-canvas-viewport-css--pixelated': isPixelatedZoomLevel }">
            <canvas ref="canvas" class="ogr-canvas" />
            <canvas v-if="usePostProcess" ref="postProcessCanvas" class="ogr-post-process-canvas" />
        </div>
        <canvas ref="selectionMaskCanvas" class="ogr-canvas-selection-mask" />
        <app-canvas-overlays ref="canvasOverlays" />
        <app-canvas-overlays :ignore-transform="true" />
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, Ref, computed, watch, inject, toRefs, onMounted, onUnmounted, nextTick } from 'vue';
import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import workingFileStore from '@/store/working-file';
import preferencesStore from '@/store/preferences';
import { appliedSelectionMask, appliedSelectionMaskCanvasOffset } from '@/canvas/store/selection-state';
import AppCanvasOverlays from '@/ui/app-canvas-overlays.vue';
import { CanvasRenderingContext2DEnhanced } from '@/types';
import { drawWorkingFileToCanvas, trackCanvasTransforms } from '@/lib/canvas';
import { notifyInjector } from '@/lib/notify';
import appEmitter, { AppEmitterEvents } from '@/lib/emitter';
import { DecomposedMatrix } from '@/lib/dom-matrix';

export default defineComponent({
    name: 'AppCanvas',
    components: {
        AppCanvasOverlays
    },
    setup(props, { emit }) {
        let Pica: any; // Can't import type definitions from dynamic modules imported later, wtf typescript!
        let pica: any; // Can't import type definitions from dynamic modules imported later, wtf typescript!
        let isPicaSingleThreaded: boolean = false;
        const $notify = notifyInjector('$notify');

        const rootElement = inject<Ref<Element>>('rootElement');
        const mainElement = inject<Ref<Element>>('mainElement');
        const canvas = ref<HTMLCanvasElement>();
        const selectionMaskCanvas = ref<HTMLCanvasElement>();
        let selectionMaskCanvasCtx: CanvasRenderingContext2D | null = null;
        const selectionMaskPattern = new Image();
        const postProcessCanvas = ref<HTMLCanvasElement>();
        const canvasArea = ref<HTMLDivElement>();
        const canvasContainer = ref<HTMLDivElement>();
        const canvasOverlays = ref<HTMLDivElement>();
        const { useCssViewport, viewWidth: viewportWidth, viewHeight: viewportHeight } = toRefs(canvasStore.state);
        const { width: imageWidth, height: imageHeight } = toRefs(workingFileStore.state);
        const isPixelatedZoomLevel = ref<boolean>(false);
        let ctx: CanvasRenderingContext2DEnhanced | null = null;

        let postProcessCancel: ((reason?: any) => void) | null = null;
        let postProcessAverageLag: number = 0;
        let drawPostProcessTimeoutHandle: number | undefined;
        let lastCssDecomposedScale: number = 1;
        const drawPostProcessWait: number = 100;
        const usePostProcess = computed<boolean>(() => {
            return preferencesStore.state.postProcessInterpolateImage && !preferencesStore.state.useCanvasViewport && canvasStore.state.decomposedTransform.scaleX < 1;
        });

        const hasCanvasOverlays = computed<boolean>(() => {
            return editorStore.state.activeToolOverlays.length > 0;
        });

        canvasStore.set('workingImageBorderColor', getComputedStyle(document.documentElement).getPropertyValue('--ogr-working-image-border-color'));

        watch([useCssViewport], ([isUseCssViewport]) => {
            const canvasElement = canvasStore.get('viewCanvas');
            const bufferCanvas = canvasStore.get('bufferCanvas');
            if (isUseCssViewport) {
                canvasElement.width = workingFileStore.get('width');
                canvasElement.height = workingFileStore.get('height');
                if (postProcessCanvas.value) {
                    postProcessCanvas.value.style.display = 'block';
                    postProcessCanvas.value.width = canvasElement.width;
                    postProcessCanvas.value.height = canvasElement.height;
                }
                bufferCanvas.width = 1;
                bufferCanvas.height = 1;
            } else {
                (canvasContainer.value as HTMLDivElement).style.transform = '';
                canvasElement.width = viewportWidth.value;
                canvasElement.height = viewportHeight.value;
                if (postProcessCanvas.value) {
                    postProcessCanvas.value.style.display = 'none';
                }
                bufferCanvas.width = workingFileStore.get('width');
                bufferCanvas.height = workingFileStore.get('height');
            }
            canvasStore.set('dirty', true);
        });

        watch([viewportWidth, viewportHeight], ([newWidth, newHeight]) => {
            const canvasElement = canvas.value;
            if (canvasElement) {
                if (useCssViewport.value === false) {
                    canvasElement.width = newWidth;
                    canvasElement.height = newHeight;
                }
                if (ctx) {
                    drawWorkingFileToCanvas(canvasElement, ctx);
                }
            }
        });

        watch([imageWidth, imageHeight], ([newWidth, newHeight]) => {
            const canvasElement = canvasStore.get('viewCanvas');
            const bufferCanvas = canvasStore.get('bufferCanvas');
            if (useCssViewport.value === true) {
                canvasElement.width = newWidth;
                canvasElement.height = newHeight;
                if (postProcessCanvas.value) {
                    postProcessCanvas.value.width = canvasElement.width;
                    postProcessCanvas.value.height = canvasElement.height;
                }
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
                const imageWidth = workingFileStore.get('width');
                const imageHeight = workingFileStore.get('height');

                if (rootElement?.value) {
                    canvasStore.set('viewWidth', rootElement.value.clientWidth * (window.devicePixelRatio || 1));
                    canvasStore.set('viewHeight', rootElement.value.clientHeight * (window.devicePixelRatio || 1));
                }
                if (useCssViewport.value === false) {
                    canvas.value.width = viewportWidth.value;
                    canvas.value.height = viewportHeight.value;
                    if (postProcessCanvas.value) {
                        postProcessCanvas.value.style.display = 'none';
                    }
                } else {
                    canvas.value.width = imageWidth;
                    canvas.value.height = imageHeight;
                    if (postProcessCanvas.value) {
                        postProcessCanvas.value.style.display = 'block';
                        postProcessCanvas.value.width = imageWidth;
                        postProcessCanvas.value.height = imageHeight;
                    }
                }

                appEmitter.on('app.canvas.resetTransform', resetTransform);

                const originalCtx = canvas.value.getContext('2d');
                const bufferCanvas = document.createElement('canvas');
                bufferCanvas.width = useCssViewport.value === true ? 10 : imageWidth;
                bufferCanvas.height = useCssViewport.value === true ? 10 : imageHeight;
                let bufferCtx: CanvasRenderingContext2DEnhanced = bufferCanvas.getContext('2d') as CanvasRenderingContext2DEnhanced;
                if (originalCtx && bufferCtx) {
                    // Assign view canvas
                    ctx = trackCanvasTransforms(originalCtx);
                    canvasStore.set('viewCanvas', canvas.value);
                    canvasStore.set('viewCtx', ctx);
                    // Assign buffer canvas
                    bufferCtx = trackCanvasTransforms(bufferCtx);
                    canvasStore.set('bufferCanvas', bufferCanvas);
                    canvasStore.set('bufferCtx', bufferCtx);
                    drawLoop();
                }

                Pica = (await import('@/lib/pica')).default;
                const __extractTileData = Pica.prototype.__extractTileData;
                Pica.prototype.__extractTileData = function() {
                    const startTime = window.performance.now();
                    const originalReturn = __extractTileData.apply(this, arguments);
                    postProcessAverageLag = (postProcessAverageLag * .75) + ((window.performance.now() - startTime) * .25);
                    return originalReturn;
                };
                pica = new Pica({
                    idle: 20000
                });
            }
            if (selectionMaskCanvas.value) {
                canvasStore.set('selectionMaskCanvas', selectionMaskCanvas.value);
                selectionMaskCanvasCtx = selectionMaskCanvas.value.getContext('2d');
                selectionMaskPattern.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAABg2lDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV/TiiIVh3YQcchQnVoQFXHUKhShQqgVWnUwufQLmjQkKS6OgmvBwY/FqoOLs64OroIg+AHi6OSk6CIl/i8ptIjx4Lgf7+497t4BQrPKNCs0Dmi6bWZSSTGXXxV7XyEgghDiCMjMMuYkKQ3f8XWPAF/vEjzL/9yfY0AtWAwIiMSzzDBt4g3i6U3b4LxPHGVlWSU+J46bdEHiR64rHr9xLrks8Myomc3ME0eJxVIXK13MyqZGPEUcUzWd8oWcxyrnLc5atc7a9+QvDBf0lWWu0xxBCotYggQRCuqooAobCVp1UixkaD/p4x92/RK5FHJVwMixgBo0yK4f/A9+d2sVJye8pHAS6HlxnI9RoHcXaDUc5/vYcVonQPAZuNI7/loTmPkkvdHRYkfA4DZwcd3RlD3gcgcYejJkU3alIE2hWATez+ib8kDkFuhf83pr7+P0AchSV+kb4OAQGCtR9rrPu/u6e/v3TLu/Hx5FcoXj45C+AAAABmJLR0QATgBOAE714JEKAAAACXBIWXMAAC4jAAAuIwF4pT92AAAAB3RJTUUH5gITBDkEOkUYUQAAABl0RVh0Q29tbWVudABDcmVhdGVkIHdpdGggR0lNUFeBDhcAAAAtSURBVAjXY/z//383AxT4+/szMCFzNm7cCBGAcRgYGBiYz58/7wbjMDAwMAAAGKUPRK2REh8AAAAASUVORK5CYII=';
            }
        });

        onUnmounted(() => {
            appEmitter.off('app.canvas.resetTransform', resetTransform);
        });

        // Centers the canvas and displays at 1x zoom or the maximum width/height of the window, whichever is smaller. 
        async function resetTransform(event?: AppEmitterEvents['app.canvas.resetTransform']) {
            appEmitter.emit('app.canvas.calculateDndArea');
            const margin: number = (event && event.margin) || 48;
            if (canvasArea.value && ctx && mainElement) {
                const devicePixelRatio = window.devicePixelRatio || 1;
                const canvasAreaRect = canvasArea.value.getBoundingClientRect();
                const mainRect = mainElement.value.getBoundingClientRect();
                const imageWidth = workingFileStore.get('width');
                const imageHeight = workingFileStore.get('height');
                let scaledWidth = imageWidth;
                let scaledHeight = imageHeight;
                const imageSizeRatio = imageWidth / imageHeight;
                const widthToDisplayRatio = imageWidth / (canvasStore.get('dndAreaWidth') / devicePixelRatio - margin) / devicePixelRatio;
                const heightToDisplayRatio = imageHeight / (canvasStore.get('dndAreaHeight') / devicePixelRatio - margin) / devicePixelRatio;
                if (widthToDisplayRatio > 1 && widthToDisplayRatio > heightToDisplayRatio) {
                    scaledWidth = imageWidth / widthToDisplayRatio;
                    scaledHeight = scaledWidth / imageSizeRatio;
                } else if (heightToDisplayRatio > 1 && heightToDisplayRatio > widthToDisplayRatio) {
                    scaledHeight = imageHeight / heightToDisplayRatio;
                    scaledWidth = scaledHeight * imageSizeRatio;
                }
                const centerX = canvasStore.get('dndAreaLeft') + (canvasStore.get('dndAreaWidth') / 2);
                const centerY = canvasStore.get('dndAreaTop') + (canvasStore.get('dndAreaHeight') / 2);
                const transform = new DOMMatrix();
                transform.translateSelf(Math.round(centerX - (scaledWidth / 2)), Math.round(centerY - (scaledHeight / 2)));
                if (widthToDisplayRatio > 1 || heightToDisplayRatio > 1) {
                    const scaleRatio = (widthToDisplayRatio > heightToDisplayRatio ? 1 / widthToDisplayRatio : 1 / heightToDisplayRatio);
                    transform.scaleSelf(scaleRatio, scaleRatio);
                }
                canvasStore.set('transform', transform);
                canvasStore.set('viewDirty', true);
                canvasStore.set('transformResetOptions', event || true);
            }
        }

        function drawLoop() {
            const canvasElement = canvas.value;
            try {
                const isViewDirty = canvasStore.get('viewDirty');
                const isPlayingAnimation = canvasStore.get('playingAnimation');

                let cssViewTransform: string = '';
                let decomposedTransform: DecomposedMatrix = null as any;
                if (isViewDirty && (useCssViewport.value === true || hasCanvasOverlays)) {
                    const devicePixelRatio = window.devicePixelRatio;
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
                    cssViewTransform = `matrix(${pixelRatioTransform.a},${pixelRatioTransform.b},${pixelRatioTransform.c},${pixelRatioTransform.d},${pixelRatioTransform.e},${pixelRatioTransform.f})`;
                }

                if (isViewDirty) {
                    canvasStore.set('viewDirty', false);
                    if (useCssViewport.value === true) {
                        clearTimeout(drawPostProcessTimeoutHandle);

                        (canvasContainer.value as HTMLDivElement).style.transform = cssViewTransform;

                        // Post process for better pixel interpolation
                        if (postProcessCanvas.value) {
                            if (decomposedTransform.scaleX >= 1) {
                                postProcessCanvas.value.style.display = 'none';
                            }
                            else if (decomposedTransform.scaleX !== lastCssDecomposedScale) {
                                if (canvasStore.get('preventPostProcess')) {
                                    cancelPostProcess();
                                } else {
                                    drawPostProcess();
                                    lastCssDecomposedScale = decomposedTransform.scaleX;
                                }
                            }
                        }
                    } else if (canvasElement && ctx) {
                        drawWorkingFileToCanvas(canvasElement, ctx);

                        // Hide post process canvas
                        if (postProcessCanvas.value) {
                            postProcessCanvas.value.style.display = 'none';
                        }
                    }

                    // Update overlay transform
                    if (hasCanvasOverlays && canvasOverlays.value) {
                        (canvasOverlays.value as any).$el.style.transform = cssViewTransform;
                    }

                    // Draw selection mask
                    if (selectionMaskCanvas.value && selectionMaskCanvasCtx) {
                        selectionMaskCanvas.value.width = viewportWidth.value;
                        selectionMaskCanvas.value.height = viewportHeight.value;
                        selectionMaskCanvasCtx.clearRect(0, 0, selectionMaskCanvas.value.width, selectionMaskCanvas.value.height);
                        if (appliedSelectionMask.value) {
                            const transform = canvasStore.get('transform');
                            selectionMaskCanvasCtx.globalCompositeOperation = 'source-over';
                            selectionMaskCanvasCtx.save();
                            selectionMaskCanvasCtx.setTransform(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f);
                            selectionMaskCanvasCtx.drawImage(appliedSelectionMask.value, appliedSelectionMaskCanvasOffset.value.x, appliedSelectionMaskCanvasOffset.value.y);
                            selectionMaskCanvasCtx.restore();
                            selectionMaskCanvasCtx.globalCompositeOperation = 'source-out';
                            const pattern = selectionMaskCanvasCtx.createPattern(selectionMaskPattern, 'repeat') || '#00000044';
                            selectionMaskCanvasCtx.fillStyle = pattern;
                            selectionMaskCanvasCtx.fillRect(0, 0, selectionMaskCanvas.value.width, selectionMaskCanvas.value.height);
                        }
                    }
                }
                if ((canvasStore.get('dirty') || isPlayingAnimation) && canvasElement && ctx) {
                    canvasStore.set('dirty', false);

                    if (isPlayingAnimation) {
                        const now = performance.now();
                        const { timelinePlayStartTime, timelineStart, timelineEnd } = editorStore.state;
                        const timelineRange = timelineEnd - timelineStart;
                        const cursor = ((now - timelinePlayStartTime) % timelineRange) + timelineStart;
                        editorStore.dispatch('setTimelineCursor', cursor);
                    }

                    drawWorkingFileToCanvas(canvasElement, ctx);

                    // Post process for better pixel interpolation
                    if (postProcessCanvas.value) {
                        postProcessCanvas.value.style.display = 'none';
                        if (canvasStore.get('preventPostProcess')) {
                            cancelPostProcess();
                        } else {
                            drawPostProcess();
                        }
                    }
                }
            } catch (error: any) {
                if (preferencesStore.get('useCanvasViewport') === false && (error || '').toString().includes('NS_ERROR_FAILURE')) {
                    clearTimeout(drawPostProcessTimeoutHandle);
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

        function drawPostProcess() {
            if (canvasStore.get('playingAnimation')) {
                return;
            }
            const canvasElement = canvas.value;
            const postProcessCanvasElement = postProcessCanvas.value;
            if (pica && canvasElement && postProcessCanvasElement) {
                postProcessCanvasElement.style.display = 'none';
                clearTimeout(drawPostProcessTimeoutHandle);
                if (postProcessCancel) {
                    postProcessCancel();
                    postProcessCancel = null;
                }
                drawPostProcessTimeoutHandle = window.setTimeout(() => {
                    const decomposedTransform = canvasStore.get('decomposedTransform');
                    postProcessCanvasElement.width = Math.floor(canvasElement.width * decomposedTransform.scaleX);
                    postProcessCanvasElement.height = Math.floor(canvasElement.height * decomposedTransform.scaleX);
                    let postProcessCancelPromise = new Promise((resolve, reject) => { postProcessCancel = reject });
                    pica.resize(canvasElement, postProcessCanvasElement, {
                        cancelToken: postProcessCancelPromise
                    }).then(() => {
                        postProcessCanvasElement.style.display = 'block';
                        postProcessCanvasElement.style.transform = `scale(${1 / decomposedTransform.scaleX})`;
                        adjustPostProcess();
                    }).catch(() => {
                        postProcessCanvasElement.style.display = 'none';
                        adjustPostProcess();
                    });
                    
                }, drawPostProcessWait);
            }
        }

        function cancelPostProcess() {
            lastCssDecomposedScale = -1;
            if (postProcessCanvas.value) {
                postProcessCanvas.value.style.display = 'none';
                postProcessCanvas.value.width = 1;
                postProcessCanvas.value.height = 1;
            }
            clearTimeout(drawPostProcessTimeoutHandle);
            if (postProcessCancel) {
                postProcessCancel();
                postProcessCancel = null;
            }
        }

        // Check if Pica chunking performance in main thread is unacceptably slow and handle appropriately.
        function adjustPostProcess() {
            if (postProcessAverageLag > 5) {
                if (isPicaSingleThreaded) {
                    preferencesStore.set('postProcessInterpolateImage', false);
                    $notify({
                        type: 'info',
                        message: 'High quality scaling is slowing down the viewport. It was automatically disabled.'
                    });
                } else {
                    console.warn('[WARNING] Pica main thread process took too long, defaulting to single thread.');
                    postProcessAverageLag = 0;
                    isPicaSingleThreaded = true;
                    pica = new Pica({
                        concurrency: 1
                    });
                }
            }
        }

        return {
            canvas,
            canvasArea,
            canvasContainer,
            canvasOverlays,
            selectionMaskCanvas,
            postProcessCanvas,
            isPixelatedZoomLevel,
            usePostProcess,
            useCssViewport
        };
    }
});
</script>
