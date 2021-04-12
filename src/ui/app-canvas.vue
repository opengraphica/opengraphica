<template>
    <div ref="canvasArea" class="ogr-canvas-area">
        <div ref="canvasContainer" class="ogr-canvas-container" :class="{ 'ogr-canvas-viewport-css': useCssViewport, 'ogr-canvas-viewport-css--pixelated': isPixelatedZoomLevel }">
            <canvas ref="canvas" class="ogr-canvas" />
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, Ref, computed, watch, inject, toRefs, onMounted, onUnmounted } from 'vue';
import canvasStore from '@/store/canvas';
import workingFileStore from '@/store/working-file';
import preferencesStore from '@/store/preferences';
import { CanvasRenderingContext2DEnhanced } from '@/types';
import { drawWorkingFileToCanvas,  trackCanvasTransforms } from '@/lib/canvas';
import appEmitter from '@/lib/emitter';

export default defineComponent({
    name: 'AppCanvas',
    setup(props, { emit }) {
        const rootElement = inject<Ref<Element>>('rootElement');
        const mainElement = inject<Ref<Element>>('mainElement');
        const canvas = ref<HTMLCanvasElement>();
        const canvasArea = ref<HTMLDivElement>();
        const canvasContainer = ref<HTMLDivElement>();
        const { useCssViewport, viewWidth: viewportWidth, viewHeight: viewportHeight } = toRefs(canvasStore.state);
        const { width: imageWidth, height: imageHeight } = toRefs(workingFileStore.state);
        const isPixelatedZoomLevel = ref<boolean>(false);
        let ctx: CanvasRenderingContext2DEnhanced | null = null;

        canvasStore.set('workingImageBorderColor', getComputedStyle(document.documentElement).getPropertyValue('--ogr-working-image-border-color'));

        watch([useCssViewport], ([isUseCssViewport]) => {
            const canvasElement = canvasStore.get('viewCanvas');
            const bufferCanvas = canvasStore.get('bufferCanvas');
            if (isUseCssViewport) {
                canvasElement.width = workingFileStore.get('width');
                canvasElement.height = workingFileStore.get('height');
                bufferCanvas.width = 10;    
                bufferCanvas.height = 10;    
            } else {
                (canvasContainer.value as HTMLDivElement).style.transform = '';
                canvasElement.width = viewportWidth.value;
                canvasElement.height = viewportHeight.value;
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
                bufferCanvas.width = 10;    
                bufferCanvas.height = 10;    
            } else {
                bufferCanvas.width = newWidth;
                bufferCanvas.height = newHeight;
            }
            canvasStore.set('dirty', true);
        });

        watch([mainElement], () => {
            resetTransform();
        }, { immediate: true });

        onMounted(() => {
            if (canvas.value) {
                const imageWidth = workingFileStore.get('width');
                const imageHeight = workingFileStore.get('height');

                if (rootElement) {
                    canvasStore.set('viewWidth', rootElement.value.clientWidth * (window.devicePixelRatio || 1));
                    canvasStore.set('viewHeight', rootElement.value.clientHeight * (window.devicePixelRatio || 1));
                }
                if (useCssViewport.value === false) {
                    canvas.value.width = viewportWidth.value;
                    canvas.value.height = viewportHeight.value;
                } else {
                    canvas.value.width = imageWidth;
                    canvas.value.height = imageHeight;
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
            }
        });

        onUnmounted(() => {
            appEmitter.off('app.canvas.resetTransform', resetTransform);
        });

        // Centers the canvas and displays at 1x zoom or the maximum width/height of the window, whichever is smaller. 
        function resetTransform() {
            if (canvasArea.value && ctx && mainElement) {
                const devicePixelRatio = window.devicePixelRatio || 1;
                const canvasAreaRect = canvasArea.value.getBoundingClientRect();
                const mainRect = mainElement.value.getBoundingClientRect();
                const imageWidth = workingFileStore.get('width');
                const imageHeight = workingFileStore.get('height');
                let scaledWidth = imageWidth;
                let scaledHeight = imageHeight;
                const imageSizeRatio = imageWidth / imageHeight;
                const widthToDisplayRatio = imageWidth / (mainRect.width - 48) / devicePixelRatio;
                const heightToDisplayRatio = imageHeight / (mainRect.height - 48) / devicePixelRatio;
                if (widthToDisplayRatio > 1 && widthToDisplayRatio > heightToDisplayRatio) {
                    scaledWidth = imageWidth / widthToDisplayRatio;
                    scaledHeight = scaledWidth / imageSizeRatio;
                } else if (heightToDisplayRatio > 1 && heightToDisplayRatio > widthToDisplayRatio) {
                    scaledHeight = imageHeight / heightToDisplayRatio;
                    scaledWidth = scaledHeight * imageSizeRatio;
                }
                const centerX = ((mainRect.left - canvasAreaRect.left) + ((mainRect.right - mainRect.left) / 2)) * devicePixelRatio;
                const centerY = ((mainRect.top - canvasAreaRect.top) + ((mainRect.bottom - mainRect.top) / 2)) * devicePixelRatio;
                const transform = new DOMMatrix();
                transform.translateSelf(Math.round(centerX - (scaledWidth / 2)), Math.round(centerY - (scaledHeight / 2)));
                if (widthToDisplayRatio > 1 || heightToDisplayRatio > 1) {
                    const scaleRatio = (widthToDisplayRatio > heightToDisplayRatio ? 1 / widthToDisplayRatio : 1 / heightToDisplayRatio);
                    transform.scaleSelf(scaleRatio, scaleRatio);
                }
                canvasStore.set('transform', transform);
                canvasStore.set('viewDirty', true);
            }
        }

        function drawLoop() {
            const canvasElement = canvas.value;
            if (canvasStore.get('viewDirty')) {
                canvasStore.set('viewDirty', false);
                if (useCssViewport.value === true) {
                    const devicePixelRatio = window.devicePixelRatio;
                    const transform = canvasStore.get('transform');
                    const decomposedTransform = canvasStore.get('decomposedTransform');
                    isPixelatedZoomLevel.value = decomposedTransform.scaleX / devicePixelRatio >= 1.25;
                    const offsetX = transform.e / decomposedTransform.scaleX;
                    const offsetY = transform.f / decomposedTransform.scaleX;
                    const pixelRatioTransform = transform
                        .rotate(-decomposedTransform.rotation * Math.RADIANS_TO_DEGREES)
                        .translate(-offsetX, -offsetY)
                        .scale(1 / devicePixelRatio, 1 / devicePixelRatio)
                        .translate(offsetX, offsetY)
                        .rotate(decomposedTransform.rotation * Math.RADIANS_TO_DEGREES);
                    (canvasContainer.value as HTMLDivElement).style.transform = `matrix(${pixelRatioTransform.a},${pixelRatioTransform.b},${pixelRatioTransform.c},${pixelRatioTransform.d},${pixelRatioTransform.e},${pixelRatioTransform.f})`;
                } else if (canvasElement && ctx) {
                    drawWorkingFileToCanvas(canvasElement, ctx);
                }
            }
            if (canvasStore.get('dirty') && canvasElement && ctx) {
                canvasStore.set('dirty', false);
                drawWorkingFileToCanvas(canvasElement, ctx);
            }
            requestAnimationFrame(drawLoop);
        }

        return {
            canvas,
            canvasArea,
            canvasContainer,
            isPixelatedZoomLevel,
            useCssViewport
        };
    }
});
</script>
