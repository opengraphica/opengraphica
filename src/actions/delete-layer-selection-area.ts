import { BaseAction } from './base';
import { activeSelectionMask, activeSelectionMaskCanvasOffset, appliedSelectionMask, appliedSelectionMaskCanvasOffset, selectionMaskDrawMargin } from '@/canvas/store/selection-state';
import canvasStore from '@/store/canvas';
import workingFileStore, { getSelectedLayers, ensureUniqueLayerSiblingName, getLayerById } from '@/store/working-file';
import { createImageFromCanvas, getImageDataFromImage, getImageDataEmptyBounds } from '@/lib/image';
import { ClearSelectionAction } from './clear-selection';
import { InsertLayerAction } from './insert-layer';
import { SelectLayersAction } from './select-layers';
import renderers from '@/canvas/renderers';
import { WorkingFileLayer, ColorModel, WorkingFileRasterLayer, WorkingFileRasterSequenceLayer, InsertRasterLayerOptions } from '@/types';

interface DeleteLayerSelectionAreaOptions {
    clearSelection?: boolean;
}

export class DeleteLayerSelectionAreaAction extends BaseAction {

    private layerIds: number[];
    private clearSelection: boolean = false;

    private clearSelectionAction: ClearSelectionAction | null = null;

    constructor(layerIds: number[] = workingFileStore.state.selectedLayerIds, options?: DeleteLayerSelectionAreaOptions) {
        super('deleteLayerSelectionArea', 'action.deleteLayerSelectionArea');
        this.layerIds = layerIds;
        if (options?.clearSelection) {
            this.clearSelection = options.clearSelection;
        }
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

        // Get selection mask info
        const selectionMask: HTMLImageElement | null = activeSelectionMask.value || appliedSelectionMask.value;
        if (!selectionMask) {
            throw new Error('Aborted - No selection mask exists.');
        }
        const selectionOffset: DOMPoint = (selectionMask === activeSelectionMask.value ? activeSelectionMaskCanvasOffset.value : appliedSelectionMaskCanvasOffset.value);
        const selectionBounds = getImageDataEmptyBounds(getImageDataFromImage(selectionMask));

        // Edit image data for each layer
        const workingCanvas = document.createElement('canvas');
        for (const layer of layersToModify) {
            if (layer.type === 'raster') {
                
            }
        }

        
        workingCanvas.width = selectionBounds.right - selectionBounds.left;
        workingCanvas.height = selectionBounds.bottom - selectionBounds.top;
        const ctx = workingCanvas.getContext('2d');
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
                    
                    this.insertLayerActions.push(
                        new InsertLayerAction<InsertRasterLayerOptions<ColorModel>>({
                            type: 'raster',
                            name: ensureUniqueLayerSiblingName(layer.id, layer.name + ' - Selection Copy'),
                            width: workingCanvas.width,
                            height: workingCanvas.height,
                            transform: new DOMMatrix().translateSelf(selectionOffset.x + selectionBounds.left, selectionOffset.y + selectionBounds.top),
                            data: {
                                sourceImage: await createImageFromCanvas(workingCanvas),
                                sourceImageIsObjectUrl: true
                            }
                        })
                    );
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

        let insertedLayerIds = [];
        for (const insertLayerAction of this.insertLayerActions) {
            await insertLayerAction.do();
            insertedLayerIds.push(insertLayerAction.insertedLayerId);
            this.freeEstimates.memory += insertLayerAction.freeEstimates.memory;
            this.freeEstimates.database += insertLayerAction.freeEstimates.database;
        }

        if (this.selectNewLayers !== 'none') {
            if (this.selectLayersAction) {
                this.selectLayersAction.free();
                this.selectLayersAction = null;
            }
            if (this.selectNewLayers === 'replace') {
                this.selectLayersAction = new SelectLayersAction(insertedLayerIds, previousSelectedLayerIds);
            } else {
                this.selectLayersAction = new SelectLayersAction([ ...workingFileStore.get('selectedLayerIds'), ...insertedLayerIds ], previousSelectedLayerIds);
            }
        }

        if (this.selectLayersAction) {
            await this.selectLayersAction.do();
            this.freeEstimates.memory += this.selectLayersAction.freeEstimates.memory;
            this.freeEstimates.database += this.selectLayersAction.freeEstimates.database;
        }

        canvasStore.set('dirty', true);
        canvasStore.set('viewDirty', true);
    }

    public async undo() {
        super.undo();

        // this.freeEstimates.memory = 0;
        // this.freeEstimates.database = 0;

        // for (const insertLayerAction of this.insertLayerActions.slice().reverse()) {
        //     await insertLayerAction.undo();
        //     this.freeEstimates.memory += insertLayerAction.freeEstimates.memory;
        //     this.freeEstimates.database += insertLayerAction.freeEstimates.database;
        // }

        // if (this.clearSelectionAction) {
        //     await this.clearSelectionAction.undo();
        //     this.freeEstimates.memory += this.clearSelectionAction.freeEstimates.memory;
        //     this.freeEstimates.database += this.clearSelectionAction.freeEstimates.database;
        // }

        // if (this.selectLayersAction) {
        //     await this.selectLayersAction.undo();
        //     this.freeEstimates.memory += this.selectLayersAction.freeEstimates.memory;
        //     this.freeEstimates.database += this.selectLayersAction.freeEstimates.database;
        // }

        canvasStore.set('dirty', true);
        canvasStore.set('viewDirty', true);
    }

    public async free() {
        super.free();

        // for (const insertLayerAction of this.insertLayerActions) {
        //     insertLayerAction.free();
        // }
        // if (this.selectLayersAction) {
        //     this.selectLayersAction.free();
        //     this.selectLayersAction = null;
        // }
        // if (this.clearSelectionAction) {
        //     this.clearSelectionAction.free();
        //     this.clearSelectionAction = null;
        // }
        // (this.insertLayerActions as any) = null;
    }
}