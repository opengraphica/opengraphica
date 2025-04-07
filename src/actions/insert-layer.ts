import { reactive, markRaw } from 'vue';

import { BaseAction } from './base';
import { updateBakedImageForLayer } from './baking';
import { SelectLayersAction } from './select-layers';

import canvasStore from '@/store/canvas';
import { reserveStoredImage, unreserveStoredImage } from '@/store/image';
import { reserveStoredSvg, unreserveStoredSvg } from '@/store/svg';
import { reserveStoredVideo, unreserveStoredVideo } from '@/store/video';
import workingFileStore, { calculateLayerOrder, getGroupLayerById } from '@/store/working-file';
import { updateWorkingFile, updateWorkingFileLayer, deleteWorkingFileLayer } from '@/store/data/working-file-database';

import appEmitter from '@/lib/emitter';

import type {
    ColorModel, WorkingFileLayer,
    WorkingFileEmptyLayer, WorkingFileGradientLayer, WorkingFileGroupLayer, WorkingFileRasterLayer,
    WorkingFileRasterSequenceLayer, WorkingFileVectorLayer, WorkingFileVideoLayer, WorkingFileTextLayer,
    WorkingFileAnyLayer, InsertAnyLayerOptions
} from '@/types';

let layerInsertCounter: number = 1;

type InsertPosition = 'top' | 'bottom' | 'above' | 'below'; // top, above = in front of other layers visibly.

export class InsertLayerAction<LayerOptions extends InsertAnyLayerOptions<ColorModel>> extends BaseAction {

    public insertedLayerId: number = -1;

    private insertLayerOptions: LayerOptions | null = null;
    private insertPosition: InsertPosition = 'top';
    private insertAroundLayerId: number = 0;
    private insertedLayer: WorkingFileAnyLayer<ColorModel> | null = null;
    private selectLayersAction: SelectLayersAction | null = null;

    constructor(insertLayerOptions: LayerOptions, insertPosition: InsertPosition = 'top', insertAroundLayerId?: number) {
        super('insertLayer', 'action.insertLayer');
        this.insertLayerOptions = insertLayerOptions;
        this.insertPosition = insertPosition;
        if (insertAroundLayerId != null) {
            this.insertAroundLayerId = insertAroundLayerId;
        }
	}
	public async do() {
        super.do();

        let layerId = -1;
        if (this.insertLayerOptions?.id != null) { // Only file open code should provide an explicit ID.
            layerId = this.insertLayerOptions.id;
        } else {
            layerId = workingFileStore.get('layerIdCounter');
            workingFileStore.set('layerIdCounter', layerId + 1);
        }

        this.insertedLayerId = layerId;

        // Create new layer object if not already created (do vs redo)
        let newLayer: WorkingFileAnyLayer<ColorModel>;
        if (this.insertedLayer) {
            newLayer = this.insertedLayer;
        } else if (this.insertLayerOptions) {
            const sharedOptions: WorkingFileLayer<ColorModel> = {
                type: 'raster',
                bakedImage: null,
                blendingMode: 'normal',
                drafts: null,
                draftDrawables: null,
                filters: [],
                id: layerId,
                groupId: null,
                height: 1,
                width: 1,
                name: 'New Layer #' + (layerInsertCounter++),
                opacity: 1,
                thumbnailImageSrc: null,
                transform: new DOMMatrix(),
                visible: true,
            }

            switch (this.insertLayerOptions.type) {
                case 'empty':
                    newLayer = {
                        ...sharedOptions,
                        ...this.insertLayerOptions
                    } as WorkingFileEmptyLayer<ColorModel>;
                    break;
                case 'gradient':
                    newLayer = {
                        ...sharedOptions,
                        data: {
                            start: { x: 0, y: 0 },
                            end: { x: 0, y: 0 },
                            focus: { x: 0, y: 0 },
                            stops: [],
                        },
                        ...this.insertLayerOptions,
                    } as WorkingFileGradientLayer<ColorModel>;
                    break;
                case 'group':
                    newLayer = {
                        ...sharedOptions,
                        layers: [],
                        expanded: false,
                        ...this.insertLayerOptions
                    } as WorkingFileGroupLayer<ColorModel>;
                    break;
                case 'raster':
                    newLayer = {
                        ...sharedOptions,
                        data: {},
                        ...this.insertLayerOptions,
                    } as WorkingFileRasterLayer<ColorModel>;
                    if (newLayer.data.sourceUuid) {
                        reserveStoredImage(newLayer.data.sourceUuid, `${layerId}`);
                    }
                    break;
                case 'rasterSequence':
                    newLayer = {
                        ...sharedOptions,
                        data: {},
                        ...this.insertLayerOptions
                    } as WorkingFileRasterSequenceLayer<ColorModel>;
                    for (let frame of newLayer.data.sequence) {
                        if (frame.image.sourceUuid) {
                            reserveStoredImage(frame.image.sourceUuid, `${layerId}`);
                        }
                    }
                    break;
                case 'text':
                    newLayer = {
                        ...sharedOptions,
                        data: {},
                        ...this.insertLayerOptions
                    } as WorkingFileTextLayer<ColorModel>;
                    break;
                case 'vector':
                    newLayer = {
                        ...sharedOptions,
                        data: [],
                        ...this.insertLayerOptions
                    } as WorkingFileVectorLayer<ColorModel>;
                    if (newLayer.data.sourceUuid) {
                        reserveStoredSvg(newLayer.data.sourceUuid, `${layerId}`);
                    }
                    break;
                case 'video':
                    newLayer = {
                        ...sharedOptions,
                        data: [],
                        ...this.insertLayerOptions
                    } as WorkingFileVideoLayer<ColorModel>;
                    if (newLayer.data.sourceUuid) {
                        reserveStoredVideo(newLayer.data.sourceUuid, `${layerId}`);
                    }
                    break;
            }

            for (const filter of newLayer.filters) {
                if (filter.maskId != null) {
                    const masks = workingFileStore.get('masks');
                    const mask = masks[filter.maskId];
                    if (mask) {
                        reserveStoredImage(mask.sourceUuid, `${layerId}`);
                    }
                }
            }

            newLayer = reactive(newLayer);

            this.insertedLayer = newLayer;
            this.insertLayerOptions = null;
        } else {
            throw new Error('Layer definition for insertion not found.');
        }

        // Insert new layer into existing layers array
        const layers = workingFileStore.get('layers');
        let parent: WorkingFileLayer<ColorModel>[] | null = layers;
        if (newLayer.groupId != null) {
            const groupLayer = getGroupLayerById(newLayer.groupId, parent);
            if (groupLayer) {
                parent = groupLayer.layers;
            }
        }
        if (parent) {
            if (['above', 'below'].includes(this.insertPosition)) {
                let insertAroundIndex: number = -1;
                for (let [i, layer] of parent.entries()) {
                    if (layer.id === this.insertAroundLayerId) {
                        insertAroundIndex = i;
                        break;
                    }
                }
                if (insertAroundIndex > -1) {
                    parent.splice(insertAroundIndex + (this.insertPosition === 'above' ? 1 : 0), 0, newLayer);
                } else {
                    throw new Error('Referenced layer to insert around not found.');
                }
            } else if (this.insertPosition === 'top') {
                parent.push(newLayer);
            } else if (this.insertPosition === 'bottom') {
                parent.unshift(newLayer);
            }
        } else {
            throw new Error('Parent group not found.');
        }

        // Attach the renderer (needed for webgl)
        appEmitter.emit('app.workingFile.layerAttached', newLayer);

        // Set the modified layer list
        workingFileStore.set('layers', layers);

        // Select the new layer
        this.selectLayersAction = new SelectLayersAction([newLayer.id]);
        this.selectLayersAction.do();

        calculateLayerOrder();
        updateBakedImageForLayer(newLayer);

        canvasStore.set('dirty', true);

        // Update the working file backup
        updateWorkingFile({
            layerIdCounter: workingFileStore.get('layerIdCounter'),
            layers: workingFileStore.get('layers')
        });
        updateWorkingFileLayer(this.insertedLayer);
	}

