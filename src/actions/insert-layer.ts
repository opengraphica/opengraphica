import {
    RGBAColor, WorkingFileLayer,
    WorkingFileGroupLayer, WorkingFileRasterLayer, WorkingFileRasterSequenceLayer, WorkingFileVectorLayer, WorkingFileTextLayer, WorkingFileAnyLayer,
    InsertAnyLayerOptions
} from '@/types';
import { BaseAction } from './base';
import { SelectLayersAction } from './select-layers';
import { registerObjectUrlUser, revokeObjectUrlIfLastUser } from './data/memory-management';
import canvasStore from '@/store/canvas';
import workingFileStore, { getGroupLayerById } from '@/store/working-file';
import layerRenderers from '@/canvas/renderers';

let layerInsertCounter: number = 1;

export class InsertLayerAction<GroupLayerOptions extends InsertAnyLayerOptions<RGBAColor>> extends BaseAction {

    private insertLayerOptions: GroupLayerOptions | null = null;
    private insertedLayer: WorkingFileAnyLayer<RGBAColor> | null = null;
    private selectLayersAction: SelectLayersAction | null = null;

    constructor(insertLayerOptions: GroupLayerOptions) {
        super('insertLayer', 'Insert Layer');
        this.insertLayerOptions = insertLayerOptions;
	}
	public async do() {
        super.do();

        const layerId = workingFileStore.get('layerIdCounter');
        workingFileStore.set('layerIdCounter', layerId + 1);

        let newLayer: WorkingFileAnyLayer<RGBAColor>;
        if (this.insertedLayer) {
            newLayer = this.insertedLayer;
        } else if (this.insertLayerOptions) {
            const sharedOptions: WorkingFileLayer<RGBAColor> = {
                type: 'raster',
                bakedImage: null,
                blendingMode: 'source-over',
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
                renderer: layerRenderers.base
            }

            switch (this.insertLayerOptions.type) {
                case 'group':
                    newLayer = {
                        ...sharedOptions,
                        layers: [],
                        expanded: false,
                        renderer: layerRenderers.group,
                        ...this.insertLayerOptions
                    } as WorkingFileGroupLayer<RGBAColor>;
                    break;
                case 'raster':
                    newLayer = {
                        ...sharedOptions,
                        data: {},
                        renderer: layerRenderers.raster,
                        ...this.insertLayerOptions
                    } as WorkingFileRasterLayer<RGBAColor>;
                    if (newLayer.data.sourceImageIsObjectUrl) {
                        registerObjectUrlUser(newLayer.data.sourceImage?.src, layerId);
                    }
                    break;
                case 'rasterSequence':
                    newLayer = {
                        ...sharedOptions,
                        data: {},
                        renderer: layerRenderers.rasterSequence,
                        ...this.insertLayerOptions
                    } as WorkingFileRasterSequenceLayer<RGBAColor>;
                    for (let frame of newLayer.data.sequence) {
                        if (frame.image.sourceImageIsObjectUrl) {
                            registerObjectUrlUser(frame.image.sourceImage?.src, layerId);
                        }
                    }
                    break;
                case 'vector':
                    newLayer = {
                        ...sharedOptions,
                        data: [],
                        renderer: layerRenderers.vector,
                        ...this.insertLayerOptions
                    } as WorkingFileVectorLayer<RGBAColor>;
                    break;
                case 'text':
                    newLayer = {
                        ...sharedOptions,
                        data: {},
                        renderer: layerRenderers.text,
                        ...this.insertLayerOptions
                    } as WorkingFileTextLayer<RGBAColor>;
                    break;
            }

            this.insertedLayer = newLayer;
            this.insertLayerOptions = null;
        } else {
            throw new Error('Layer definition for insertion not found.');
        }

        const layers = workingFileStore.get('layers');
        let parent: WorkingFileLayer<RGBAColor>[] | null = layers;
        if (newLayer.groupId != null) {
            const groupLayer = getGroupLayerById(newLayer.groupId, parent);
            if (groupLayer) {
                parent = groupLayer.layers;
            }
        }
        if (parent) {
            parent.push(newLayer);
        } else {
            throw new Error('Parent group not found.');
        }

        // Set the modified layer list
        workingFileStore.set('layers', layers);

        // Select the new layer
        this.selectLayersAction = new SelectLayersAction([newLayer.id]);
        this.selectLayersAction.do();

        canvasStore.set('dirty', true);
	}

	public async undo() {
        super.undo();

        if (this.selectLayersAction) {
            this.selectLayersAction.undo();
            this.selectLayersAction = null;
        }

        const layers = workingFileStore.get('layers');
        let parent: WorkingFileLayer<RGBAColor>[] | null = layers;
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
        workingFileStore.set('layers', layers);
        workingFileStore.set('layerIdCounter', workingFileStore.get('layerIdCounter') - 1);

        canvasStore.set('dirty', true);
	}

    public free() {
        super.free();
        if (this.selectLayersAction) {
            this.selectLayersAction.free();
            this.selectLayersAction = null;
        }
        if (this.insertedLayer && !this.isDone) {
            if (this.insertedLayer.type === 'raster') {
                if (this.insertedLayer.data.sourceImage && this.insertedLayer.data.sourceImageIsObjectUrl) {
                    revokeObjectUrlIfLastUser(this.insertedLayer.data.sourceImage?.src, this.insertedLayer.id);
                }
            }
            else if (this.insertedLayer.type === 'rasterSequence') {
                for (let frame of this.insertedLayer.data.sequence) {
                    if (frame.image.sourceImage && frame.image.sourceImageIsObjectUrl) {
                        revokeObjectUrlIfLastUser(frame.image.sourceImage?.src, this.insertedLayer.id);
                    }
                }
            }
        }
        this.insertedLayer = null;
        this.insertLayerOptions = null;
    }

}
