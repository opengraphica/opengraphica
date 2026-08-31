
import { BaseAction } from './base';
import { DeleteLayerFilterAction } from './delete-layer-filter';
import { SelectLayersAction } from './select-layers';
import { UpdateLayerAction } from './update-layer';

import { useRenderer } from '@/renderers';

import { createImageFromBlob, createCanvasFromImage, createImageBlobFromCanvas, resizeImage } from '@/lib/image';
import { limitMaxDimension } from '@/lib/math';

import { createStoredImage } from '@/store/image';
import workingFileStore, { getLayerById } from '@/store/working-file';

import { exportAsImage } from '@/modules/file/export';

import type {
    UpdateRasterLayerOptions
} from '@/types';

export class RasterizeLayerAction extends BaseAction {

    private layerId: number;
    private actions: BaseAction[] = [];

    constructor(layerId: number) {
        super('rasterizeLayer', 'action.rasterizeLayer');
        this.layerId = layerId;
	}

	public async do() {
        super.do();

        const layer = getLayerById(this.layerId);
        if (!layer) {
            throw new Error('[src/actions/rasterize-layer.ts] Layer with specified id not found.');
        }

        const maxTextureSize = await (await useRenderer()).getMaxTextureSize();

        const selectLayersAction = new SelectLayersAction([this.layerId]);
        await selectLayersAction.do();

        let { blob } = await exportAsImage({
            fileType: 'png',
            toBlob: true,
            layerSelection: 'selected',
            cameraTransform: new DOMMatrix().scale(
                workingFileStore.get('width') / layer.width,
                workingFileStore.get('height') / layer.height,
            ).multiply(layer.transform.inverse()),
        });

        if (!blob) {
            await selectLayersAction.undo();
            throw new Error('[src/actions/rasterize-layer.ts] Rasterization to png failed.');
        }
        this.actions.push(selectLayersAction);

        let newTransform = layer.transform;
        if (workingFileStore.get('width') > maxTextureSize || workingFileStore.get('height') > maxTextureSize) {
            const { width, height } = limitMaxDimension(workingFileStore.get('width'), workingFileStore.get('height'), maxTextureSize);
            blob = await createImageBlobFromCanvas(
                await resizeImage(await createImageFromBlob(blob), width, height)
            );
            newTransform = layer.transform.multiply(new DOMMatrix().scale(workingFileStore.get('width') / width, workingFileStore.get('height') / height));
        }

        const filterCount = layer.filters.length;
        for (let i = 0; i < filterCount; i++) {
            const deleteLayerFilterAction = new DeleteLayerFilterAction(this.layerId, 0);
            await deleteLayerFilterAction.do();
            this.actions.push(deleteLayerFilterAction);
        }

        const updateLayerAction = new UpdateLayerAction<UpdateRasterLayerOptions>({
            id: this.layerId,
            type: 'raster',
            transform: newTransform,
            data: {
                sourceUuid: await createStoredImage(await createImageFromBlob(blob)),
            },
        });
        await updateLayerAction.do();
        this.actions.push(updateLayerAction);

	}

	public async undo() {
        super.undo();

        for (let i = this.actions.length - 1; i >= 0; i--) {
            const action = this.actions[i];
            await action.undo();
        }
        for (let i = this.actions.length - 1; i >= 0; i--) {
            const action = this.actions[i];
            action.free();
        }
        this.actions = [];
	}

    public free() {
        super.free();

        for (const action of this.actions) {
            action.free();
        }
    }
}
