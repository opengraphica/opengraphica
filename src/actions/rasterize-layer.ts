
import { BaseAction } from './base';
import { DeleteLayerFilterAction } from './delete-layer-filter';
import { SelectLayersAction } from './select-layers';
import { UpdateLayerAction } from './update-layer';

import { createImageFromBlob } from '@/lib/image';

import { createStoredImage } from '@/store/image';
import { getLayerById } from '@/store/working-file';

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

        const selectLayersAction = new SelectLayersAction([this.layerId]);
        await selectLayersAction.do();

        const { blob } = await exportAsImage({
            fileType: 'png',
            toBlob: true,
            layerSelection: 'selected',
        });

        if (!blob) {
            await selectLayersAction.undo();
            throw new Error('[src/actions/rasterize-layer.ts] Rasterization to png failed.');
        }
        this.actions.push(selectLayersAction);

        const filterCount = layer.filters.length;
        for (let i = 0; i < filterCount; i++) {
            const deleteLayerFilterAction = new DeleteLayerFilterAction(this.layerId, 0);
            await deleteLayerFilterAction.do();
            this.actions.push(deleteLayerFilterAction);
        }

        const updateLayerAction = new UpdateLayerAction<UpdateRasterLayerOptions>({
            id: this.layerId,
            type: 'raster',
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
