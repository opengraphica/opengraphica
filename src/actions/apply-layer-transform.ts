
import { BaseAction } from './base';
import canvasStore from '@/store/canvas';
import { createStoredImage, prepareStoredImageForEditing, prepareStoredImageForArchival } from '@/store/image';
import { getLayerById, getCanvasRenderingContext2DSettings } from '@/store/working-file';
import { getImageDataEmptyBounds, getImageDataFromCanvas } from '@/lib/image';
import { decomposeMatrix } from '@/lib/dom-matrix';
import { findPointListBounds } from '@/lib/math';
import { UpdateLayerAction } from './update-layer';
import { TrimLayerEmptySpaceAction } from './trim-layer-empty-space';

export class ApplyLayerTransformAction extends BaseAction {

    private layerId: number;
    private updateLayerAction: InstanceType<typeof UpdateLayerAction> | null = null;
    private trimEmptySpaceAction: InstanceType<typeof TrimLayerEmptySpaceAction> | null = null;

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
        let emptyBounds = getImageDataEmptyBounds(getImageDataFromCanvas(layerCanvas));

        // Draw rotated crop on new canvas
        const afterEmptyCropBounds = findPointListBounds([
            new DOMPoint(emptyBounds.left, emptyBounds.top).matrixTransform(layer.transform),
            new DOMPoint(emptyBounds.right, emptyBounds.top).matrixTransform(layer.transform),
            new DOMPoint(emptyBounds.left, emptyBounds.bottom).matrixTransform(layer.transform),
            new DOMPoint(emptyBounds.right, emptyBounds.bottom).matrixTransform(layer.transform),
        ]);
        let newWidth = Math.ceil(afterEmptyCropBounds.right - afterEmptyCropBounds.left);
        let newHeight = Math.ceil(afterEmptyCropBounds.bottom - afterEmptyCropBounds.top);
        const croppedTransform = new DOMMatrix().translateSelf(-afterEmptyCropBounds.left, -afterEmptyCropBounds.top).multiplySelf(layer.transform);
        const decomposedCroppedTransform = decomposeMatrix(croppedTransform);

        let imageResizeCanvas: HTMLCanvasElement | null = null;
        if (decomposedCroppedTransform.scaleX !== 1 || decomposedCroppedTransform.scaleY !== 1) {
            imageResizeCanvas = document.createElement('canvas');
            imageResizeCanvas.width = Math.round(layer.width * decomposedCroppedTransform.scaleX);
            imageResizeCanvas.height = Math.round(layer.height * decomposedCroppedTransform.scaleY);
            const Pica = (await import('@/lib/pica')).default;
            const pica = new Pica();
            await pica.resize(layerCanvas, imageResizeCanvas, { alpha: true });
        }

        let workingCanvas = document.createElement('canvas');
        workingCanvas.width = newWidth;
        workingCanvas.height = newHeight;
        let workingCanvasCtx = workingCanvas.getContext('2d', getCanvasRenderingContext2DSettings());
        if (!workingCanvasCtx) throw new Error('[src/actions/apply-layer-transform.ts] Unable to create a new canvas for transform.');
        workingCanvasCtx.save();
        workingCanvasCtx.globalCompositeOperation = 'copy';
        workingCanvasCtx.transform(croppedTransform.a, croppedTransform.b, croppedTransform.c, croppedTransform.d, croppedTransform.e, croppedTransform.f);
        if (imageResizeCanvas) {
            workingCanvasCtx.scale(1 / decomposedCroppedTransform.scaleX, 1 / decomposedCroppedTransform.scaleY);
        }
        workingCanvasCtx.drawImage(imageResizeCanvas ?? layerCanvas, 0, 0);
        workingCanvasCtx.restore();
        let newLayerTransform = new DOMMatrix().translateSelf(
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

        // TODO - can save on memory by moving this logic inside of this action.
        this.trimEmptySpaceAction = new TrimLayerEmptySpaceAction(this.layerId);
        await this.trimEmptySpaceAction.do();

        canvasStore.set('dirty', true);
	}

	public async undo() {
        super.undo();

        if (this.trimEmptySpaceAction) {
            await this.trimEmptySpaceAction.do();
            this.trimEmptySpaceAction = null;
        }
        if (this.updateLayerAction) {
            await this.updateLayerAction.undo();
            this.updateLayerAction = null;
        }

        canvasStore.set('dirty', true);
	}

    public free() {
        super.free();

        if (this.trimEmptySpaceAction) {
            this.trimEmptySpaceAction.free();
            this.trimEmptySpaceAction = null;
        }
        if (this.updateLayerAction) {
            this.updateLayerAction.free();
            this.updateLayerAction = null
        }
    }

}
