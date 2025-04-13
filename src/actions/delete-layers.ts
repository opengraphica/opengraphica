import {
    ColorModel, WorkingFileAnyLayer
} from '@/types';
import { BaseAction } from './base';
import { SelectLayersAction } from './select-layers';
import { updateBakedImageForLayer } from './baking';

import canvasStore from '@/store/canvas';
import { unreserveStoredImage } from '@/store/image';
import { unreserveStoredSvg } from '@/store/svg';
import { unreserveStoredVideo } from '@/store/video';
import workingFileStore, { calculateLayerOrder, getLayerById, getGroupLayerById } from '@/store/working-file';
import { updateWorkingFileMasks, updateWorkingFile, updateWorkingFileLayer, deleteWorkingFileLayer } from '@/store/data/working-file-database';

import appEmitter from '@/lib/emitter';

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
                appEmitter.emit('app.workingFile.layerDetached', layer);
                layer.bakedImage = null;
            }
        }

        // Set the modified layer list
        workingFileStore.set('layers', layers);

        calculateLayerOrder();
        canvasStore.set('dirty', true);

        // Update the working file backup
        updateWorkingFile({ layers: workingFileStore.get('layers') });
        for (const layerId of this.deleteLayerIds) {
            deleteWorkingFileLayer(layerId);
        }
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
            appEmitter.emit('app.workingFile.layerAttached', layer);
            updateBakedImageForLayer(layer);
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

        // Update the working file backup
        updateWorkingFile({ layers: workingFileStore.get('layers') });
        for (const layerId of this.deleteLayerIds) {
            const layer = getLayerById(layerId);
            if (layer) updateWorkingFileLayer(layer);
        }
	}

    public free() {
        super.free();

        if (this.isDone) {
            for (let deletedLayerInfo of this.deletedLayers) {
                const layer = deletedLayerInfo.layer;
                if (layer.type === 'raster') {
                    if (layer.data.sourceUuid) {
                        unreserveStoredImage(layer.data.sourceUuid, `${layer.id}`);
                    }
                }
                else if (layer.type === 'rasterSequence') {
                    for (let frame of layer.data.sequence) {
                        if (frame.image.sourceUuid) {
                            unreserveStoredImage(frame.image.sourceUuid, `${layer.id}`);
                        }
                    }
                }
                else if (layer.type === 'vector') {
                    if (layer.data.sourceUuid) {
                        unreserveStoredSvg(layer.data.sourceUuid, `${layer.id}`);
                    }
                }
                else if (layer.type === 'video') {
                    if (layer.data.sourceUuid) {
                        unreserveStoredVideo(layer.data.sourceUuid, `${layer.id}`);
                    }
                }
                for (const filter of layer.filters) {
                    if (filter.maskId != null) {
                        const masks = workingFileStore.get('masks');
                        const mask = masks[filter.maskId];
                        if (mask) {
                            unreserveStoredImage(mask.sourceUuid, `${layer.id}`);
                            delete masks[filter.maskId];
                        }
                        workingFileStore.set('masks', masks);
                    }
                }
            }
        }
        updateWorkingFileMasks(workingFileStore.get('masks'), workingFileStore.get('maskIdCounter'));

        (this.deleteLayerIds as any) = null;
        (this.deletedLayers as any) = null;

        if (this.selectLayersAction) {
            this.selectLayersAction.free();
            this.selectLayersAction = null;
        }
    }

}
