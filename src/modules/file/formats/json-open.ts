
import { InsertLayerAction } from '@/actions/insert-layer';

import { createBlobFromDataUri } from '@/lib/binary';

import { createStoredImage } from '@/store/image';
import { createStoredSvg } from '@/store/svg';
import { createStoredVideo } from '@/store/video';
import { type WorkingFileState } from '@/store/working-file';

import type {
    ColorModel, InsertAnyLayerOptions,
    SerializedFile, SerializedFileLayer, SerializedFileGradientLayer,
    SerializedFileGroupLayer, SerializedFileRasterLayer, SerializedFileRasterSequenceLayer,
    SerializedFileVectorLayer, SerializedFileVectorPathLayer, SerializedFileVideoLayer,
    SerializedFileTextLayer,
    WorkingFileLayer, WorkingFileLayerMask,
    WorkingFileEmptyLayer, WorkingFileGradientLayer, WorkingFileGroupLayer,
    WorkingFileRasterLayer, WorkingFileRasterSequenceLayer, WorkingFileVectorLayer,
    WorkingFileVectorPathLayer, WorkingFileVideoLayer, WorkingFileTextLayer,
} from '@/types';

export async function parseSerializedFileToActions(
    serializedFile: SerializedFile<ColorModel>
): Promise<{ workingFileDefinition: Partial<WorkingFileState>, insertLayerActions: InsertLayerAction<any>[] }> {

    const serializedMasks = serializedFile.masks;
    const masks: Record<number, WorkingFileLayerMask> = {};
    for (const maskId of Object.keys(serializedFile.masks ?? {}).map(key => parseInt(key))) {
        masks[maskId] = {
            sourceUuid: await parseDataUrlToStoredImage(serializedMasks[maskId].sourceImageSerialized),
            hash: serializedMasks[maskId].hash,
            offset: serializedMasks[maskId].offset,
        };
    }

    const workingFileDefinition: Partial<WorkingFileState> = {
        background: serializedFile.background,
        colorModel: serializedFile.colorModel,
        colorSpace: serializedFile.colorSpace,
        drawOriginX: serializedFile.drawOriginX,
        drawOriginY: serializedFile.drawOriginY,
        height: serializedFile.height,
        layerIdCounter: serializedFile.layerIdCounter,
        masks,
        measuringUnits: serializedFile.measuringUnits,
        resolutionUnits: serializedFile.resolutionUnits,
        resolutionX: serializedFile.resolutionX,
        resolutionY: serializedFile.resolutionY,
        scaleFactor: serializedFile.scaleFactor,
        selectedLayerIds: serializedFile.selectedLayerIds,
        width: serializedFile.width,
    };
    const insertLayerActions: InsertLayerAction<any>[] = await parseLayersToActions(serializedFile.layers);
    return {
        workingFileDefinition,
        insertLayerActions
    };
}

