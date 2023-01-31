import { BaseAction } from './base';
import canvasStore from '@/store/canvas';
import { getLayerById, regenerateLayerThumbnail } from '@/store/working-file';
import { updateBakedImageForLayer } from './baking';

import type { WorkingFileLayerFilter } from '@/types';

export class ReorderLayerFiltersAction extends BaseAction {

    private layerId!: number;
    private insertFilterIndices!: number[];
    private referenceFilterIndex!: number;
    private insertPosition!: 'before' | 'after' | 'first' | 'last';
    private referenceFilterIndexAfterInsert: number = -1;

    constructor(layerId: number, insertFilterIndices: number[], referenceFilterIndex: number, insertPosition: 'before' | 'after' | 'first' | 'last') {
        super('reorderLayerFilters', 'action.reorderLayerFilters');
        this.layerId = layerId;
        this.insertFilterIndices = insertFilterIndices;
        this.referenceFilterIndex = referenceFilterIndex;
        this.insertPosition = insertPosition;
	}
	public async do() {
        super.do();

        // Get layer object
        const layer = getLayerById(this.layerId);
        if (!layer) {
            throw new Error('Aborted - Cannot find insert layer.');
        }

        // Remove insertFilterIndices from the list
        let referenceFilterIndex = this.referenceFilterIndex;
        const insertFilters = [];
        for (const index of this.insertFilterIndices.sort().reverse()) {
            if (index < this.referenceFilterIndex) {
                referenceFilterIndex -= 1;
            }
            insertFilters.unshift(layer.filters.splice(index, 1)[0]);
        }

        // Insert the filters around reference position
        if (this.insertPosition === 'before' || this.insertPosition === 'after') {
            layer.filters.splice(referenceFilterIndex + (this.insertPosition === 'before' ? 0 : 1), 0, ...insertFilters);
            this.referenceFilterIndexAfterInsert = referenceFilterIndex + (this.insertPosition === 'before' ? insertFilters.length : 0);
        } else {
            layer.filters.splice(this.insertPosition === 'first' ? 0 : layer.filters.length, 0, ...insertFilters);
            this.referenceFilterIndexAfterInsert = referenceFilterIndex + (this.insertPosition === 'first' ? insertFilters.length : 0);
        }

        regenerateLayerThumbnail(layer);
        updateBakedImageForLayer(layer);

        canvasStore.set('dirty', true);
	}

	public async undo() {
        super.undo();

        // Get layer object
        const layer = getLayerById(this.layerId);
        if (!layer) {
            throw new Error('Aborted - Cannot find insert layer.');
        }

        // Determine modified reference insert index
        // let referenceFilterIndex = this.referenceFilterIndex;
        // for (const index of this.insertFilterIndices) {
        //     if (index < this.referenceFilterIndex) {
        //         referenceFilterIndex -= 1;
        //     }
        // }

        // Remove filters from inserted positions
        let removedFilters: WorkingFileLayerFilter[] = [];
        if (this.insertPosition === 'before' || this.insertPosition === 'after') {
            removedFilters = layer.filters.splice(this.referenceFilterIndexAfterInsert + (this.insertPosition === 'before' ? -this.insertFilterIndices.length : 1), this.insertFilterIndices.length);
        } else {
            removedFilters = layer.filters.splice(this.insertPosition === 'first' ? 0 : layer.filters.length - this.insertFilterIndices.length, this.insertFilterIndices.length);
        }

        // Place inserted filters back in their original positions
        let previousPositions = this.insertFilterIndices.sort();
        let sortedRemovedFilters = [...removedFilters].sort((a, b) => {
            const originalPositionA = this.insertFilterIndices[removedFilters.indexOf(a)];
            const originalPositionB = this.insertFilterIndices[removedFilters.indexOf(b)];
            return originalPositionA < originalPositionB ? -1 : (originalPositionA > originalPositionB ? 1 : 0);
        });
        for (let [filterIndex, insertPosition] of previousPositions.entries()) {
            layer.filters.splice(insertPosition, 0, sortedRemovedFilters[filterIndex]);
        }

        regenerateLayerThumbnail(layer);
        updateBakedImageForLayer(layer);

        canvasStore.set('dirty', true);
	}

    public free() {
        super.free();
    }

}
