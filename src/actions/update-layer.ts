import {
    ColorModel, WorkingFileAnyLayer,
    UpdateAnyLayerOptions, UpdateRasterLayerOptions
} from '@/types';
import { BaseAction } from './base';
import imageStore from './data/image-store';
import { registerObjectUrlUser, revokeObjectUrlIfLastUser } from './data/memory-management';
import { createImageFromBlob } from '@/lib/image';
import canvasStore from '@/store/canvas';
import workingFileStore, { getGroupLayerById, getLayerById, regenerateLayerThumbnail } from '@/store/working-file';
import { updateBakedImageForLayer } from './baking';

export class UpdateLayerAction<LayerOptions extends UpdateAnyLayerOptions<ColorModel>> extends BaseAction {

    private updateLayerOptions!: LayerOptions;
    private previousProps: Partial<WorkingFileAnyLayer<ColorModel>> = {};
    private explicitPreviousProps: Partial<WorkingFileAnyLayer<ColorModel>> = {};

    private newRasterSourceImageDatabaseId: string | null = null;
    private oldRasterSourceImageDatabaseId: string | null = null;

    constructor(updateLayerOptions: LayerOptions, explicitPreviousProps: Partial<WorkingFileAnyLayer<ColorModel>> = {}) {
        super('updateLayer', 'action.updateLayer');
        this.updateLayerOptions = updateLayerOptions;
        this.explicitPreviousProps = explicitPreviousProps;
	}

	public async do() {
        super.do();

        const layers = workingFileStore.get('layers');
        const layer = getLayerById(this.updateLayerOptions.id, layers);
        if (!layer) {
            throw new Error('Aborted - Layer with specified id not found.');
        }
        for (let prop in this.updateLayerOptions) {
            if (prop === 'data') {
                if (layer.type === 'raster') {
                    const newData = this.updateLayerOptions[prop] as UpdateRasterLayerOptions<ColorModel>['data'];
                    if (this.newRasterSourceImageDatabaseId != null) {
                        layer.data.sourceImage = await createImageFromBlob(
                            await imageStore.get(this.newRasterSourceImageDatabaseId) as Blob
                        );
                        layer.data.sourceImageIsObjectUrl = true;
                    } else if (newData?.sourceImage) {
                        if (layer.data.sourceImage) {
                            try {
                                this.oldRasterSourceImageDatabaseId = await imageStore.add(
                                    await fetch(layer.data.sourceImage.src).then(result => result.blob())
                                );
                                this.newRasterSourceImageDatabaseId = await imageStore.add(
                                    await fetch(newData.sourceImage.src).then(result => result.blob())
                                );
                                if (layer.data.sourceImageIsObjectUrl) {
                                    revokeObjectUrlIfLastUser(layer.data.sourceImage.src, layer.id);
                                }
                            } catch (error) {
                                throw new Error('Aborted - Error storing old image.');
                            }
                        }
                        layer.data.sourceImage = newData.sourceImage;
                        layer.data.sourceImageIsObjectUrl = newData.sourceImageIsObjectUrl;
                        registerObjectUrlUser(layer.data.sourceImage.src, layer.id);
                    }
                }
                // else if (layer.type === 'rasterSequence') {
                //     for (let frame of layer.data.sequence) {
                //         if (frame.image.sourceImage && frame.image.sourceImageIsObjectUrl) {
                //             registerObjectUrlUser(frame.image.sourceImage.src, layer.id);
                //         }
                //     }
                // }
            } else if (prop !== 'id') {
                if ((this.explicitPreviousProps as any)[prop] !== undefined) {
                    (this.previousProps as any)[prop] = (this.explicitPreviousProps as any)[prop];
                } else {
                    (this.previousProps as any)[prop] = (layer as any)[prop];
                }
                (layer as any)[prop] = this.updateLayerOptions[prop];
            }
        }
        regenerateLayerThumbnail(layer);
        updateBakedImageForLayer(layer);

        canvasStore.set('dirty', true);
	}

	public async undo() {
        super.undo();

        const layers = workingFileStore.get('layers');
        const layer = getLayerById(this.updateLayerOptions.id, layers);
        if (layer) {
            for (let prop in this.previousProps) {
                if (prop !== 'id') {
                    (layer as any)[prop] = (this.previousProps as any)[prop];
                }
            }
            regenerateLayerThumbnail(layer);
            updateBakedImageForLayer(layer);
            if (layer.type === 'raster') {
                if (this.oldRasterSourceImageDatabaseId != null) {
                    const oldImageIsObjectUrl = layer.data.sourceImageIsObjectUrl;
                    const oldImageSrc = layer.data.sourceImage?.src;
                    layer.data.sourceImage = await createImageFromBlob(
                        await imageStore.get(this.oldRasterSourceImageDatabaseId) as Blob
                    );
                    layer.data.sourceImageIsObjectUrl = true;
                    registerObjectUrlUser(layer.data.sourceImage.src, layer.id);
                    if (oldImageIsObjectUrl) {
                        revokeObjectUrlIfLastUser(oldImageSrc, layer.id);
                    }
                }
            }
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

        if (this.newRasterSourceImageDatabaseId != null) {
            imageStore.delete(this.newRasterSourceImageDatabaseId);
            this.newRasterSourceImageDatabaseId = null;
        }
        if (this.oldRasterSourceImageDatabaseId != null) {
            imageStore.delete(this.oldRasterSourceImageDatabaseId);
            this.oldRasterSourceImageDatabaseId = null;
        }

        (this.updateLayerOptions as any) = null;
        (this.previousProps as any) = null;
    }

}
