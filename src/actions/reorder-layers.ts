import {
    RGBAColor, WorkingFileLayer,
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
    private insertPosition!: 'before' | 'after' | 'first' | 'last';
    private insertLayerPreviousPositions: { groupId: number | null, index: number }[] = [];

    constructor(insertLayerIds: number[], referenceLayerId: number, insertPosition: 'before' | 'after' | 'first' | 'last') {
        super('reorderLayers', 'Reorder Layers');
        console.log(arguments);
        this.insertLayerIds = insertLayerIds;
        this.referenceLayerId = referenceLayerId;
        this.insertPosition = insertPosition;
	}
	public async do() {
        super.do();

        let insertLayers: WorkingFileLayer<RGBAColor>[] = [];
        for (let layerId of this.insertLayerIds) {
            const layer = getLayerById(layerId);
            if (!layer) {
                throw new Error('Cannot find insert layer.');
            }
            insertLayers.push(layer);
        }

        for (let layer of insertLayers) {
            if (layer) {
                const layerParent = this.getLayerParent(layer.id);
                const layerIndex = layerParent.indexOf(layer);
                layerParent.splice(layerIndex, 1);
                this.insertLayerPreviousPositions.push({
                    groupId: layer.groupId,
                    index: layerIndex
                });
            }
        }

        let referenceLayer = getLayerById(this.referenceLayerId);
        if (!referenceLayer) {
            throw new Error('Cannot find reference layer.');
        }

        if (this.insertPosition === 'before' || this.insertPosition === 'after') {
            let referenceParent = this.getLayerParent(this.referenceLayerId);
            referenceParent.splice(referenceParent.indexOf(referenceLayer) + (this.insertPosition === 'before' ? 0 : 1), 0, ...insertLayers);
        } else {
            const referenceGroupLayer = referenceLayer as WorkingFileGroupLayer<RGBAColor>;
            if (!referenceGroupLayer) {
                throw new Error('Reference layer is not a group layer.');
            }
            referenceGroupLayer.layers.splice(0, 0, ...insertLayers);
        }

        workingFileStore.set('layers', [...workingFileStore.get('layers')]);
        canvasStore.set('dirty', true);

	}

	public async undo() {
        super.undo();


        canvasStore.set('dirty', true);
	}

    public free() {
        super.free();
    }

    private getLayerParent(id: number) {
        const layers = workingFileStore.get('layers');
        let parent: WorkingFileLayer<RGBAColor>[] | null = layers;
        if (id != null) {
            const groupLayer = getGroupLayerById(id, parent);
            if (groupLayer) {
                parent = groupLayer.layers;
            }
        }
        return parent;
    }

}
