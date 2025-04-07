import { ref, type Ref } from 'vue';

import { drawWorkingFileToCanvas2d } from '@/lib/canvas';

import canvasStore from '@/store/canvas';
import {
    activeSelectionMask, activeSelectionMaskCanvasOffset, appliedSelectionMask, appliedSelectionMaskCanvasOffset,
    selectedLayersSelectionMaskPreview, selectedLayersSelectionMaskPreviewCanvasOffset,
} from '@/canvas/store/selection-state';import workingFileStore, { getCanvasRenderingContext2DSettings } from '@/store/working-file';

interface Canvas2dViewportOptions {
    canvas: Ref<HTMLCanvasElement | undefined>,
}

const selectionMaskPatternSrc = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAABg2lDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV/TiiIVh3YQcchQnVoQFXHUKhShQqgVWnUwufQLmjQkKS6OgmvBwY/FqoOLs64OroIg+AHi6OSk6CIl/i8ptIjx4Lgf7+497t4BQrPKNCs0Dmi6bWZSSTGXXxV7XyEgghDiCMjMMuYkKQ3f8XWPAF/vEjzL/9yfY0AtWAwIiMSzzDBt4g3i6U3b4LxPHGVlWSU+J46bdEHiR64rHr9xLrks8Myomc3ME0eJxVIXK13MyqZGPEUcUzWd8oWcxyrnLc5atc7a9+QvDBf0lWWu0xxBCotYggQRCuqooAobCVp1UixkaD/p4x92/RK5FHJVwMixgBo0yK4f/A9+d2sVJye8pHAS6HlxnI9RoHcXaDUc5/vYcVonQPAZuNI7/loTmPkkvdHRYkfA4DZwcd3RlD3gcgcYejJkU3alIE2hWATez+ib8kDkFuhf83pr7+P0AchSV+kb4OAQGCtR9rrPu/u6e/v3TLu/Hx5FcoXj45C+AAAABmJLR0QATgBOAE714JEKAAAACXBIWXMAAC4jAAAuIwF4pT92AAAAB3RJTUUH5gITBDkEOkUYUQAAABl0RVh0Q29tbWVudABDcmVhdGVkIHdpdGggR0lNUFeBDhcAAAAtSURBVAjXY/z//383AxT4+/szMCFzNm7cCBGAcRgYGBiYz58/7wbjMDAwMAAAGKUPRK2REh8AAAAASUVORK5CYII=';

export function useCanvas2dViewport(options: Canvas2dViewportOptions) {
    const { canvas } = options;

    let ctx = ref<CanvasRenderingContext2D | null>(null);
    const selectionMaskCanvas = ref<HTMLCanvasElement>();
    const selectionMaskCanvasCtx = ref<CanvasRenderingContext2D | null>(null);
    const selectionMaskPattern = new Image();

    function renderCanvas() {
        if (canvas!.value && ctx.value) {
            drawWorkingFileToCanvas2d(canvas!.value!, ctx.value as CanvasRenderingContext2D, { isEditorPreview: true });
        }
    };

    function initializeRenderer() {
        if (!canvas.value) return;

        // Set up buffer canvas
        const originalCtx = canvas.value.getContext('2d', getCanvasRenderingContext2DSettings());
        const bufferCanvas = document.createElement('canvas');
        bufferCanvas.width = workingFileStore.state.width;
        bufferCanvas.height = workingFileStore.state.height;
        let bufferCtx: CanvasRenderingContext2D = bufferCanvas.getContext('2d', getCanvasRenderingContext2DSettings()) as CanvasRenderingContext2D;
        if (originalCtx && bufferCtx) {
            // Assign view canvas
            ctx.value = originalCtx;
            // Assign buffer canvas
            canvasStore.set('bufferCanvas', bufferCanvas);
            canvasStore.set('bufferCtx', bufferCtx);
        }

        if (!selectionMaskCanvas.value) return;
        canvasStore.set('selectionMaskCanvas', selectionMaskCanvas.value);
        selectionMaskCanvasCtx.value = selectionMaskCanvas.value.getContext('2d', getCanvasRenderingContext2DSettings());
        selectionMaskPattern.src = selectionMaskPatternSrc;
    }

    function updateRendererForDirtyViewport() {
        if (selectionMaskCanvas.value && selectionMaskCanvasCtx.value) {
            selectionMaskCanvas.value.width = canvasStore.state.viewWidth;
            selectionMaskCanvas.value.height = canvasStore.state.viewHeight;
            selectionMaskCanvasCtx.value.imageSmoothingEnabled = false; // Disable for some decent antialiasing.
            selectionMaskCanvasCtx.value.clearRect(0, 0, selectionMaskCanvas.value.width, selectionMaskCanvas.value.height);
            if (appliedSelectionMask.value || activeSelectionMask.value || selectedLayersSelectionMaskPreview.value) {
                const transform = canvasStore.get('transform');
                selectionMaskCanvasCtx.value.globalCompositeOperation = 'source-over';
                selectionMaskCanvasCtx.value.save();
                selectionMaskCanvasCtx.value.setTransform(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f);
                if (activeSelectionMask.value) {
                    selectionMaskCanvasCtx.value.drawImage(activeSelectionMask.value, activeSelectionMaskCanvasOffset.value.x, activeSelectionMaskCanvasOffset.value.y);
                } else if (appliedSelectionMask.value) {
                    selectionMaskCanvasCtx.value.drawImage(appliedSelectionMask.value, appliedSelectionMaskCanvasOffset.value.x, appliedSelectionMaskCanvasOffset.value.y);
                } else if (selectedLayersSelectionMaskPreview.value) {
                    selectionMaskCanvasCtx.value.drawImage(selectedLayersSelectionMaskPreview.value, selectedLayersSelectionMaskPreviewCanvasOffset.value.x, selectedLayersSelectionMaskPreviewCanvasOffset.value.y);
                }
                selectionMaskCanvasCtx.value.restore();
                selectionMaskCanvasCtx.value.globalCompositeOperation = 'source-out';
                const pattern = selectionMaskCanvasCtx.value.createPattern(selectionMaskPattern, 'repeat') || '#00000044';
                selectionMaskCanvasCtx.value.fillStyle = pattern;
                selectionMaskCanvasCtx.value.fillRect(0, 0, selectionMaskCanvas.value.width, selectionMaskCanvas.value.height);
            }
            selectionMaskCanvasCtx.value.globalCompositeOperation = 'source-over';
        }
    }

    return {
        ctx,
        initializeRenderer,
        renderCanvas,
        updateRendererForDirtyViewport,
        selectionMaskCanvas,
    };
}