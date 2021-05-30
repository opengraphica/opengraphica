import { BaseAction } from './base';
import canvasStore from '@/store/canvas';
import workingFileStore from '@/store/working-file';

export class SelectLayersAction extends BaseAction {

    private newSelectedLayerIds!: number[];
    private previousSelectedLayerIds: number[] = [];

    constructor(selectedLayerIds: number[]) {
        super('selectLayers', 'Select Layer(s)');
        this.newSelectedLayerIds = selectedLayerIds;
	}
	public async do() {
        super.do();

        this.previousSelectedLayerIds = workingFileStore.get('selectedLayerIds');
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
