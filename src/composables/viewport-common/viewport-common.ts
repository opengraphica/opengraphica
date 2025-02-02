import { onMounted, onUnmounted, type Ref } from 'vue';

import appEmitter, { AppEmitterEvents } from '@/lib/emitter';

import canvasStore from '@/store/canvas';
import workingFileStore from '@/store/working-file';

interface ViewportCommonOptions {
    canvasArea: Ref<HTMLDivElement | undefined>;
    loading: Ref<boolean>;
    mainElement: Ref<Element> | undefined;
    renderCanvas: () => void;
}

export function useViewportCommon(options: ViewportCommonOptions) {
    const { canvasArea, loading, mainElement, renderCanvas } = options;

    onMounted(() => {
        appEmitter.on('app.canvas.resetTransform', resetTransform);
        document.addEventListener('visibilitychange', onDocumentVisibilityChange);
    });

    onUnmounted(() => {
        appEmitter.off('app.canvas.resetTransform', resetTransform);
        document.removeEventListener('visibilitychange', onDocumentVisibilityChange);
    });

    // Centers the canvas and displays at 1x zoom or the maximum width/height of the window, whichever is smaller. 
    async function resetTransform(event?: AppEmitterEvents['app.canvas.resetTransform']) {
        appEmitter.emit('app.canvas.calculateDndArea');
        const margin: number = (event && event.margin) || 48;
        if (canvasArea.value && mainElement) {
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

    // Workaround for Firefox for Android somehow no longer updating after switching away from the tab for a while.
    function onDocumentVisibilityChange() {
        if (document.visibilityState === 'visible' && loading.value === false) {
            const threejsRenderer = canvasStore.get('threejsRenderer');
            if (threejsRenderer) {
                threejsRenderer.forceContextLoss();
                requestAnimationFrame(() => {
                    threejsRenderer.forceContextRestore();
                    requestAnimationFrame(() => {
                        canvasStore.set('dirty', true);
                        renderCanvas();
                    });
                });
            }
        }
    }

}
