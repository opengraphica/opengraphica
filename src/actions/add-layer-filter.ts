import { BaseAction } from './base';
import canvasStore from '@/store/canvas';
import workingFileStore, { getLayerById, regenerateLayerThumbnail } from '@/store/working-file';

import type { WorkingFileLayerFilter } from '@/types';

export class AddLayerFilterAction extends BaseAction {

    private layerId!: number;
    private layerFilter!: WorkingFileLayerFilter;

    constructor(layerId: number, layerFilter: WorkingFileLayerFilter) {
        super('addLayerFilter', 'action.addLayerFilter');
        this.layerId = layerId;
        this.layerFilter = layerFilter;
	}

	public async do() {
        super.do();

        const layers = workingFileStore.get('layers');
        const layer = getLayerById(this.layerId, layers);
        if (!layer) {
            throw new Error('Aborted - Layer with specified id not found.');
        }

        layer.filters.push(this.layerFilter);

        regenerateLayerThumbnail(layer);

        canvasStore.set('dirty', true);
	}

	public async undo() {
        super.undo();

        const layers = workingFileStore.get('layers');
        const layer = getLayerById(this.layerId, layers);
        if (!layer) {
            throw new Error('Aborted - Layer with specified id not found.');
        }

        layer.filters.pop();

        regenerateLayerThumbnail(layer);

        canvasStore.set('dirty', true);
	}

    public free() {
        super.free();
        (this.layerId as any) = null;
        (this.layerFilter as any) = null;
    }

}
