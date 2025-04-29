import { v4 as uuidv4 } from 'uuid';
import { markRaw } from 'vue';
import { BaseAction } from './base';
import { updateBakedImageForLayer } from './baking';

import { createEmptyCanvas } from '@/lib/image';
import { drawImageToCanvas2d } from '@/lib/canvas';
import appEmitter from '@/lib/emitter';

import canvasStore from '@/store/canvas';
import {
    getStoredImageOrCanvas, createStoredImage, deleteStoredImage,
    prepareStoredImageForEditing, prepareStoredImageForArchival, reserveStoredImage, unreserveStoredImage
} from '@/store/image';
import { reserveStoredSvg, unreserveStoredSvg } from '@/store/svg';
import { reserveStoredVideo, unreserveStoredVideo } from '@/store/video';
import workingFileStore, { getLayerById, regenerateLayerThumbnail, getCanvasRenderingContext2DSettings } from '@/store/working-file';
import { updateWorkingFileLayer } from '@/store/data/working-file-database';

import type {
    ColorModel, WorkingFileAnyLayer,
    UpdateAnyLayerOptions, UpdateGradientLayerOptions, UpdateRasterLayerOptions, UpdateVectorLayerOptions,
    UpdateVideoLayerOptions, WorkingFileRasterLayer, WorkingFileLayerRasterTileUpdate, WorkingFileVectorLayer
} from '@/types';

export class UpdateLayerAction<LayerOptions extends UpdateAnyLayerOptions<ColorModel>> extends BaseAction {

    private updateLayerOptions!: LayerOptions;
    private updateLayerType!: string;
    private previousProps: Partial<WorkingFileAnyLayer<ColorModel>> = {};
    private explicitPreviousProps: Partial<WorkingFileAnyLayer<ColorModel>> = {};

    private oldRasterSourceImageId: string | null = null;
    private oldRasterTileUpdates: WorkingFileLayerRasterTileUpdate[] = [];
    private newRasterTileUpdates: WorkingFileLayerRasterTileUpdate[] = [];

    private oldVectorSourceSvgId: string | null = null;
    private oldVideoSourceUuid: string | null = null;

    private isFirstRun = true;

    constructor(updateLayerOptions: LayerOptions, explicitPreviousProps: Partial<LayerOptions> = {}) {
        super('updateLayer', 'action.updateLayer');
        this.updateLayerOptions = updateLayerOptions;
        this.explicitPreviousProps = explicitPreviousProps as never;
	}

