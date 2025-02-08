import { BaseAction } from './base';

import canvasStore from '@/store/canvas';
import { unreserveStoredImage } from '@/store/image';
import workingFileStore, { getLayerById, regenerateLayerThumbnail } from '@/store/working-file';
import { updateWorkingFileMasks, updateWorkingFileLayer } from '@/store/data/working-file-database';

import { updateBakedImageForLayer } from './baking';

import type { WorkingFileLayerFilter } from '@/types';

export class DeleteLayerFilterAction extends BaseAction {

    private layerId!: number;
    private filterIndex!: number;
    private deletedFilter: WorkingFileLayerFilter | undefined;

    constructor(layerId: number, filterIndex: number) {
        super('deleteLayerFilter', 'action.deleteLayerFilter');
        this.layerId = layerId;
        this.filterIndex = filterIndex;
	}

	public async do() {
        super.do();

        const layers = workingFileStore.get('layers');
        const layer = getLayerById(this.layerId, layers);
        if (!layer) {
            throw new Error('Aborted - Layer with specified id not found.');
        }

        this.deletedFilter = layer.filters.splice(this.filterIndex, 1)[0];

        regenerateLayerThumbnail(layer);
        updateBakedImageForLayer(layer);
        updateWorkingFileLayer(layer);

        canvasStore.set('dirty', true);
	}

	public async undo() {
        super.undo();

        const layers = workingFileStore.get('layers');
        const layer = getLayerById(this.layerId, layers);
        if (!layer) {
            throw new Error('Aborted - Layer with specified id not found.');
        }
        if (!this.deletedFilter) {
            throw new Error('Aborted - Previously deleted filter object does not exist.');
        }

        layer.filters.splice(this.filterIndex, 0, this.deletedFilter);

        regenerateLayerThumbnail(layer);
        updateBakedImageForLayer(layer);
        updateWorkingFileLayer(layer);

        canvasStore.set('dirty', true);
	}

    public free() {
        super.free();

        if (this.isDone && this.deletedFilter?.maskId != null) {
            const masks = workingFileStore.get('masks');
            const mask = masks[this.deletedFilter.maskId];
            if (mask) {
                unreserveStoredImage(mask.sourceUuid, `${this.layerId}`);
                delete masks[this.deletedFilter.maskId];
            }
            workingFileStore.set('masks', masks);
        }
        updateWorkingFileMasks(workingFileStore.get('masks'));

        (this.layerId as any) = null;
        (this.filterIndex as any) = null;
        (this.deletedFilter as any) = null;
    }

}
