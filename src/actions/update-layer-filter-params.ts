import { BaseAction } from './base';
import canvasStore from '@/store/canvas';
import workingFileStore, { getLayerById, regenerateLayerThumbnail } from '@/store/working-file';
import { updateWorkingFileLayer } from '@/store/data/working-file-database';
import { updateBakedImageForLayer } from './baking';

export class UpdateLayerFilterParamsAction extends BaseAction {

    private layerId!: number;
    private filterIndex!: number;
    private newParams!: Record<string, unknown>;
    private oldParams!: Record<string, unknown>;

    constructor(layerId: number, filterIndex: number, newParams: Record<string, unknown>) {
        super('updateLayerFilterParams', 'action.updateLayerFilterParams');
        this.layerId = layerId;
        this.filterIndex = filterIndex;
        this.newParams = newParams;
	}

	public async do() {
        super.do();

        const layers = workingFileStore.get('layers');
        const layer = getLayerById(this.layerId, layers);
        if (!layer) {
            throw new Error('Aborted - Layer with specified id not found.');
        }

        if (!layer.filters[this.filterIndex]) {
            throw new Error('Aborted - Filter does not exist at the specified index.');
        }

        const filter = layer.filters[this.filterIndex];
        this.oldParams = filter.params;
        filter.params = { ...this.newParams };

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

        if (!layer.filters[this.filterIndex]) {
            throw new Error('Aborted - Filter does not exist at the specified index.');
        }

        const filter = layer.filters[this.filterIndex];
        filter.params = { ...this.oldParams };

        regenerateLayerThumbnail(layer);
        updateBakedImageForLayer(layer);
        updateWorkingFileLayer(layer);

        canvasStore.set('dirty', true);
	}

    public free() {
        super.free();
        (this.layerId as any) = null;
        (this.filterIndex as any) = null;
        (this.newParams as any) = null;
        (this.oldParams as any) = null;
    }

}