	public async do() {
        super.do();

        let requiresBaking: boolean = false;

        const layers = workingFileStore.get('layers');
        const layer = getLayerById(this.updateLayerOptions.id, layers);
        if (!layer) {
            throw new Error('Aborted - Layer with specified id not found.');
        }
        this.updateLayerType = layer.type;
        let hasChangedLayerType = false;

        const layerUpdateProps = Object.keys(this.updateLayerOptions).sort((aKey, bKey) => {
            if (aKey === 'type' && bKey !== 'type') return -1;
            if (aKey !== 'type' && bKey === 'type') return 1;
            if (aKey === 'draft' && bKey !== 'draft') return 1;
            if (aKey !== 'draft' && bKey === 'draft') return -1;
            return 0;
        }) as Array<keyof LayerOptions>;
        for (let prop of layerUpdateProps) {
            if (prop === 'data') {
                if (layer.type === 'raster') {
                    if (!layer.data) {
                        layer.data = { sourceUuid: '' };
                    }
                    const newData = this.updateLayerOptions[prop] as UpdateRasterLayerOptions<ColorModel>['data'];
                    const newSourceUuid = newData?.sourceUuid ?? '';
                    const oldSourceUuid = layer.data.sourceUuid ?? '';
                    if (newSourceUuid && newSourceUuid !== oldSourceUuid) {
                        layer.data.sourceUuid = newSourceUuid;
                        this.oldRasterSourceImageId = oldSourceUuid;
                        reserveStoredImage(newSourceUuid, `${layer.id}`);
                        requiresBaking = true;
                    }

                    updateSourceImageWithChunks:
                    if (newData?.tileUpdates) {
                        const sourceCanvas = await prepareStoredImageForEditing(layer.data.sourceUuid);
                        if (!sourceCanvas) break updateSourceImageWithChunks;
                        const sourceCtx = sourceCanvas.getContext('2d', getCanvasRenderingContext2DSettings());
                        if (!sourceCtx) break updateSourceImageWithChunks;
                        this.newRasterTileUpdates = newData.tileUpdates;

                        // Generate undo history raster chunks if don't exist
                        if (this.oldRasterTileUpdates.length != this.newRasterTileUpdates.length) {
                            this.oldRasterTileUpdates = markRaw([]);
                            for (const updateChunk of this.newRasterTileUpdates) {
                                if (updateChunk.oldSourceUuid) {
                                    this.oldRasterTileUpdates.push({ sourceUuid: updateChunk.oldSourceUuid, x: updateChunk.x, y: updateChunk.y });
                                } else {
                                    const updateCanvas = getStoredImageOrCanvas(updateChunk.sourceUuid)!;
                                    const oldChunkCanvas = createEmptyCanvas(updateCanvas.width, updateCanvas.height);
                                    const oldChunkCtx = oldChunkCanvas.getContext('bitmaprenderer');
                                    if (!oldChunkCtx) break;
                                    // Need to wait before accessing sourceCanvas image data (ctx.drawImage) in order to prevent rendering bug in Firefox.
                                    await new Promise<void>((resolve, reject) => {
                                        setTimeout(() => {
                                            try {
                                                createImageBitmap(sourceCanvas, updateChunk.x, updateChunk.y, updateCanvas.width, updateCanvas.height).then((bitmap) => {
                                                    oldChunkCtx.transferFromImageBitmap(bitmap);
                                                    resolve();
                                                }).catch(reject);
                                            } catch (error) {
                                                reject();
                                            }
                                        }, 0);
                                    });
                                    const oldChunkCanvasId = await createStoredImage(oldChunkCanvas);
                                    this.oldRasterTileUpdates.push({ sourceUuid: oldChunkCanvasId, x: updateChunk.x, y: updateChunk.y });
                                }
                            }
                        }
                        // Draw the new update chunks.
                        for (const updateChunk of this.newRasterTileUpdates) {
                            const updateCanvas = getStoredImageOrCanvas(updateChunk.sourceUuid)!;
                            if (updateChunk.mode === 'replace') {
                                sourceCtx.globalCompositeOperation = 'source-over';
                                sourceCtx.imageSmoothingEnabled = false;
                                sourceCtx.clearRect(updateChunk.x, updateChunk.y, updateCanvas.width, updateCanvas.height);
                                sourceCtx.drawImage(updateCanvas, 0, 0, updateCanvas.width, updateCanvas.height, updateChunk.x, updateChunk.y, updateCanvas.width, updateCanvas.height);
                            } else {
                                await drawImageToCanvas2d(sourceCanvas, updateCanvas, updateChunk.x, updateChunk.y);
                            }
                        }
                        prepareStoredImageForArchival(layer.data.sourceUuid);
                        if (!(newData.alreadyRendererd && this.isFirstRun)) {
                            layer.data.tileUpdateId = uuidv4();
                        }
                        layer.data.tileUpdates = newData.tileUpdates;
                    } else {
                        delete layer.data.tileUpdates;
                    }

                }
                // else if (layer.type === 'rasterSequence') {
                //     for (let frame of layer.data.sequence) {
                //         if (frame.image.sourceUuid) {
                //             reserveStoredImage(frame.image.sourceUuid, `${layer.id}`);
                //         }
                //     }
                // }
                else if (layer.type === 'vector') {
                    if (!layer.data) {
                        layer.data = { sourceUuid: '' };
                    }
                    const newData = this.updateLayerOptions[prop] as UpdateVectorLayerOptions<ColorModel>['data'];
                    const newSourceUuid = newData?.sourceUuid ?? '';
                    const oldSourceUuid = layer.data.sourceUuid ?? '';
                    if (newSourceUuid && newSourceUuid !== oldSourceUuid) {
                        layer.data.sourceUuid = newSourceUuid;
                        this.oldVectorSourceSvgId = oldSourceUuid;
                        reserveStoredSvg(newSourceUuid, `${layer.id}`);
                        requiresBaking = true;
                    }
                }
                else if (layer.type === 'video') {
                    if (!layer.data) {
                        layer.data = { sourceUuid: '' };
                    }
                    const newData = this.updateLayerOptions[prop] as UpdateVideoLayerOptions<ColorModel>['data'];
                    const newSourceUuid = newData?.sourceUuid ?? '';
                    const oldSourceUuid = layer.data.sourceUuid ?? '';
                    if (newSourceUuid && newSourceUuid !== oldSourceUuid) {
                        layer.data.sourceUuid = newSourceUuid;
                        this.oldVideoSourceUuid = oldSourceUuid;
                        reserveStoredVideo(newSourceUuid, `${layer.id}`);
                        requiresBaking = true;
                    }
                }
                else {
                    if ((this.explicitPreviousProps as any)[prop] !== undefined) {
                        (this.previousProps as any)[prop] = (this.explicitPreviousProps as any)[prop];
                    } else {
                        (this.previousProps as any)[prop] = (layer as any)[prop];
                    }
                    (layer as any).data = this.updateLayerOptions[prop];
                }
            } else if (prop !== 'id') {
                if (prop === 'type') {
                    appEmitter.emit('app.workingFile.layerDetached', layer);
                    hasChangedLayerType = true;
                }

                // Store old values and assign new values
                if ((this.explicitPreviousProps as any)[prop] !== undefined) {
                    (this.previousProps as any)[prop] = (this.explicitPreviousProps as any)[prop];
                } else {
                    (this.previousProps as any)[prop] = (layer as any)[prop];
                }
                (layer as any)[prop] = this.updateLayerOptions[prop];
            }
        }

        if (hasChangedLayerType) {
            appEmitter.emit('app.workingFile.layerAttached', layer);
        }

        appEmitter.emit('app.workingFile.layerUpdated', layer);
        regenerateLayerThumbnail(layer);
        if (requiresBaking) {
            updateBakedImageForLayer(layer);
        }

        canvasStore.set('dirty', true);

        // Update the working file backup
        updateWorkingFileLayer(layer);

        this.isFirstRun = false;
	}

