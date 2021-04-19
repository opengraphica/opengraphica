import {
    RGBAColor, WorkingFileLayer, WorkingFileAnyLayer,
    WorkingFileGroupLayer, UpdateAnyLayerOptions
} from '@/types';
import { BaseAction } from './base';
import canvasStore from '@/store/canvas';
import workingFileStore from '@/store/working-file';

export class UpdateLayerAction<GroupLayerOptions extends UpdateAnyLayerOptions<RGBAColor>> extends BaseAction {

    private updateLayerOptions!: GroupLayerOptions;
    private previousProps: Partial<WorkingFileAnyLayer<RGBAColor>> = {};

    constructor(updateLayerOptions: GroupLayerOptions) {
        super('updateLayer', 'Update Layer');
        this.updateLayerOptions = updateLayerOptions;
	}
	public async do() {
        super.do();

        const layers = workingFileStore.get('layers');
        const layer = this.findLayer(this.updateLayerOptions.id, layers);
        if (!layer) {
            throw new Error('Layer with specified id not found.');
        }
        for (let prop in this.updateLayerOptions) {
            if (prop !== 'id') {
                this.previousProps = (layer as any)[prop];
                (layer as any)[prop] = this.updateLayerOptions[prop];
            }
        }

        canvasStore.set('dirty', true);
	}

	public async undo() {
        super.undo();

        const layers = workingFileStore.get('layers');
        const layer = this.findLayer(this.updateLayerOptions.id, layers);
        for (let prop in this.previousProps) {
            if (prop !== 'id') {
                (layer as any)[prop] = (this.previousProps as any)[prop];
            }
        }

        canvasStore.set('dirty', true);
	}

    public free() {
        super.free();
        (this.updateLayerOptions as any) = null;
        (this.previousProps as any) = null;
    }

    private findLayer(id: number, parent: WorkingFileLayer<RGBAColor>[]): WorkingFileLayer<RGBAColor> | null {
        for (let layer of parent) {
            if (layer.id === id) {
                return layer;
            } else if (layer.type === 'group') {
                let foundLayer = this.findLayer(id, (layer as WorkingFileGroupLayer<RGBAColor>).layers);
                if (foundLayer) {
                    return foundLayer;
                }
            }
        }
        return null;
    }

}
