import { BaseAction } from './base';
import { activeSelectionMask, activeSelectionMaskCanvasOffset, appliedSelectionMask, appliedSelectionMaskCanvasOffset, blitActiveSelectionMask } from '@/canvas/store/selection-state';
import canvasStore from '@/store/canvas';
import workingFileStore, { getLayerById, getLayerGlobalTransform } from '@/store/working-file';
import { createImageFromCanvas, getImageDataFromImage, getImageDataEmptyBounds, createEmptyCanvasWith2dContext } from '@/lib/image';
import { ClearSelectionAction } from './clear-selection';
import { UpdateLayerAction } from './update-layer';
import { SelectLayersAction } from './select-layers';
import renderers from '@/canvas/renderers';
import { getStoredImageOrCanvas, createStoredImage } from '@/store/image';

import type {
    ColorModel, UpdateAnyLayerOptions, UpdateRasterLayerOptions,
} from '@/types';

interface DeleteLayerSelectionAreaOptions {
    clearSelection?: boolean;
}

export class DeleteLayerSelectionAreaAction extends BaseAction {

    private layerIds: number[];
    private clearSelection: boolean = false;

    private clearSelectionAction: ClearSelectionAction | null = null;
    private updateLayerActions: UpdateLayerAction<UpdateAnyLayerOptions<ColorModel>>[] = [];

    constructor(layerIds: number[] = workingFileStore.state.selectedLayerIds, options?: DeleteLayerSelectionAreaOptions) {
        super('deleteLayerSelectionArea', 'action.deleteLayerSelectionArea');
        this.layerIds = layerIds;

        this.clearSelection = (options?.clearSelection === false) ? false : true;
	}

	public async do() {
        super.do();

        this.freeEstimates.memory = 0;
        this.freeEstimates.database = 0;

        const layersToModify = [];
        for (const layerId of this.layerIds) {
            const layer = getLayerById(layerId);
            if (layer) {
                layersToModify.push(layer);
            }
        }

        // Edit image data for each layer
        this.updateLayerActions = [];
        for (const layer of layersToModify) {
            if (layer.type === 'raster') {
                const sourceImage = getStoredImageOrCanvas(layer.data.sourceUuid);
                if (sourceImage) {
                    const selectionMask = activeSelectionMask.value ?? appliedSelectionMask.value;
                    if (!selectionMask) continue;
                    const selectionMaskOffset = activeSelectionMask.value ? activeSelectionMaskCanvasOffset.value : appliedSelectionMaskCanvasOffset.value;
                    const layerTransform = getLayerGlobalTransform(layer.id);
                    const p0 = selectionMaskOffset.matrixTransform(layerTransform.inverse());
                    const p1 = new DOMPoint(selectionMaskOffset.x + selectionMask.width, selectionMaskOffset.y).matrixTransform(layerTransform.inverse());
                    const p2 = new DOMPoint(selectionMaskOffset.x, selectionMaskOffset.y + selectionMask.height).matrixTransform(layerTransform.inverse());
                    const p3 = new DOMPoint(selectionMaskOffset.x + selectionMask.width, selectionMaskOffset.y + selectionMask.height).matrixTransform(layerTransform.inverse());
                    const topLeft = new DOMPoint(Math.min(p0.x, p1.x, p2.x, p3.x), Math.min(p0.y, p1.y, p2.y, p3.y));
                    topLeft.x = Math.max(0, Math.floor(topLeft.x - 1));
                    topLeft.y = Math.max(0, Math.floor(topLeft.y - 1));
                    const bottomRight = new DOMPoint(Math.max(p0.x, p1.x, p2.x, p3.x), Math.max(p0.y, p1.y, p2.y, p3.y));
                    bottomRight.x = Math.min(sourceImage.width, Math.ceil(bottomRight.x + 1));
                    bottomRight.y = Math.min(sourceImage.height, Math.ceil(bottomRight.y + 1));
                    const updateChunkImage = await blitActiveSelectionMask(sourceImage, layerTransform, 'source-out', {
                        sx: topLeft.x,
                        sy: topLeft.y,
                        sWidth: bottomRight.x - topLeft.x,
                        sHeight: bottomRight.y - topLeft.y,
                    });

                    const updateLayerAction = new UpdateLayerAction<UpdateRasterLayerOptions>({
                        id: layer.id,
                        data: {
                            updateChunks: [{
                                x: topLeft.x,
                                y: topLeft.y,
                                width: updateChunkImage.width,
                                height: updateChunkImage.height,
                                data: updateChunkImage,
                                mode: 'replace',
                            }],
                        },
                    });
                    await updateLayerAction.do();
                    this.freeEstimates.memory += updateLayerAction.freeEstimates.memory;
                    this.freeEstimates.database += updateLayerAction.freeEstimates.database;
                    this.updateLayerActions.push(updateLayerAction);
                }
            }
        }

        if (this.clearSelection && !this.clearSelectionAction) {
            this.clearSelectionAction = new ClearSelectionAction();
        }

        if (this.clearSelectionAction) {
            await this.clearSelectionAction.do();
            this.freeEstimates.memory += this.clearSelectionAction.freeEstimates.memory;
            this.freeEstimates.database += this.clearSelectionAction.freeEstimates.database;
        }


        canvasStore.set('dirty', true);
        canvasStore.set('viewDirty', true);
    }

    public async undo() {
        super.undo();

        this.freeEstimates.memory = 0;
        this.freeEstimates.database = 0;

        if (this.clearSelectionAction) {
            await this.clearSelectionAction.undo();
            this.freeEstimates.memory += this.clearSelectionAction.freeEstimates.memory;
            this.freeEstimates.database += this.clearSelectionAction.freeEstimates.database;
        }

        for (const updateLayerAction of this.updateLayerActions) {
            await updateLayerAction.undo();
            this.freeEstimates.memory += updateLayerAction.freeEstimates.memory;
            this.freeEstimates.database += updateLayerAction.freeEstimates.database;
        }

        canvasStore.set('dirty', true);
        canvasStore.set('viewDirty', true);
    }

    public async free() {
        super.free();

        if (this.clearSelectionAction) {
            this.clearSelectionAction.free();
            this.clearSelectionAction = null;
        }

        for (const updateLayerAction of this.updateLayerActions) {
            updateLayerAction.free();
        }
        (this.updateLayerActions as any) = null;
    }
}