	public async undo() {
        super.undo();

        const layers = workingFileStore.get('layers');
        const layer = getLayerById(this.updateLayerOptions.id, layers);
        if (layer) {
            for (let prop in this.previousProps) {
                if (prop !== 'id') {
                    if (prop === 'type') {
                        appEmitter.emit('app.workingFile.layerDetached', layer);
                    }
                    (layer as any)[prop] = (this.previousProps as any)[prop];
                    if (prop === 'type') {
                        appEmitter.emit('app.workingFile.layerAttached', layer);
                    }
                }
            }
            if (layer.type === 'raster') {
                if (this.oldRasterSourceImageId != null && this.oldRasterSourceImageId !== layer.data.sourceUuid) {
                    layer.data.sourceUuid = this.oldRasterSourceImageId;
                }
                updateSourceImageWithChunks:
                if (this.oldRasterTileUpdates.length > 0) {
                    const sourceCanvas = await prepareStoredImageForEditing(layer.data.sourceUuid);
                    if (!sourceCanvas) break updateSourceImageWithChunks;
                    const sourceCtx = sourceCanvas.getContext('2d', getCanvasRenderingContext2DSettings());
                    if (!sourceCtx) break updateSourceImageWithChunks;
                    for (const updateChunk of this.oldRasterTileUpdates) {
                        const updateCanvas = getStoredImageOrCanvas(updateChunk.sourceUuid)!;
                        sourceCtx.setTransform(1, 0, 0, 1, 0, 0);
                        sourceCtx.globalCompositeOperation = 'source-over';
                        sourceCtx.imageSmoothingEnabled = false;
                        sourceCtx.clearRect(updateChunk.x, updateChunk.y, updateCanvas.width, updateCanvas.height);
                        sourceCtx.drawImage(updateCanvas, 0, 0, updateCanvas.width, updateCanvas.height, updateChunk.x, updateChunk.y, updateCanvas.width, updateCanvas.height);
                    }
                    prepareStoredImageForArchival(layer.data.sourceUuid);
                    layer.data.tileUpdates = [...this.oldRasterTileUpdates];
                    layer.data.tileUpdateId = uuidv4();
                }
            }
            regenerateLayerThumbnail(layer);
            updateBakedImageForLayer(layer);
        }

        canvasStore.set('dirty', true);

        // Update the working file backup
        if (layer) updateWorkingFileLayer(layer);
	}

