import { v4 as uuidv4 } from 'uuid';
import { markRaw } from 'vue';
import { BaseAction } from './base';

import { createEmptyCanvasWith2dContext } from '@/lib/image';
import { drawImageToCanvas2d } from '@/lib/canvas';

import canvasStore from '@/store/canvas';
import { prepareStoredImageForEditing, prepareStoredImageForArchival, reserveStoredImage, unreserveStoredImage } from '@/store/image';
import { reserveStoredSvg, unreserveStoredSvg } from '@/store/svg';
import { reserveStoredVideo, unreserveStoredVideo } from '@/store/video';
import workingFileStore, { getLayerById, regenerateLayerThumbnail, getCanvasRenderingContext2DSettings } from '@/store/working-file';
import { updateWorkingFileLayer } from '@/store/data/working-file-database';

import { updateBakedImageForLayer } from './baking';
import layerRenderers from '@/canvas/renderers';
import { queueRefreshLayerPasses } from '@/canvas/renderers/webgl/postprocessing/create-layer-passes';

import type {
    ColorModel, WorkingFileAnyLayer,
    UpdateAnyLayerOptions, UpdateGradientLayerOptions, UpdateRasterLayerOptions, UpdateVectorLayerOptions,
    UpdateVideoLayerOptions, WorkingFileRasterLayer, WorkingFileLayerDraftChunk, WorkingFileVectorLayer
} from '@/types';

export class UpdateLayerAction<LayerOptions extends UpdateAnyLayerOptions<ColorModel>> extends BaseAction {

    private updateLayerOptions!: LayerOptions;
    private updateLayerType!: string;
    private previousProps: Partial<WorkingFileAnyLayer<ColorModel>> = {};
    private explicitPreviousProps: Partial<WorkingFileAnyLayer<ColorModel>> = {};

    private oldRasterSourceImageId: string | null = null;
    private oldRasterUpdateChunks: WorkingFileLayerDraftChunk[] = [];
    private newRasterUpdateChunks: WorkingFileLayerDraftChunk[] = [];

    private oldVectorSourceSvgId: string | null = null;
    private oldVideoSourceUuid: string | null = null;

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

        const renderer = canvasStore.get('renderer');

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
                    if (newData?.updateChunks) {
                        const sourceCanvas = await prepareStoredImageForEditing(layer.data.sourceUuid);
                        if (!sourceCanvas) break updateSourceImageWithChunks;
                        const sourceCtx = sourceCanvas.getContext('2d', getCanvasRenderingContext2DSettings());
                        if (!sourceCtx) break updateSourceImageWithChunks;
                        this.newRasterUpdateChunks = newData.updateChunks;

                        // Generate undo history raster chunks if don't exist
                        if (this.oldRasterUpdateChunks.length != this.newRasterUpdateChunks.length) {
                            this.oldRasterUpdateChunks = markRaw([]);
                            for (const updateChunk of this.newRasterUpdateChunks) {
                                const { canvas: oldChunkCanvas, ctx: oldChunkCtx } = createEmptyCanvasWith2dContext(updateChunk.data.width, updateChunk.data.height);
                                if (!oldChunkCtx) break;
                                // Need to wait before accessing sourceCanvas image data (ctx.drawImage) in order to prevent rendering bug in Firefox.
                                await new Promise<void>((resolve, reject) => {
                                    setTimeout(() => {
                                        try {
                                            oldChunkCtx.globalCompositeOperation = 'source-over';
                                            oldChunkCtx.imageSmoothingEnabled = false;
                                            oldChunkCtx.drawImage(sourceCanvas, updateChunk.x, updateChunk.y, updateChunk.data.width, updateChunk.data.height, 0, 0, updateChunk.data.width, updateChunk.data.height);
                                            resolve();
                                        } catch (error) {
                                            reject();
                                        }
                                    }, 0);
                                });
                                this.oldRasterUpdateChunks.push({ data: oldChunkCanvas, x: updateChunk.x, y: updateChunk.y });
                                if (updateChunk.mode === 'replace') {
                                    sourceCtx.globalCompositeOperation = 'source-over';
                                    sourceCtx.imageSmoothingEnabled = false;
                                    sourceCtx.clearRect(updateChunk.x, updateChunk.y, updateChunk.data.width, updateChunk.data.height);
                                    sourceCtx.drawImage(updateChunk.data, 0, 0, updateChunk.data.width, updateChunk.data.height, updateChunk.x, updateChunk.y, updateChunk.data.width, updateChunk.data.height);
                                } else {
                                    await drawImageToCanvas2d(sourceCanvas, updateChunk.data, updateChunk.x, updateChunk.y);
                                }
                            }
                        }
                        // Undo history already generated; just draw the new update chunks.
                        else {
                            for (const updateChunk of this.newRasterUpdateChunks) {
                                if (updateChunk.mode === 'replace') {
                                    sourceCtx.globalCompositeOperation = 'source-over';
                                    sourceCtx.imageSmoothingEnabled = false;
                                    sourceCtx.clearRect(updateChunk.x, updateChunk.y, updateChunk.data.width, updateChunk.data.height);
                                    sourceCtx.drawImage(updateChunk.data, 0, 0, updateChunk.data.width, updateChunk.data.height, updateChunk.x, updateChunk.y, updateChunk.data.width, updateChunk.data.height);
                                } else {
                                    await drawImageToCanvas2d(sourceCanvas, updateChunk.data, updateChunk.x, updateChunk.y);
                                }
                            }
                        }
                        prepareStoredImageForArchival(layer.data.sourceUuid);
                        layer.data.chunkUpdateId = uuidv4();
                        layer.data.updateChunks = newData.updateChunks;
                    } else {
                        delete layer.data.updateChunks;
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
                    if (layer.renderer) {
                        layer.renderer.detach();
                    }
                    layer.renderer = markRaw(new layerRenderers[renderer][this.updateLayerOptions['type'] as string]());
                    queueRefreshLayerPasses();
                    if (layer.renderer) {
                        layer.renderer.attach(layer);
                    }
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
        await layer.renderer.nextUpdate();
        regenerateLayerThumbnail(layer);
        if (requiresBaking) {
            updateBakedImageForLayer(layer);
        }

        canvasStore.set('dirty', true);

        // Update the working file backup
        updateWorkingFileLayer(layer);
	}

