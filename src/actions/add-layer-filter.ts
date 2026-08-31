import { BaseAction } from './base';

import { generateImageHash } from '@/lib/hash';
import { resizeImage } from '@/lib/image';
import { limitMaxDimension } from '@/lib/math';

import canvasStore from '@/store/canvas';
import { createStoredImage, getStoredImageOrCanvas, reserveStoredImage, unreserveStoredImage } from '@/store/image';
import workingFileStore, { getLayerById, getLayerGlobalTransform, regenerateLayerThumbnail } from '@/store/working-file';
import { updateWorkingFileLayer } from '@/store/data/working-file-database';
import {
    activeSelectionMask, activeSelectionMaskCanvasOffset, appliedSelectionMask,
    appliedSelectionMaskCanvasOffset, resampleSelectionMaskInLayerBounds,
} from '@/canvas/store/selection-state';
import { useRenderer } from '@/renderers';

import { updateBakedImageForLayer } from './baking';

import type { WorkingFileLayerFilter, WorkingFileLayerMask } from '@/types';

export class AddLayerFilterAction extends BaseAction {

    private layerId!: number;
    private layerFilter!: WorkingFileLayerFilter;
    private selectionMask!: HTMLImageElement | null;
    private selectionMaskCanvasOffset!: DOMPoint;

    private createdMaskId: number | undefined;
    private createdMaskImageUuid: string | undefined;

    constructor(layerId: number, layerFilter: WorkingFileLayerFilter) {
        super('addLayerFilter', 'action.addLayerFilter');
        this.layerId = layerId;
        this.layerFilter = layerFilter;
        this.selectionMask = activeSelectionMask.value ?? appliedSelectionMask.value;
        this.selectionMaskCanvasOffset = activeSelectionMask.value ? activeSelectionMaskCanvasOffset.value : appliedSelectionMaskCanvasOffset.value;
	}

	public async do() {
        super.do();

        const layers = workingFileStore.get('layers');
        const layer = getLayerById(this.layerId, layers);
        if (!layer) {
            throw new Error('Aborted - Layer with specified id not found.');
        }

        const maxTextureSize = await (await useRenderer()).getMaxTextureSize();

        let layerFilter = { ...this.layerFilter };

        if (this.createdMaskImageUuid || (this.selectionMask && this.selectionMaskCanvasOffset)) {
            const { width: textureWidth, height: textureHeight } =
                limitMaxDimension(layer.width, layer.height, maxTextureSize);
            if (!this.createdMaskImageUuid) {
                let selectionMaskImage = await resampleSelectionMaskInLayerBounds(
                    this.selectionMask!,
                    this.selectionMaskCanvasOffset,
                    new DOMPoint(layer.width, layer.height),
                    getLayerGlobalTransform(layer.id),
                );
                if (layer.width > maxTextureSize || layer.height > maxTextureSize) {
                    // TODO - selection mask doesn't support scaling
                    selectionMaskImage = await resizeImage(selectionMaskImage, textureWidth, textureHeight);
                }
                this.createdMaskImageUuid = await createStoredImage(selectionMaskImage);
                this.selectionMask = null;
                reserveStoredImage(this.createdMaskImageUuid, `${this.layerId}`);
            }
            const storedMaskImage = getStoredImageOrCanvas(this.createdMaskImageUuid);
            if (storedMaskImage) {
                // TODO - selection mask doesn't support scaling
                const mask: WorkingFileLayerMask = {
                    sourceUuid: this.createdMaskImageUuid,
                    offset: new DOMPoint(0, 0),
                    hash: await generateImageHash(storedMaskImage),
                };
                const masks = workingFileStore.get('masks');
                this.createdMaskId = workingFileStore.get('maskIdCounter');
                masks[this.createdMaskId] = mask;
                workingFileStore.set('maskIdCounter', this.createdMaskId + 1);
                workingFileStore.set('masks', masks);
                layerFilter.maskId = this.createdMaskId;
            }
        }

        layer.filters.push(layerFilter);

        regenerateLayerThumbnail(layer);
        updateBakedImageForLayer(layer);
        updateWorkingFileLayer(layer, false, workingFileStore.state);

        canvasStore.set('dirty', true);
	}

	public async undo() {
        super.undo();

        const layers = workingFileStore.get('layers');
        const layer = getLayerById(this.layerId, layers);
        if (!layer) {
            throw new Error('Aborted - Layer with specified id not found.');
        }

        layer.filters.pop();

        if (this.createdMaskId != null) {
            const masks = workingFileStore.get('masks');
            delete masks[this.createdMaskId];
            workingFileStore.set('masks', masks);
            this.createdMaskId = undefined;
        }

        regenerateLayerThumbnail(layer);
        updateBakedImageForLayer(layer);
        updateWorkingFileLayer(layer, false, workingFileStore.state);

        canvasStore.set('dirty', true);
	}

    public free() {
        super.free();

        if (!this.isDone && this.createdMaskImageUuid) {
            unreserveStoredImage(this.createdMaskImageUuid, `${this.layerId}`);
        }

        (this.layerId as any) = null;
        (this.layerFilter as any) = null;
        (this.selectionMask as any) = null;
        (this.createdMaskImageUuid as any) = null;
    }

}
