import cloneDeep from 'lodash/cloneDeep';

import {
    activeSelectionMask, activeSelectionMaskCanvasOffset, appliedSelectionMask, appliedSelectionMaskCanvasOffset,
    createAppliedSelectionPaths,
} from '@/canvas/store/selection-state';
import canvasStore from '@/store/canvas';
import { createStoredImage } from '@/store/image';
import { cloneStoredSvg } from '@/store/svg';
import workingFileStore, {
    getCanvasRenderingContext2DSettings, getSelectedLayers, ensureUniqueLayerSiblingName, getLayerById,
} from '@/store/working-file';
import { updateWorkingFile, updateWorkingFileLayer, deleteWorkingFileLayer } from '@/store/data/working-file-database';

import { getImageDataFromImage, getImageDataEmptyBounds } from '@/lib/image';

import { BaseAction } from './base';
import { ClearSelectionAction } from './clear-selection';
import { DeleteLayerSelectionAreaAction } from './delete-layer-selection-area';
import { InsertLayerAction } from './insert-layer';
import { SelectLayersAction } from './select-layers';

import renderers from '@/canvas/renderers';

import {
    ColorModel, WorkingFileRasterLayer, WorkingFileRasterSequenceLayer, InsertRasterLayerOptions,
    InsertVectorLayerOptions,
    VectorPathCommandMove, VectorPathCommandLine,
} from '@/types';

interface CreateNewLayersFromSelectionOptions {
    clearSelection?: boolean;
    selectNewLayers?: 'replace' | 'combine';
}

export class CreateNewLayersFromSelectionAction extends BaseAction {

    private selectNewLayers: 'replace' | 'combine' | 'none' = 'none';
    private clearSelection: boolean = false;

    private appliedSelectionPaths: Array<Array<VectorPathCommandMove | VectorPathCommandLine>> = [];
    private clearSelectionAction: ClearSelectionAction | null = null;
    private insertLayerActions: InsertLayerAction<any>[] = [];
    private insertVectorLayerIndices: Set<number> = new Set();
    private deleteSelectionAreaActions: DeleteLayerSelectionAreaAction[] = [];
    private selectLayersAction: SelectLayersAction | null = null;
    private insertedLayerIds: number[] = [];

    constructor(options: CreateNewLayersFromSelectionOptions = {}) {
        super('createNewLayersFromSelection', 'action.createNewLayersFromSelection');
        if (options.clearSelection) {
            this.clearSelection = options.clearSelection;
        }
        if (options.selectNewLayers) {
            this.selectNewLayers = options.selectNewLayers;
        }
    }

