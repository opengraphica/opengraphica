
import { BaseAction } from './base';
import canvasStore from '@/store/canvas';
import { createStoredImage, prepareStoredImageForEditing, prepareStoredImageForArchival } from '@/store/image';
import workingFileStore, { getLayerById, getCanvasRenderingContext2DSettings } from '@/store/working-file';
import { ApplyLayerTransformAction } from './apply-layer-transform';
import { UpdateLayerAction } from './update-layer';

export class SetLayerBoundsToWorkingFileBoundsAction extends BaseAction {

    private layerId: number;

    private applyLayerTransformAction: InstanceType<typeof ApplyLayerTransformAction> | null = null;
    private updateLayerAction: InstanceType<typeof UpdateLayerAction> | null = null;

    constructor(layerId: number) {
        super('setLayerBoundsToWorkingFileBounds', 'action.setLayerBoundsToWorkingFileBounds');
        this.layerId = layerId;
	}

	public async do() {
        super.do();

        const layer = getLayerById(this.layerId);
        if (!layer) throw new Error('[src/actions/set-layer-bounds-to-working-file-bounds.ts] Layer with specified id not found.');
        if (layer.type !== 'raster') return;

        this.applyLayerTransformAction = new ApplyLayerTransformAction(this.layerId);
        await this.applyLayerTransformAction.do();

        const layerCanvas = await prepareStoredImageForEditing(layer.data.sourceUuid);
        if (!layerCanvas) throw new Error('[src/actions/set-layer-bounds-to-working-file-bounds.ts] Unable to edit existing layer image.');
        
        const newWidth = workingFileStore.get('width');
        const newHeight = workingFileStore.get('height');
        const transform = layer.transform;

        const workingCanvas = document.createElement('canvas');
        workingCanvas.width = newWidth;
        workingCanvas.height = newHeight;
        const workingCanvasCtx = workingCanvas.getContext('2d', getCanvasRenderingContext2DSettings());
        if (!workingCanvasCtx) throw new Error('[src/actions/set-layer-bounds-to-working-file-bounds.ts] Unable to create a new canvas for transform.');
        workingCanvasCtx.save();
        workingCanvasCtx.globalCompositeOperation = 'copy';
        workingCanvasCtx.transform(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f);
        workingCanvasCtx.drawImage(layerCanvas, 0, 0);
        workingCanvasCtx.restore();

        prepareStoredImageForArchival(layer.data.sourceUuid);

        this.updateLayerAction = new UpdateLayerAction({
            id: this.layerId,
            width: newWidth,
            height: newHeight,
            transform: new DOMMatrix(),
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
        if (this.applyLayerTransformAction) {
            await this.applyLayerTransformAction.undo();
            this.applyLayerTransformAction = null;
        }

        canvasStore.set('dirty', true);
	}

    public free() {
        super.free();

        if (this.updateLayerAction) {
            this.updateLayerAction.free();
            this.updateLayerAction = null
        }
        if (this.applyLayerTransformAction) {
            this.applyLayerTransformAction.free();
            this.applyLayerTransformAction = null;
        }
    }

}
