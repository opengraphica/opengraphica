import {
    RGBAColor, WorkingFileLayer,
    WorkingFileGroupLayer, WorkingFileRasterLayer, WorkingFileVectorLayer, WorkingFileTextLayer, WorkingFileAnyLayer,
    InsertGroupLayerOptions, InsertRasterLayerOptions, InsertVectorLayerOptions, InsertTextLayerOptions
} from '@/types';
import { BaseAction } from './base';
import canvasStore from '@/store/canvas';
import workingFileStore, { WorkingFileState } from '@/store/working-file';
import layerRenderers from '@/canvas/renderers';

let layerInsertCounter: number = 1;

export class InsertLayerAction<GroupLayerOptions extends InsertGroupLayerOptions<RGBAColor> | InsertRasterLayerOptions<RGBAColor> | InsertVectorLayerOptions<RGBAColor> | InsertTextLayerOptions<RGBAColor>> extends BaseAction {

    private insertLayerOptions: GroupLayerOptions | null = null;
    private insertedLayer: WorkingFileAnyLayer<RGBAColor> | null = null;

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
                blendingMode: 'source-over',
                filters: [],
                id: layerId,
                groupId: null,
                height: 1,
                width: 1,
                name: 'New Layer #' + (layerInsertCounter++),
                opacity: 1,
                transform: new DOMMatrix(),
                visible: true,
                x: 0,
                y: 0,
                renderer: layerRenderers.base
            }

            switch (this.insertLayerOptions.type) {
                case 'group':
                    newLayer = {
                        ...sharedOptions,
                        layers: [],
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
            parent = this.findGroupLayer(newLayer.groupId, parent);
        }
        if (parent) {
            parent.push(newLayer);
        } else {
            throw new Error('Parent group not found.');
        }
        workingFileStore.set('layers', layers);
        canvasStore.set('dirty', true);
	}

	public async undo() {
        super.undo();

        const layers = workingFileStore.get('layers');
        let parent: WorkingFileLayer<RGBAColor>[] | null = layers;
        if (this.insertedLayer != null && this.insertedLayer.groupId != null) {
            parent = this.findGroupLayer(this.insertedLayer.groupId, parent);
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
        if (this.insertedLayer && !this.isDone) {
            if (this.insertedLayer.type === 'raster') {
                if (this.insertedLayer.data.sourceImage && this.insertedLayer.data.sourceImageIsObjectUrl) {
                    URL.revokeObjectURL(this.insertedLayer.data.sourceImage.src);
                }
            }
        }
        this.insertedLayer = null;
        this.insertLayerOptions = null;
    }

    private findGroupLayer(id: number, parent: WorkingFileLayer<RGBAColor>[]): WorkingFileLayer<RGBAColor>[] | null {
        for (let layer of parent) {
            if (layer.type === 'group') {
                if (layer.id === id) {
                    return (layer as WorkingFileGroupLayer<RGBAColor>).layers;
                } else {
                    let foundGroupLayer = this.findGroupLayer(id, (layer as WorkingFileGroupLayer<RGBAColor>).layers);
                    if (foundGroupLayer) {
                        return foundGroupLayer;
                    }
                }
            }
        }
        return null;
    }

}