    public async do() {
        super.do();

        this.freeEstimates.memory = 0;
        this.freeEstimates.database = 0;

        if (this.insertLayerActions.length === 0) {

            // Get list of currently selected layers.
            const selectedLayers = getSelectedLayers();

            // Get selection mask info
            const selectionMask: HTMLImageElement | null = activeSelectionMask.value || appliedSelectionMask.value;
            if (!selectionMask) {
                throw new Error('Aborted - No selection mask exists.');
            }
            const selectionOffset: DOMPoint = (selectionMask === activeSelectionMask.value ? activeSelectionMaskCanvasOffset.value : appliedSelectionMaskCanvasOffset.value);
            const selectionBounds = getImageDataEmptyBounds(getImageDataFromImage(selectionMask));

            const workingCanvas = document.createElement('canvas');
            workingCanvas.width = selectionBounds.right - selectionBounds.left;
            workingCanvas.height = selectionBounds.bottom - selectionBounds.top;
            const ctx = workingCanvas.getContext('2d', getCanvasRenderingContext2DSettings());
            if (!ctx) {
                throw new Error('Aborted - Couldn\'t create canvas context.');
            }
            ctx.imageSmoothingEnabled = false;

            // Create new layer for each of the selected layers.
            for (let layer of selectedLayers) {
                if (['raster', 'rasterSequence'].includes(layer.type)) {
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.clearRect(0, 0, workingCanvas.width, workingCanvas.height);
                    ctx.save();
                    ctx.translate(-selectionOffset.x - selectionBounds.left, -selectionOffset.y - selectionBounds.top);

                    // Why did I have this here in the first place? Seems to mess everything up when any transform is applied.
                    // const transform = getLayerGlobalTransform(layer);
                    // ctx.transform(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f);

                    if (layer.type === 'raster') {
                        new renderers['2d'].raster().draw(ctx, layer as WorkingFileRasterLayer<ColorModel>);
                    } else {
                        new renderers['2d'].rasterSequence().draw(ctx, layer as WorkingFileRasterSequenceLayer<ColorModel>);
                    }
                    ctx.restore();
                    ctx.globalCompositeOperation = 'destination-in';
                    ctx.drawImage(selectionMask, -selectionBounds.left, -selectionBounds.top);
                    ctx.globalCompositeOperation = 'source-over';
                    
                    const sourceUuid = await createStoredImage(workingCanvas);

                    this.insertLayerActions.push(
                        new InsertLayerAction<InsertRasterLayerOptions<ColorModel>>({
                            type: 'raster',
                            name: ensureUniqueLayerSiblingName(layer.id, layer.name + ' - Selection Copy'),
                            width: workingCanvas.width,
                            height: workingCanvas.height,
                            transform: new DOMMatrix().translateSelf(selectionOffset.x + selectionBounds.left, selectionOffset.y + selectionBounds.top),
                            data: {
                                sourceUuid,
                            }
                        })
                    );
                } else if (layer.type === 'vector') {
                    if (this.appliedSelectionPaths.length === 0) {
                        this.appliedSelectionPaths = await createAppliedSelectionPaths();
                    }
                    this.insertLayerActions.push(
                        new InsertLayerAction<InsertVectorLayerOptions<ColorModel>>({
                            type: 'vector',
                            name: ensureUniqueLayerSiblingName(layer.id, layer.name + ' - Selection Copy'),
                            width: layer.width,
                            height: layer.height,
                            transform: new DOMMatrix().multiply(layer.transform),
                            data: {
                                sourceUuid: await cloneStoredSvg(layer.data.sourceUuid),
                            }
                        })
                    );
                    this.insertVectorLayerIndices.add(this.insertLayerActions.length - 1);
                }
            }
        }

        const previousSelectedLayerIds = workingFileStore.get('selectedLayerIds');

        if (this.clearSelection && !this.clearSelectionAction) {
            this.clearSelectionAction = new ClearSelectionAction();
        }

        if (this.clearSelectionAction) {
            await this.clearSelectionAction.do();
            this.freeEstimates.memory += this.clearSelectionAction.freeEstimates.memory;
            this.freeEstimates.database += this.clearSelectionAction.freeEstimates.database;
        }

        this.insertedLayerIds = [];
        for (const insertLayerAction of this.insertLayerActions) {
            await insertLayerAction.do();
            this.insertedLayerIds.push(insertLayerAction.insertedLayerId);
            this.freeEstimates.memory += insertLayerAction.freeEstimates.memory;
            this.freeEstimates.database += insertLayerAction.freeEstimates.database;
        }

        if (this.insertVectorLayerIndices.size > 0 && this.deleteSelectionAreaActions.length === 0) {
            for (const index of Array.from(this.insertVectorLayerIndices)) {
                this.deleteSelectionAreaActions.push(new DeleteLayerSelectionAreaAction(
                    [this.insertedLayerIds[index]],
                    {
                        selectionCombineMode: 'intersect',
                        appliedSelectionPaths: this.appliedSelectionPaths,
                    },
                ));
            }
        }
        for (const deleteSelectionAreaAction of this.deleteSelectionAreaActions) {
            await deleteSelectionAreaAction.do();
            this.freeEstimates.memory += deleteSelectionAreaAction.freeEstimates.memory;
            this.freeEstimates.database += deleteSelectionAreaAction.freeEstimates.database;
        }

        if (this.selectNewLayers !== 'none') {
            if (this.selectLayersAction) {
                this.selectLayersAction.free();
                this.selectLayersAction = null;
            }
            if (this.selectNewLayers === 'replace') {
                this.selectLayersAction = new SelectLayersAction(this.insertedLayerIds, previousSelectedLayerIds);
            } else {
                this.selectLayersAction = new SelectLayersAction([ ...workingFileStore.get('selectedLayerIds'), ...this.insertedLayerIds ], previousSelectedLayerIds);
            }
        }

        if (this.selectLayersAction) {
            await this.selectLayersAction.do();
            this.freeEstimates.memory += this.selectLayersAction.freeEstimates.memory;
            this.freeEstimates.database += this.selectLayersAction.freeEstimates.database;
        }

        canvasStore.set('dirty', true);
        canvasStore.set('viewDirty', true);

        // Update the working file backup
        updateWorkingFile({ layers: workingFileStore.get('layers') });
        for (const layerId of this.insertedLayerIds) {
            const layer = getLayerById(layerId);
            if (layer) updateWorkingFileLayer(layer);
        }
    }

    public async undo() {
        super.undo();

        this.freeEstimates.memory = 0;
        this.freeEstimates.database = 0;

        for (const deleteSelectionAreaAction of this.deleteSelectionAreaActions.slice().reverse()) {
            await deleteSelectionAreaAction.undo();
            this.freeEstimates.memory += deleteSelectionAreaAction.freeEstimates.memory;
            this.freeEstimates.database += deleteSelectionAreaAction.freeEstimates.database;
        }

        for (const insertLayerAction of this.insertLayerActions.slice().reverse()) {
            await insertLayerAction.undo();
            this.freeEstimates.memory += insertLayerAction.freeEstimates.memory;
            this.freeEstimates.database += insertLayerAction.freeEstimates.database;
        }

        if (this.clearSelectionAction) {
            await this.clearSelectionAction.undo();
            this.freeEstimates.memory += this.clearSelectionAction.freeEstimates.memory;
            this.freeEstimates.database += this.clearSelectionAction.freeEstimates.database;
        }

        if (this.selectLayersAction) {
            await this.selectLayersAction.undo();
            this.freeEstimates.memory += this.selectLayersAction.freeEstimates.memory;
            this.freeEstimates.database += this.selectLayersAction.freeEstimates.database;
        }

        canvasStore.set('dirty', true);
        canvasStore.set('viewDirty', true);

        // Update the working file backup
        updateWorkingFile({ layers: workingFileStore.get('layers') });
        for (const layerId of this.insertedLayerIds) {
            deleteWorkingFileLayer(layerId);
        }
        this.insertedLayerIds = [];
    }

    public async free() {
        super.free();

        for (const insertLayerAction of this.insertLayerActions) {
            insertLayerAction.free();
        }
        if (this.selectLayersAction) {
            this.selectLayersAction.free();
            this.selectLayersAction = null;
        }
        if (this.clearSelectionAction) {
            this.clearSelectionAction.free();
            this.clearSelectionAction = null;
        }
        (this.insertLayerActions as any) = null;
    }
}