
import { BaseAction } from './base';
import canvasStore from '@/store/canvas';
import { createStoredImage, prepareStoredImageForEditing, prepareStoredImageForArchival } from '@/store/image';
import { getLayerById, getCanvasRenderingContext2DSettings } from '@/store/working-file';
import { getImageDataEmptyBounds, getImageDataFromCanvas } from '@/lib/image';
import { findPointListBounds } from '@/lib/math';
import { UpdateLayerAction } from './update-layer';

export class TrimLayerEmptySpaceAction extends BaseAction {

    private layerId: number;
    private updateLayerAction: InstanceType<typeof UpdateLayerAction> | null = null;

    constructor(layerId: number) {
        super('trimLayerEmptySpace', 'action.trimLayerEmptySpace');
        this.layerId = layerId;
	}

	public async do() {
        super.do();

        const layer = getLayerById(this.layerId);
        if (!layer) throw new Error('[src/actions/trim-layer-empty-bounds.ts] Layer with specified id not found.');
        if (layer.type !== 'raster') return;

        const layerCanvas = await prepareStoredImageForEditing(layer.data.sourceUuid);
        if (!layerCanvas) throw new Error('[src/actions/trim-layer-empty-bounds.ts] Unable to edit existing layer image.');
        const emptyBounds = getImageDataEmptyBounds(getImageDataFromCanvas(layerCanvas));
        const emptyCropBounds = findPointListBounds([
            new DOMPoint(emptyBounds.left, emptyBounds.top),
            new DOMPoint(emptyBounds.right, emptyBounds.top),
            new DOMPoint(emptyBounds.left, emptyBounds.bottom),
            new DOMPoint(emptyBounds.right, emptyBounds.bottom),
        ]);
        const previousTransformedBounds = findPointListBounds([
            new DOMPoint(0, 0).matrixTransform(layer.transform),
            new DOMPoint(layer.width, 0).matrixTransform(layer.transform),
            new DOMPoint(0, layer.height).matrixTransform(layer.transform),
            new DOMPoint(layer.width, layer.height).matrixTransform(layer.transform),
        ]);
        const transformedEmptyCropBounds = findPointListBounds([
            new DOMPoint(emptyBounds.left, emptyBounds.top).matrixTransform(layer.transform),
            new DOMPoint(emptyBounds.right, emptyBounds.top).matrixTransform(layer.transform),
            new DOMPoint(emptyBounds.left, emptyBounds.bottom).matrixTransform(layer.transform),
            new DOMPoint(emptyBounds.right, emptyBounds.bottom).matrixTransform(layer.transform),
        ]);
        const newWidth = Math.ceil(emptyCropBounds.right - emptyCropBounds.left);
        const newHeight = Math.ceil(emptyCropBounds.bottom - emptyCropBounds.top);

        if (newWidth < 1 || newHeight < 1) return;

        const workingCanvas = document.createElement('canvas');
        workingCanvas.width = newWidth;
        workingCanvas.height = newHeight;
        const workingCanvasCtx = workingCanvas.getContext('2d', getCanvasRenderingContext2DSettings());
        if (!workingCanvasCtx) throw new Error('[src/actions/trim-layer-empty-bounds.ts] Unable to create a new canvas for transform.');
        workingCanvasCtx.save();
        workingCanvasCtx.globalCompositeOperation = 'copy';
        workingCanvasCtx.translate(-emptyCropBounds.left, -emptyCropBounds.top);
        workingCanvasCtx.drawImage(layerCanvas, 0, 0);
        workingCanvasCtx.restore();
        const newLayerTransform = new DOMMatrix().translateSelf(
            transformedEmptyCropBounds.left - previousTransformedBounds.left,
            transformedEmptyCropBounds.top - previousTransformedBounds.top
        ).multiplySelf(layer.transform);

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
