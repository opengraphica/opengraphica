import { BaseAction } from './base';
import canvasStore from '@/store/canvas';
import workingFileStore from '@/store/working-file';
import { updateWorkingFile } from '@/store/data/working-file-database';

export class SelectLayersAction extends BaseAction {

    private newSelectedLayerIds!: number[];
    private previousSelectedLayerIds: number[] = [];
    private previousSelectedLayerIdsOverride: number[] | null = null;

    constructor(selectedLayerIds: number[], previousSelectedLayerIdsOverride?: number[]) {
        super('selectLayers', 'action.selectLayers');
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

        // Update the working file backup
        updateWorkingFile({ selectedLayerIds: workingFileStore.get('selectedLayerIds') });
	}

	public async undo() {
        super.undo();

        workingFileStore.set('selectedLayerIds', [...this.previousSelectedLayerIds]);

        canvasStore.set('dirty', true);

        // Update the working file backup
        updateWorkingFile({ selectedLayerIds: workingFileStore.get('selectedLayerIds') });
	}

    public free() {
        super.free();
    }

}