async function parseLayersToActions(layers: SerializedFileLayer<ColorModel>[]): Promise<InsertLayerAction<any>[]> {
    let insertLayerActions: InsertLayerAction<any>[] = [];
    let groupInsertLayerActions: InsertLayerAction<any>[] = [];
    for (let layer of layers) {
        let parsedLayer: Partial<WorkingFileLayer<ColorModel>> = {
            blendingMode: layer.blendingMode,
            filters: layer.filters,
            groupId: layer.groupId,
            height: layer.height,
            id: layer.id,
            name: layer.name,
            opacity: layer.opacity,
            transform: new DOMMatrix(layer.transform),
            type: layer.type,
            visible: layer.visible,
            width: layer.width,
        };
        if (layer.type === 'empty') {
            parsedLayer = {
                ...parsedLayer,
                type: 'empty',
            } as WorkingFileEmptyLayer<ColorModel>;
        }
        else if (layer.type === 'gradient') {
            parsedLayer = {
                ...parsedLayer,
                type: 'gradient',
                data: (layer as SerializedFileGradientLayer<ColorModel>).data,
            } as WorkingFileGradientLayer<ColorModel>;
        }
        else if (layer.type === 'group') {
            parsedLayer = {
                ...parsedLayer,
                type: 'group',
                expanded: (layer as SerializedFileGroupLayer<ColorModel>).expanded,
                layers: []
            } as WorkingFileGroupLayer<ColorModel>;
            groupInsertLayerActions = groupInsertLayerActions.concat(await parseLayersToActions((layer as SerializedFileGroupLayer<ColorModel>).layers));
        }
        else if (layer.type === 'raster') {
            const serializedLayer = layer as SerializedFileRasterLayer<ColorModel>;
            parsedLayer = {
                ...parsedLayer,
                type: 'raster',
                data: {
                    sourceUuid: await parseDataUrlToStoredImage(serializedLayer.data.sourceImageSerialized || ''),
                }
            } as WorkingFileRasterLayer<ColorModel>;
        }
        else if (layer.type === 'rasterSequence') {
            const serializedLayer = layer as SerializedFileRasterSequenceLayer<ColorModel>;
            const parsedSequence: WorkingFileRasterSequenceLayer<ColorModel>['data']['sequence'] = [];
            for (let frame of serializedLayer.data.sequence) {
                parsedSequence.push({
                    start: frame.start,
                    end: frame.end,
                    image: {
                        sourceUuid: await parseDataUrlToStoredImage(frame.image.sourceImageSerialized || ''),
                    },
                    thumbnailImageSrc: null
                });
            }
            parsedLayer = {
                ...parsedLayer,
                type: 'rasterSequence',
                data: {
                    currentFrame: parsedSequence[0]?.image,
                    sequence: parsedSequence
                }
            } as WorkingFileRasterSequenceLayer<ColorModel>;
            (window as any).parsedLayer = parsedLayer;
        }
        else if (layer.type === 'vector') {
            const serializedLayer = layer as SerializedFileVectorLayer<ColorModel>;
            let image: HTMLImageElement | undefined;
            if (serializedLayer?.data?.sourceSvgSerialized) {
                image = new Image();
                await new Promise<void>((resolve) => {
                    image!.onload = () => {
                        resolve();
                    };
                    image!.onerror = () => {
                        resolve();
                    };
                    image!.src = URL.createObjectURL(
                        createBlobFromDataUri(serializedLayer.data.sourceSvgSerialized!)
                    );
                });
            }
            parsedLayer = {
                ...parsedLayer,
                type: 'vector',
                data: {
                    sourceUuid: image ? await createStoredSvg(image) : undefined,
                },
            } as WorkingFileVectorLayer<ColorModel>;
        }
        else if (layer.type === 'vectorPath') {
            parsedLayer = {
                ...parsedLayer,
                type: 'vectorPath',
                data: (layer as SerializedFileVectorPathLayer<ColorModel>).data,
            } as WorkingFileVectorPathLayer<ColorModel>;
        }
        else if (layer.type === 'video') {
            const serializedLayer = layer as SerializedFileVideoLayer<ColorModel>;
            let video: HTMLVideoElement | undefined;
            if (serializedLayer?.data?.sourceVideoSerialized) {
                video = document.createElement('video');
                await new Promise<void>((resolve) => {
                    video!.addEventListener('loadeddata', () => {
                        let hasResolved = false;
                        video!.addEventListener('playing', () => {
                            video!.pause();
                            video!.currentTime = 0;
                            if (!hasResolved) {
                                clearTimeout(playStartTimeout);
                                resolve();
                            }
                        }, { once: true });
                        video!.play();
                        let playStartTimeout = setTimeout(() => {
                            hasResolved = true;
                            resolve();
                        }, 1000);
                    }, { once: true });
                    video!.addEventListener('error', (error) => {
                        console.error(error);
                        resolve();
                    }, { once: true });
                    video!.src = URL.createObjectURL(
                        createBlobFromDataUri(serializedLayer.data.sourceVideoSerialized!)
                    );
                });
            }
            parsedLayer = {
                ...parsedLayer,
                type: 'video',
                data: {
                    sourceUuid: video ? await createStoredVideo(video) : undefined,
                },
            } as WorkingFileVideoLayer<ColorModel>;
        }
        else if (layer.type === 'text') {
            parsedLayer = {
                ...parsedLayer,
                type: 'text',
                data: (layer as SerializedFileTextLayer<ColorModel>).data,
            } as WorkingFileTextLayer<ColorModel>;
        }
        insertLayerActions.push(
            new InsertLayerAction<InsertAnyLayerOptions<ColorModel>>(parsedLayer as InsertAnyLayerOptions<ColorModel>)
        );
    }
    insertLayerActions = insertLayerActions.concat(groupInsertLayerActions);
    return insertLayerActions;
}

async function parseDataUrlToStoredImage(dataUrl: string): Promise<string> {
    const image = new Image();
    const base64Fetch = await fetch(dataUrl);
    const imageBlob = await base64Fetch.blob();
    await new Promise<void>((resolve) => {
        image.onload = () => {
            resolve();
        };
        image.onerror = () => {
            resolve();
        };
        image.src = URL.createObjectURL(imageBlob);
    });
    return await createStoredImage(image);
}
