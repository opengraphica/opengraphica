import { DrawWorkingFileLayerOptions, WorkingFileLayer, WorkingFileLayerRenderer, ColorModel, WorkingFileGroupLayer } from '@/types';
import canvasStore from '@/store/canvas';
import preferencesStore from '@/store/preferences';
import workingFileStore, { getLayer2dCompositeOperation } from '@/store/working-file';

import type { Camera, WebGLRenderer } from 'three';

export default class BaseLayerRenderer implements WorkingFileLayerRenderer<ColorModel> {
    renderMode: '2d' | 'webgl' = '2d';
    threejsScene = undefined;
    isAttached: boolean = false;
    order: number = 0;

    async attach(layer: WorkingFileLayer<ColorModel>) {
        if (!this.isAttached) {
            try {
                await this.onAttach(layer);
            } catch (error) {
                console.error('[src/canvas/renderers/2d/base.test] Error during layer attach. ', error);
            }
            this.isAttached = true;
        }
    }
    onAttach(layer: WorkingFileLayer<ColorModel>) {
        // Override
    }

    detach() {
        if (this.isAttached) {
            try {
                this.onDetach();
            } catch (error) {
                console.error('[src/canvas/renderers/2d/base.test] Error during layer detach. ', error);
            }
            this.isAttached = false;
        }
    }
    onDetach() {
        // Override
    }

    reorder(order: number) {
        this.order = order;
        this.onReorder(order);
    }
    onReorder(order: number) {
        // Override
    }

    update(updates: Partial<WorkingFileLayer<ColorModel>>) {
        this.onUpdate(updates);
        canvasStore.set('dirty', true);
    }
    onUpdate(updates: Partial<WorkingFileLayer<ColorModel>>) {
        // Override
    }
    async nextUpdate() {}

    draw(ctx: CanvasRenderingContext2D, layer: WorkingFileLayer<ColorModel>, options: DrawWorkingFileLayerOptions = {}) {
        if ((options.visible || layer.visible) && (!options.selectedLayersOnly || workingFileStore.get('selectedLayerIds').includes(layer.id))) {
            if (options.selectionTest) {
                options.force2dRenderer = true;
            }
            const canvas = ctx.canvas;
            
            // In some browsers you can see visible seams between drawImage calls that are otherwise pixel perfect aligned in certain view transforms.
            // Optionally, drawing subsequent raster layers to a buffer canvas first then applying the transform eliminates this issue at a performance cost.
            if (preferencesStore.get('enableMultiLayerBuffer') && !canvasStore.get('useCssViewport') && canvasStore.get('decomposedTransform').scaleX < 1) {
                const isBufferInUse = canvasStore.get('isBufferInUse');
                if (layer.type === 'raster') {
                    ctx = canvasStore.get('bufferCtx');
                    if (!isBufferInUse) {
                        canvasStore.set('isBufferInUse', true);
                        // Clear the buffer
                        ctx.setTransform(1, 0, 0, 1, 0, 0);
                        ctx.clearRect(0, 0, workingFileStore.get('width'), workingFileStore.get('height'));
                    }
                } else if (layer.type !== 'group') {
                    // No longer on a raster layer, draw the previous buffer to canvas before anything else.
                    if (isBufferInUse) {
                        canvasStore.set('isBufferInUse', false);
                        ctx.drawImage(canvasStore.get('bufferCanvas'), 0, 0);
                    }
                }
            }
    
            if (layer.type !== 'raster' && layer.type !== 'rasterSequence' && layer.type !== 'group') {
                canvasStore.set('isDisplayingNonRasterLayer', true);
            }
    
            if (options.selectionTest) {
                ctx.save();
                ctx.setTransform(new DOMMatrix());
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.restore();
            }
            
            ctx.save();
            ctx.globalAlpha = layer.opacity;
            ctx.globalCompositeOperation = options?.globalCompositeOperation ?? getLayer2dCompositeOperation(layer);
            const wasImageSmoothingEnabled = ctx.imageSmoothingEnabled;
            if (wasImageSmoothingEnabled) {
                ctx.imageSmoothingEnabled = false;
            }
            const isIdentity = layer.transform.isIdentity;
            if (!isIdentity) {
                ctx.transform(layer.transform.a, layer.transform.b, layer.transform.c, layer.transform.d, layer.transform.e, layer.transform.f);
            }
            this.onDraw(ctx, layer, options);
            if (wasImageSmoothingEnabled) {
                ctx.imageSmoothingEnabled = true;
            }
            if (options.selectionTest && layer.type !== 'group') {
                const imgData = ctx.getImageData(options.selectionTest.point.x, options.selectionTest.point.y, 1, 1);
                const pixel = imgData.data.slice(0, 4);
                if (
                    !options.selectionTest.resultPixelTest ||
                    pixel[3] > 0
                ) {
                    options.selectionTest.resultId = layer.id;
                    options.selectionTest.resultPixelTest = pixel;
                }
            }
            ctx.restore();
        }
    }
    onDraw(ctx: CanvasRenderingContext2D, layer: WorkingFileLayer<ColorModel>, options: DrawWorkingFileLayerOptions = {}) {
        // Override
    }

    renderGroup(renderer: WebGLRenderer, camera: Camera, layer: WorkingFileGroupLayer<ColorModel>) {
        this.onRenderGroup(renderer, camera, layer);
    }
    onRenderGroup(renderer: WebGLRenderer, camera: Camera, layer: WorkingFileGroupLayer<ColorModel>) {
        // Override
    }
}
