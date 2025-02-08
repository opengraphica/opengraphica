import { BaseAction } from './base';
import canvasStore from '@/store/canvas';
import workingFileStore, { getLayerById, regenerateLayerThumbnail, discardMaskIfUnused } from '@/store/working-file';
import { updateWorkingFileLayer } from '@/store/data/working-file-database';
import { updateBakedImageForLayer } from './baking';

export class UpdateLayerFilterMaskAction extends BaseAction {

    private layerId!: number;
    private filterIndex!: number;
    private newMaskId!: number | undefined;
    private oldMaskId!: number | undefined;

    constructor(layerId: number, filterIndex: number, newMaskId: number | undefined) {
        super('updateLayerFilterMask', 'action.updateLayerFilterMask');
        this.layerId = layerId;
        this.filterIndex = filterIndex;
        this.newMaskId = newMaskId;
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
        this.oldMaskId = filter.maskId;
        filter.maskId = this.newMaskId;

        regenerateLayerThumbnail(layer);
        updateBakedImageForLayer(layer);
        updateWorkingFileLayer(layer, false, workingFileStore.state);

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
        filter.maskId = this.oldMaskId;

        regenerateLayerThumbnail(layer);
        updateBakedImageForLayer(layer);
        updateWorkingFileLayer(layer, false, workingFileStore.state);

        canvasStore.set('dirty', true);
	}

    public free() {
        super.free();

        if (this.isDone) {
            discardMaskIfUnused(this.oldMaskId);
        } else {
            discardMaskIfUnused(this.newMaskId);
        }

        (this.layerId as any) = null;
        (this.filterIndex as any) = null;
    }

}