	public async undo() {
        super.undo();

        const layers = workingFileStore.get('layers');
        const layer = getLayerById(this.updateLayerOptions.id, layers);
        const renderer = canvasStore.get('renderer');
        if (layer) {
            for (let prop in this.previousProps) {
                if (prop !== 'id') {
                    (layer as any)[prop] = (this.previousProps as any)[prop];

                    if (prop === 'type') {
                        if (layer.renderer) {
                            layer.renderer.detach();
                        }
                        layer.renderer = markRaw(new layerRenderers[renderer][(layer as any)[prop] as string]());
                        queueRefreshLayerPasses();
                        if (layer.renderer) {
                            layer.renderer.attach(layer);
                        }
                    }
                }
            }
            if (layer.type === 'raster') {
                if (this.oldRasterSourceImageId != null && this.oldRasterSourceImageId !== layer.data.sourceUuid) {
                    layer.data.sourceUuid = this.oldRasterSourceImageId;
                }
                updateSourceImageWithChunks:
                if (this.oldRasterUpdateChunks.length > 0) {
                    const sourceCanvas = await prepareStoredImageForEditing(layer.data.sourceUuid);
                    if (!sourceCanvas) break updateSourceImageWithChunks;
                    const sourceCtx = sourceCanvas.getContext('2d', getCanvasRenderingContext2DSettings());
                    if (!sourceCtx) break updateSourceImageWithChunks;
                    for (const updateChunk of this.oldRasterUpdateChunks) {
                        sourceCtx.setTransform(1, 0, 0, 1, 0, 0);
                        sourceCtx.globalCompositeOperation = 'source-over';
                        sourceCtx.imageSmoothingEnabled = false;
                        sourceCtx.clearRect(updateChunk.x, updateChunk.y, updateChunk.data.width, updateChunk.data.height);
                        sourceCtx.drawImage(updateChunk.data, 0, 0, updateChunk.data.width, updateChunk.data.height, updateChunk.x, updateChunk.y, updateChunk.data.width, updateChunk.data.height);
                    }
                    prepareStoredImageForArchival(layer.data.sourceUuid);
                    layer.data.updateChunks = [...this.oldRasterUpdateChunks];
                    layer.data.chunkUpdateId = uuidv4();
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

        (this.updateLayerOptions as any) = null;
        (this.previousProps as any) = null;
        this.newRasterUpdateChunks = [];
        this.oldRasterUpdateChunks = [];
    }

}
