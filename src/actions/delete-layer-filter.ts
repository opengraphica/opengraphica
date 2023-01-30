import { BaseAction } from './base';
import canvasStore from '@/store/canvas';
import workingFileStore, { getLayerById, regenerateLayerThumbnail } from '@/store/working-file';
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

        canvasStore.set('dirty', true);
	}

    public free() {
        super.free();
        (this.layerId as any) = null;
        (this.filterIndex as any) = null;
        (this.deletedFilter as any) = null;
    }

}