	public async undo() {
        super.undo();

        if (this.selectLayersAction) {
            this.selectLayersAction.undo();
            this.selectLayersAction = null;
        }

        const layers = workingFileStore.get('layers');
        let parent: WorkingFileLayer<ColorModel>[] | null = layers;
        if (this.insertedLayer != null && this.insertedLayer.groupId != null) {
            const groupLayer = getGroupLayerById(this.insertedLayer.groupId, parent);
            if (groupLayer) {
                parent = groupLayer.layers;
            }
        }
        if (this.insertedLayer && parent) {
            let childIndex = parent.findIndex((layer) => layer.id === (this.insertedLayer as any).id);
            parent.splice(childIndex, 1);
        }

        // Detach the renderer (needed for webgl)
        if (this.insertedLayer) {
            appEmitter.emit('app.workingFile.layerDetached', this.insertedLayer);
            this.insertedLayer.bakedImage = null;
        }

        // Set modified layer list
        workingFileStore.set('layers', layers);
        workingFileStore.set('layerIdCounter', workingFileStore.get('layerIdCounter') - 1);

        let oldInsertedLayerId = this.insertedLayerId;
        this.insertedLayerId = -1;

        calculateLayerOrder();
        canvasStore.set('dirty', true);

        // Update the working file backup
        updateWorkingFile({
            layerIdCounter: workingFileStore.get('layerIdCounter'),
            layers: workingFileStore.get('layers')
        });
        deleteWorkingFileLayer(oldInsertedLayerId);
	}

    public free() {
        super.free();
        if (this.selectLayersAction) {
            this.selectLayersAction.free();
            this.selectLayersAction = null;
        }
        if (this.insertedLayer && !this.isDone) {
            if (this.insertedLayer.type === 'raster') {
                if (this.insertedLayer.data.sourceUuid) {
                    unreserveStoredImage(this.insertedLayer.data.sourceUuid, `${this.insertedLayer.id}`);
                }
            }
            else if (this.insertedLayer.type === 'rasterSequence') {
                for (let frame of this.insertedLayer.data.sequence) {
                    if (frame.image.sourceUuid) {
                        unreserveStoredImage(frame.image.sourceUuid, `${this.insertedLayer.id}`);
                    }
                }
            }
            else if (this.insertedLayer.type === 'vector') {
                if (this.insertedLayer.data.sourceUuid) {
                    unreserveStoredSvg(this.insertedLayer.data.sourceUuid, `${this.insertedLayer.id}`);
                }
            }
            else if (this.insertedLayer.type === 'video') {
                if (this.insertedLayer.data.sourceUuid) {
                    unreserveStoredVideo(this.insertedLayer.data.sourceUuid, `${this.insertedLayer.id}`);
                }
            }
            for (const filter of this.insertedLayer.filters) {
                if (filter.maskId != null) {
                    const masks = workingFileStore.get('masks');
                    const mask = masks[filter.maskId];
                    if (mask) {
                        unreserveStoredImage(mask.sourceUuid, `${this.insertedLayer.id}`);
                    }
                }
            }
        }
        this.insertedLayer = null;
        this.insertLayerOptions = null;
    }

}
