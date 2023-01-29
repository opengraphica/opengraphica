import { toRaw } from 'vue';
import { ColorModel, DrawWorkingFileOptions, DrawWorkingFileLayerOptions, WorkingFileLayer, WorkingFileGroupLayer } from '@/types';
import canvasStore from '@/store/canvas';
import preferencesStore from '@/store/preferences';
import workingFileStore from '@/store/working-file';
import { DecomposedMatrix, decomposeMatrix, snapPointAtHalfPixel, snapPointAtPixel } from './dom-matrix';
import layerRenderers from '@/canvas/renderers';

import type { Camera, Scene, WebGLRenderer } from 'three';

const imageSmoothingZoomRatio = preferencesStore.get('imageSmoothingZoomRatio');

/**
 * List of custom cursor images
 */
const cursorImages: { [key: string]: { data: string, image: HTMLImageElement | null, offsetX: number, offsetY: number } } = {
    grabbing: {
        data: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrows-move" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M7.646.146a.5.5 0 0 1 .708 0l2 2a.5.5 0 0 1-.708.708L8.5 1.707V5.5a.5.5 0 0 1-1 0V1.707L6.354 2.854a.5.5 0 1 1-.708-.708l2-2zM8 10a.5.5 0 0 1 .5.5v3.793l1.146-1.147a.5.5 0 0 1 .708.708l-2 2a.5.5 0 0 1-.708 0l-2-2a.5.5 0 0 1 .708-.708L7.5 14.293V10.5A.5.5 0 0 1 8 10zM.146 8.354a.5.5 0 0 1 0-.708l2-2a.5.5 0 1 1 .708.708L1.707 7.5H5.5a.5.5 0 0 1 0 1H1.707l1.147 1.146a.5.5 0 0 1-.708.708l-2-2zM10 8a.5.5 0 0 1 .5-.5h3.793l-1.147-1.146a.5.5 0 0 1 .708-.708l2 2a.5.5 0 0 1 0 .708l-2 2a.5.5 0 0 1-.708-.708L14.293 8.5H10.5A.5.5 0 0 1 10 8z"/></svg>`,
        image: null,
        offsetX: -8,
        offsetY: -8
    }
};
(() => {
    for (const cursorName in cursorImages) {
        const imageInfo = cursorImages[cursorName];
        const image = new Image();
        const svg = new Blob([imageInfo.data], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(svg);
        image.src = url;
        imageInfo.image = image;
    }
})();

/**
 * Draws everything in the working document to the specified canvas.
 */
export function drawWorkingFileToCanvas2d(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, options: DrawWorkingFileOptions = {}) {
    options.force2dRenderer = true;

    let now = performance.now();

    // Clear the canvas
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (options.initialTransform) {
        ctx.transform(options.initialTransform.a, options.initialTransform.b, options.initialTransform.c, options.initialTransform.d, options.initialTransform.e, options.initialTransform.f);
    }

    // Set canvas transform based on the current pan/zoom/rotation of the view
    const transform = canvasStore.get('transform');
    const decomposedTransform = canvasStore.get('decomposedTransform');
    const useCssViewport: boolean = canvasStore.get('useCssViewport');
    // canvasStore.set('isDisplayingNonRasterLayer', false);

    if (!useCssViewport && !options.selectionTest) {
        ctx.transform(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f);
    }
    
    ctx.imageSmoothingEnabled = decomposedTransform.scaleX / window.devicePixelRatio < imageSmoothingZoomRatio;

    (window as any).averageTimeStart = ((performance.now() - now) * 0.1) + (((window as any).averageTimeStart || 0) * 0.9);
    now = performance.now();

    // Draw the image background and frame
    const background = workingFileStore.get('background');
    const imageWidth = workingFileStore.get('width');
    const imageHeight = workingFileStore.get('height');
    ctx.beginPath();
    const canvasBorderSize = 2 / decomposedTransform.scaleX;
    const canvasTopLeft = { x: 0, y: 0 };
    const canvasBottomRight = { x: imageWidth, y: imageHeight };
    ctx.rect(canvasTopLeft.x, canvasTopLeft.y, canvasBottomRight.x - canvasTopLeft.x, canvasBottomRight.y - canvasTopLeft.y);
    if (!useCssViewport) {
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.shadowColor = canvasStore.get('workingImageBorderColor');
        ctx.shadowBlur = 20 * decomposedTransform.scaleX;
    }
    ctx.lineWidth = canvasBorderSize;
    ctx.fillStyle = background.visible ? background.color.style : 'transparent';
    ctx.fill();
    ctx.shadowBlur = 0;

    // Selection test
    if (options.selectionTest) {
        const imgData = ctx.getImageData(options.selectionTest.point.x, options.selectionTest.point.y, 1, 1);
        options.selectionTest.resultPixelTest = imgData.data.slice(0, 4);
    }

    (window as any).averageTimeCanvas = ((performance.now() - now) * 0.1) + (((window as any).averageTimeCanvas || 0) * 0.9);
    now = performance.now();

    // Clip the canvas
    if (!useCssViewport) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, imageWidth, imageHeight);
        ctx.clip();
    }

    (window as any).averageTimeClip = ((performance.now() - now) * 0.1) + (((window as any).averageTimeClip || 0) * 0.9);
    now = performance.now();

    // Draw layers
    const layers = workingFileStore.get('layers');
    for (const layer of layers) {
        if (options.force2dRenderer) {
            new layerRenderers['2d'][layer.type]().draw(ctx, layer, options);
        } else {
            layer.renderer.draw(ctx, layer, options);
        }
    }

    (window as any).averageTimeLayers = ((performance.now() - now) * 0.1) + (((window as any).averageTimeLayers || 0) * 0.9);
    now = performance.now();

    // If last layer was raster, draw the buffer.
    const isBufferInUse = canvasStore.get('isBufferInUse');
    if (isBufferInUse) {
        canvasStore.set('isBufferInUse', false);
        // ctx.putImageData(canvasStore.get('bufferCtx').getImageData(0, 0, imageWidth, imageHeight), 0, 0);
        ctx.drawImage(canvasStore.get('bufferCanvas'), 0, 0);
    }

    // Unclip the canvas
    if (!useCssViewport) {
        ctx.restore();
    }

    (window as any).averageTimeRestore = ((performance.now() - now) * 0.1) + (((window as any).averageTimeRestore || 0) * 0.9);
    now = performance.now();

    (window as any).averageTime = ((performance.now() - now) * 0.1) + (((window as any).averageTime || 0) * 0.9)
}


/**
 * Draws everything in the working document to the threejs renderer.
 */
export function drawWorkingFileToCanvasWebgl(renderer: WebGLRenderer, scene: Scene, camera: Camera, options: DrawWorkingFileOptions = {}) {
    try {
        const layers = workingFileStore.get('layers');
        for (const layer of layers) {
            if (layer.type === 'group') {
                layer.renderer.renderGroup(renderer, camera, layer as WorkingFileGroupLayer<ColorModel>);
            }
        }
        renderer.render(scene, camera);
    } catch (error) {
        console.error(error);
        throw error;
    }
}