import { BaseAction } from './base';
import canvasStore from '@/store/canvas';
import workingFileStore, { getLayerById, regenerateLayerThumbnail } from '@/store/working-file';

export class UpdateLayerFilterDisabledAction extends BaseAction {

    private layerId!: number;
    private filterIndex!: number;
    private newDisabled: boolean | undefined;
    private oldDisabled: boolean | undefined;

    constructor(layerId: number, filterIndex: number, isDisabled: boolean) {
        super('updateLayerFilterDisabled', isDisabled ? 'action.disableLayerFilter' : 'action.enableLayerFilter');
        this.layerId = layerId;
        this.filterIndex = filterIndex;
        this.newDisabled = isDisabled === true ? true : undefined;
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

        this.oldDisabled = layer.filters[this.filterIndex].disabled;
        if (this.newDisabled) {
            layer.filters[this.filterIndex].disabled = true;
        } else {
            delete layer.filters[this.filterIndex].disabled;
        }

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

        if (!layer.filters[this.filterIndex]) {
            throw new Error('Aborted - Filter does not exist at the specified index.');
        }

        if (this.oldDisabled) {
            layer.filters[this.filterIndex].disabled = true;
        } else {
            delete layer.filters[this.filterIndex].disabled;
        }

        regenerateLayerThumbnail(layer);

        canvasStore.set('dirty', true);
	}

    public free() {
        super.free();
        (this.layerId as any) = null;
        (this.filterIndex as any) = null;
    }

}
