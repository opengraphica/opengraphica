
import { BaseAction } from './base';
import imageDatabase from '@/store/data/image-database';
import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import { createStoredImage, prepareStoredImageForEditing, prepareStoredImageForArchival } from '@/store/image';
import { getLayerById, getCanvasRenderingContext2DSettings } from '@/store/working-file';
import { getImageDataEmptyBounds, getImageDataFromCanvas } from '@/lib/image';
import { decomposeMatrix } from '@/lib/dom-matrix';
import { findPointListBounds } from '@/lib/math';
import { UpdateLayerAction } from './update-layer';

export class ApplyLayerTransformAction extends BaseAction {

    private layerId: number;
    private updateLayerAction: InstanceType<typeof UpdateLayerAction> | null = null;

    constructor(layerId: number) {
        super('applyLayerTransform', 'action.applyLayerTransform');
        this.layerId = layerId;
	}

	public async do() {
        super.do();

        const layer = getLayerById(this.layerId);
        if (!layer) throw new Error('[src/actions/apply-layer-transform.ts] Layer with specified id not found.');
        if (layer.type !== 'raster') return;

        const layerCanvas = await prepareStoredImageForEditing(layer.data.sourceUuid);
        if (!layerCanvas) throw new Error('[src/actions/apply-layer-transform.ts] Unable to edit existing layer image.');
        const emptyBounds = getImageDataEmptyBounds(getImageDataFromCanvas(layerCanvas));
        // const beforeEmptyCropBounds = findPointListBounds([
        //     new DOMPoint(0, 0).matrixTransform(layer.transform),
        //     new DOMPoint(layer.width, 0).matrixTransform(layer.transform),
        //     new DOMPoint(0, layer.height).matrixTransform(layer.transform),
        //     new DOMPoint(layer.width, layer.height).matrixTransform(layer.transform),
        // ]);
        const afterEmptyCropBounds = findPointListBounds([
            new DOMPoint(emptyBounds.left, emptyBounds.top).matrixTransform(layer.transform),
            new DOMPoint(emptyBounds.right, emptyBounds.top).matrixTransform(layer.transform),
            new DOMPoint(emptyBounds.left, emptyBounds.bottom).matrixTransform(layer.transform),
            new DOMPoint(emptyBounds.right, emptyBounds.bottom).matrixTransform(layer.transform),
        ]);
        const newWidth = Math.ceil(afterEmptyCropBounds.right - afterEmptyCropBounds.left);
        const newHeight = Math.ceil(afterEmptyCropBounds.bottom - afterEmptyCropBounds.top);
        const croppedTransform = new DOMMatrix().translateSelf(-afterEmptyCropBounds.left, -afterEmptyCropBounds.top).multiplySelf(layer.transform);
        const decomposedCroppedTransform = decomposeMatrix(croppedTransform);

        const imageResizeCanvas = document.createElement('canvas');
        imageResizeCanvas.width = Math.round(layer.width * decomposedCroppedTransform.scaleX);
        imageResizeCanvas.height = Math.round(layer.height * decomposedCroppedTransform.scaleY);
        const Pica = (await import('@/lib/pica')).default;
        const pica = new Pica();
        await pica.resize(layerCanvas, imageResizeCanvas);

        const workingCanvas = document.createElement('canvas');
        workingCanvas.width = newWidth;
        workingCanvas.height = newHeight;
        const workingCanvasCtx = workingCanvas.getContext('2d', getCanvasRenderingContext2DSettings());
        if (!workingCanvasCtx) throw new Error('[src/actions/apply-layer-transform.ts] Unable to create a new canvas for transform.');
        workingCanvasCtx.save();
        workingCanvasCtx.globalCompositeOperation = 'copy';
        workingCanvasCtx.transform(croppedTransform.a, croppedTransform.b, croppedTransform.c, croppedTransform.d, croppedTransform.e, croppedTransform.f);
        workingCanvasCtx.scale(1 / decomposedCroppedTransform.scaleX, 1 / decomposedCroppedTransform.scaleY);
        workingCanvasCtx.drawImage(imageResizeCanvas, 0, 0);
        workingCanvasCtx.restore();
        const newLayerTransform = new DOMMatrix().translateSelf(
            afterEmptyCropBounds.left,
            afterEmptyCropBounds.top
        );

        prepareStoredImageForArchival(layer.data.sourceUuid);

        this.updateLayerAction = new UpdateLayerAction({
            id: this.layerId,
            width: newWidth,
            height: newHeight,
            transform: newLayerTransform,
            data: {
                sourceUuid: await createStoredImage(workingCanvas)
            }
        });
        await this.updateLayerAction.do();

        canvasStore.set('dirty', true);
	}

	public async undo() {
        super.undo();

        if (this.updateLayerAction) {
            await this.updateLayerAction.undo();
            this.updateLayerAction = null;
        }

        canvasStore.set('dirty', true);
	}

    public free() {
        super.free();

        if (this.updateLayerAction) {
            this.updateLayerAction.free();
            this.updateLayerAction = null
        }
    }

}
