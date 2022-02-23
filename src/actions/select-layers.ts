import { BaseAction } from './base';
import canvasStore from '@/store/canvas';
import workingFileStore from '@/store/working-file';

export class SelectLayersAction extends BaseAction {

    private newSelectedLayerIds!: number[];
    private previousSelectedLayerIds: number[] = [];
    private previousSelectedLayerIdsOverride: number[] | null = null;

    constructor(selectedLayerIds: number[], previousSelectedLayerIdsOverride?: number[]) {
        super('selectLayers', 'Select Layer(s)');
        this.newSelectedLayerIds = selectedLayerIds;
        if (previousSelectedLayerIdsOverride) {
            this.previousSelectedLayerIdsOverride = previousSelectedLayerIdsOverride;
        }
	}
	public async do() {
        super.do();

        if (this.previousSelectedLayerIdsOverride) {
            this.previousSelectedLayerIds = this.previousSelectedLayerIdsOverride;
        } else {
            this.previousSelectedLayerIds = workingFileStore.get('selectedLayerIds');
        }
        workingFileStore.set('selectedLayerIds', [...this.newSelectedLayerIds]);

        canvasStore.set('dirty', true);
	}

	public async undo() {
        super.undo();

        workingFileStore.set('selectedLayerIds', [...this.previousSelectedLayerIds]);

        canvasStore.set('dirty', true);
	}

    public free() {
        super.free();
    }

}
