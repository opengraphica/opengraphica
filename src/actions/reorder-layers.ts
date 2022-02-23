import {
    ColorModel, WorkingFileLayer,
    WorkingFileGroupLayer, WorkingFileRasterLayer, WorkingFileRasterSequenceLayer, WorkingFileVectorLayer, WorkingFileTextLayer, WorkingFileAnyLayer,
    InsertAnyLayerOptions
} from '@/types';
import { BaseAction } from './base';
import { SelectLayersAction } from './select-layers';
import canvasStore from '@/store/canvas';
import workingFileStore, { getLayerById, getGroupLayerById } from '@/store/working-file';
import layerRenderers from '@/canvas/renderers';

export class ReorderLayersAction extends BaseAction {

    private insertLayerIds!: number[];
    private referenceLayerId!: number;
    private insertPosition!: 'below' | 'above' | 'topChild' | 'bottomChild';
    private insertLayerPreviousPositions: { groupId: number | null, index: number }[] = [];

    constructor(insertLayerIds: number[], referenceLayerId: number, insertPosition: 'below' | 'above' | 'topChild' | 'bottomChild') {
        super('reorderLayers', 'Reorder Layers');
        this.insertLayerIds = insertLayerIds;
        this.referenceLayerId = referenceLayerId;
        this.insertPosition = insertPosition;
	}
	public async do() {
        super.do();

        // Map ids to layer objects
        let insertLayers: WorkingFileAnyLayer<ColorModel>[] = [];
        for (let layerId of this.insertLayerIds) {
            const layer = getLayerById(layerId);
            if (!layer) {
                throw new Error('Cannot find insert layer.');
            }
            insertLayers.push(layer);
        }

        // Gather information about current insert layer state before moving them
        for (let layer of insertLayers) {
            if (layer) {
                const layerParent = this.getLayerParent(layer.id).layers;
                const layerIndex = layerParent.indexOf(layer);
                layerParent.splice(layerIndex, 1);
                this.insertLayerPreviousPositions.push({
                    groupId: layer.groupId,
                    index: layerIndex
                });
            }
        }

        // Get layer object for reference layer inserting around
        let referenceLayer = getLayerById(this.referenceLayerId);
        if (!referenceLayer) {
            throw new Error('Cannot find reference layer.');
        }

        // Insert the layers and change group IDs
        if (this.insertPosition === 'below' || this.insertPosition === 'above') {
            let referenceParent = this.getLayerParent(this.referenceLayerId);
            referenceParent.layers.splice(referenceParent.layers.indexOf(referenceLayer) + (this.insertPosition === 'below' ? 0 : 1), 0, ...insertLayers);
            for (let layer of insertLayers) {
                layer.groupId = referenceParent.id;
            }
        } else {
            const referenceGroupLayer = referenceLayer as WorkingFileGroupLayer<ColorModel>;
            if (!referenceGroupLayer) {
                throw new Error('Reference layer is not a group layer.');
            }
            referenceGroupLayer.layers.splice(this.insertPosition === 'bottomChild' ? 0 : referenceGroupLayer.layers.length, 0, ...insertLayers);
        }

        workingFileStore.set('layers', [...workingFileStore.get('layers')]);
        canvasStore.set('dirty', true);
	}

	public async undo() {
        super.undo();

        // Map ids to layer objects
        let insertedLayers: WorkingFileLayer<ColorModel>[] = [];
        for (let layerId of this.insertLayerIds) {
            const layer = getLayerById(layerId);
            if (!layer) {
                throw new Error('Cannot find insert layer.');
            }
            insertedLayers.push(layer);
        }

        // Get layer object for reference layer inserting around
        let referenceLayer = getLayerById(this.referenceLayerId);
        if (!referenceLayer) {
            throw new Error('Cannot find reference layer.');
        }

        // Remove layers from inserted positions
        if (this.insertPosition === 'below' || this.insertPosition === 'above') {
            let referenceParent = this.getLayerParent(this.referenceLayerId);
            referenceParent.layers.splice(referenceParent.layers.indexOf(referenceLayer) + (this.insertPosition === 'below' ? 0 : 1), insertedLayers.length);
        } else {
            const referenceGroupLayer = referenceLayer as WorkingFileGroupLayer<ColorModel>;
            if (!referenceGroupLayer) {
                throw new Error('Reference layer is not a group layer.');
            }
            referenceGroupLayer.layers.splice(this.insertPosition === 'bottomChild' ? 0 : referenceGroupLayer.layers.length, insertedLayers.length);
        }

        // Place inserted layers back in their original positions
        let previousPositions = this.insertLayerPreviousPositions.reverse();
        for (let [i, layer] of insertedLayers.reverse().entries()) {
            if (layer) {
                const groupId = previousPositions[i].groupId;
                const layerParent = groupId == null ? workingFileStore.get('layers') : getGroupLayerById(groupId)?.layers;
                if (!layerParent) {
                    throw new Error('Could not find layer parent.')
                }
                layerParent.splice(previousPositions[i].index, 0, layer);
                layer.groupId = groupId;
            }
        }

        workingFileStore.set('layers', [...workingFileStore.get('layers')]);
        canvasStore.set('dirty', true);
	}

    public free() {
        super.free();
    }

    private getLayerParent(id: number): { id: number | null, layers: WorkingFileLayer<ColorModel>[] } {
        const layers = workingFileStore.get('layers');
        let parent: { id: number | null, layers: WorkingFileLayer<ColorModel>[] } = {
            id: null,
            layers: layers
        };
        if (id != null) {
            const groupLayer = getGroupLayerById(id, parent.layers);
            if (groupLayer) {
                parent = {
                    id: groupLayer.id,
                    layers: groupLayer.layers
                };
            }
        }
        return parent;
    }

}
