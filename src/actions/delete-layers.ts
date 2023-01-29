import {
    ColorModel, WorkingFileAnyLayer
} from '@/types';
import { BaseAction } from './base';
import { SelectLayersAction } from './select-layers';
import { revokeObjectUrlIfLastUser } from './data/memory-management';
import canvasStore from '@/store/canvas';
import workingFileStore, { calculateLayerOrder, getLayerById, getGroupLayerById } from '@/store/working-file';

export class DeleteLayersAction extends BaseAction {

    private deleteLayerIds: number[] = [];
    private deletedLayers: {
        layer: WorkingFileAnyLayer<ColorModel>,
        parentIndex: number
    }[] = [];
    private selectLayersAction: SelectLayersAction | null = null;

    constructor(layerIds: number[]) {
        super('deleteLayers', 'action.deleteLayers');
        this.deleteLayerIds = layerIds;
	}
	public async do() {
        super.do();

        // Reset selection
        this.selectLayersAction = new SelectLayersAction([]);
        this.selectLayersAction.do();

        const layers = workingFileStore.get('layers');

        for (let layerId of this.deleteLayerIds) {
            const layer = getLayerById(layerId);
            if (layer) {
                let parentList = layers;
                if (layer.groupId != null) {
                    parentList = getGroupLayerById(layer.groupId, layers)?.layers || layers;
                }
                let parentListIndex = parentList.indexOf(layer);
                if (parentListIndex > -1) {
                    parentList.splice(parentList.indexOf(layer), 1);
                    this.deletedLayers.unshift({
                        layer,
                        parentIndex: parentListIndex
                    });
                }
                layer.renderer.detach();
            }
        }

        // Set the modified layer list
        workingFileStore.set('layers', layers);

        calculateLayerOrder();
        canvasStore.set('dirty', true);
	}

	public async undo() {
        super.undo();

        const layers = workingFileStore.get('layers');

        for (let deletedLayerInfo of this.deletedLayers) {
            const layer = deletedLayerInfo.layer;
            let parentList = layers;
            if (layer.groupId != null) {
                parentList = getGroupLayerById(layer.groupId)?.layers || layers;
            }
            parentList.splice(deletedLayerInfo.parentIndex, 0, layer);
            await layer.renderer.attach(layer);
        }
        this.deletedLayers = [];

        // Set the modified layer list
        workingFileStore.set('layers', layers);

        // Undo selection
        if (this.selectLayersAction) {
            this.selectLayersAction.undo();
            this.selectLayersAction = null;
        }

        calculateLayerOrder();
        canvasStore.set('dirty', true);
	}

    public free() {
        super.free();

        for (let deletedLayerInfo of this.deletedLayers) {
            const layer = deletedLayerInfo.layer;
            if (layer.type === 'raster') {
                if (layer.data.sourceImage && layer.data.sourceImageIsObjectUrl) {
                    revokeObjectUrlIfLastUser(layer.data.sourceImage.src, layer.id);
                }
            }
            if (layer.type === 'rasterSequence') {
                for (let frame of layer.data.sequence) {
                    if (frame.image.sourceImage && frame.image.sourceImageIsObjectUrl) {
                        revokeObjectUrlIfLastUser(frame.image.sourceImage.src, layer.id);
                    }
                }
            }
        }

        (this.deleteLayerIds as any) = null;
        (this.deletedLayers as any) = null;

        if (this.selectLayersAction) {
            this.selectLayersAction.free();
            this.selectLayersAction = null;
        }
    }

}