    public free() {
        super.free();

        // This is in the undo history
        if (this.isDone) {
            // For raster layer, if the image source id was changed, free the old one.
            if (this.oldRasterSourceImageId != null && this.oldRasterSourceImageId !== (this.updateLayerOptions as UpdateRasterLayerOptions<ColorModel>)?.data?.sourceUuid) {
                unreserveStoredImage(this.oldRasterSourceImageId, `${this.previousProps.id}`);
            }

            // For vector layer, if the svg source id was changed, free the old one.
            if (this.oldVectorSourceSvgId != null && this.oldVectorSourceSvgId !== (this.updateLayerOptions as UpdateVectorLayerOptions<ColorModel>)?.data?.sourceUuid) {
                unreserveStoredSvg(this.oldVectorSourceSvgId, `${this.previousProps.id}`);
            }

            // For video layer, if the video source id was changed, free the old one.
            if (this.oldVideoSourceUuid != null && this.oldVideoSourceUuid !== (this.updateLayerOptions as UpdateVideoLayerOptions<ColorModel>)?.data?.sourceUuid) {
                unreserveStoredVideo(this.oldVideoSourceUuid, `${this.previousProps.id}`);
            }
        }
        // This is in the redo history
        if (!this.isDone) {
            const layer = getLayerById(this.updateLayerOptions.id);
            if (layer) {
                // For raster layer, if the image source id was changed, free the new one.
                if (this.updateLayerType === 'raster') {
                    const rasterUpdateLayerOptions = (this.updateLayerOptions as UpdateRasterLayerOptions<ColorModel>);
                    if (
                        rasterUpdateLayerOptions?.data?.sourceUuid &&
                        rasterUpdateLayerOptions?.data?.sourceUuid !== (layer as WorkingFileRasterLayer<ColorModel>)?.data?.sourceUuid
                    ) {
                        unreserveStoredImage(rasterUpdateLayerOptions.data.sourceUuid, `${layer.id}`);
                    }
                }
                // For vector layer, if the svg source id was changed, free the new one.
                if (this.updateLayerType === 'vector') {
                    const vectorUpdateLayerOptions = (this.updateLayerOptions as UpdateVectorLayerOptions<ColorModel>);
                    if (
                        vectorUpdateLayerOptions?.data?.sourceUuid &&
                        vectorUpdateLayerOptions?.data?.sourceUuid !== (layer as WorkingFileVectorLayer<ColorModel>)?.data?.sourceUuid
                    ) {
                        unreserveStoredImage(vectorUpdateLayerOptions.data.sourceUuid, `${layer.id}`);
                    }
                }
            }
        }

        for (const tileUpdate of this.newRasterTileUpdates) {
            deleteStoredImage(tileUpdate.sourceUuid);
        }
        for (const tileUpdate of this.oldRasterTileUpdates) {
            deleteStoredImage(tileUpdate.sourceUuid);
        }

        (this.updateLayerOptions as any) = null;
        (this.previousProps as any) = null;
        this.newRasterTileUpdates = [];
        this.oldRasterTileUpdates = [];
    }

}
