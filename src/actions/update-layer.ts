import {
    ColorModel, WorkingFileLayer, WorkingFileAnyLayer,
    WorkingFileGroupLayer, UpdateAnyLayerOptions
} from '@/types';
import { BaseAction } from './base';
import { registerObjectUrlUser, revokeObjectUrlIfLastUser } from './data/memory-management';
import canvasStore from '@/store/canvas';
import workingFileStore, { getLayerById } from '@/store/working-file';

export class UpdateLayerAction<GroupLayerOptions extends UpdateAnyLayerOptions<ColorModel>> extends BaseAction {

    private updateLayerOptions!: GroupLayerOptions;
    private previousProps: Partial<WorkingFileAnyLayer<ColorModel>> = {};

    constructor(updateLayerOptions: GroupLayerOptions) {
        super('updateLayer', 'Update Layer');
        this.updateLayerOptions = updateLayerOptions;
	}
	public async do() {
        super.do();

        const layers = workingFileStore.get('layers');
        const layer = getLayerById(this.updateLayerOptions.id, layers);
        if (!layer) {
            throw new Error('Layer with specified id not found.');
        }
        for (let prop in this.updateLayerOptions) {
            if (prop !== 'id') {
                (this.previousProps as any)[prop] = (layer as any)[prop];
                (layer as any)[prop] = this.updateLayerOptions[prop];
            }
            if (prop === 'data') {
                if (layer.type === 'raster') {
                    if (layer.data.sourceImage && layer.data.sourceImageIsObjectUrl) {
                        registerObjectUrlUser(layer.data.sourceImage?.src, layer.id);
                    }
                }
                else if (layer.type === 'rasterSequence') {
                    for (let frame of layer.data.sequence) {
                        if (frame.image.sourceImage && frame.image.sourceImageIsObjectUrl) {
                            registerObjectUrlUser(frame.image.sourceImage.src, layer.id);
                        }
                    }
                }
            }
        }
        layer.thumbnailImageSrc = null;

        canvasStore.set('dirty', true);
	}

	public async undo() {
        super.undo();

        const layers = workingFileStore.get('layers');
        const layer = getLayerById(this.updateLayerOptions.id, layers);
        for (let prop in this.previousProps) {
            if (prop !== 'id') {
                (layer as any)[prop] = (this.previousProps as any)[prop];
            }
        }
        if (layer) {
            layer.thumbnailImageSrc = null;
        }

        canvasStore.set('dirty', true);
	}

    public free() {
        super.free();

        if (this.previousProps && !this.isDone) {
            const data = (this.previousProps as any).data;
            const layer = getLayerById(this.updateLayerOptions.id);
            if (data && layer) {
                if (layer.type === 'raster') {
                    if (data.sourceImage && data.sourceImageIsObjectUrl) {
                        revokeObjectUrlIfLastUser(data.sourceImage.src, layer.id);
                    }
                }
                else if (layer.type === 'rasterSequence') {
                    for (let frame of data.sequence) {
                        if (frame.image.sourceImage && frame.image.sourceImageIsObjectUrl) {
                            revokeObjectUrlIfLastUser(frame.image.sourceImage.src, layer.id);
                        }
                    }
                }
            }
        }

        (this.updateLayerOptions as any) = null;
        (this.previousProps as any) = null;
    }

}
