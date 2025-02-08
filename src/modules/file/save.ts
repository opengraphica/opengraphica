/**
 * Parts of this file were adapted from miniPaint
 * @license MIT https://github.com/viliusle/miniPaint/blob/master/MIT-LICENSE.txt
 */
import canvasStore from '@/store/canvas';
import workingFileStore, { getCanvasRenderingContext2DSettings } from '@/store/working-file';
import { writeWorkingFile } from '@/store/data/working-file-database';
import { saveAs } from 'file-saver';
import { getStoredImageOrCanvas } from '@/store/image';
import { getStoredSvgDataUrl } from '@/store/svg';
import { getStoredVideoDataUrl } from '@/store/video';

import type {
    FileSystemFileHandle, SerializedFile, SerializedFileLayer, WorkingFileLayer, ColorModel, SerializedFileLayerMask,
    SerializedFileGradientLayer, SerializedFileGroupLayer, SerializedFileTextLayer, SerializedFileRasterLayer,
    SerializedFileRasterSequenceLayer, SerializedFileVectorLayer, SerializedFileVideoLayer, WorkingFile, WorkingFileGradientLayer,
    WorkingFileGroupLayer, WorkingFileTextLayer, WorkingFileRasterLayer, WorkingFileRasterSequenceLayer,
    WorkingFileVectorLayer, WorkingFileVideoLayer,
} from '@/types';

interface SaveImageAsOptions {
    fileName?: string;
}

export async function saveImage(fileHandle: FileSystemFileHandle) {
    const serializedFile = serializeWorkingFile();
    const writable = await fileHandle.createWritable();
    await writable.write(new Blob([JSON.stringify(serializedFile, null, "\t")], { type: 'text/plain' }));
    await writable.close();
}

export async function saveImageAs(options: SaveImageAsOptions = {}) {
    const serializedFile = serializeWorkingFile();
    const fileName = (options.fileName || 'image').replace(/(\.(json|png|jpg|jpeg|webp|gif|bmp|tif|tiff))$/ig, '') + '.json';
    saveAs(new Blob([JSON.stringify(serializedFile, null, "\t")], { type: 'text/plain' }), fileName);
}

export async function saveWorkingFileToTemporaryStorage() {
    const workingFile: WorkingFile<ColorModel> = {
        version: '0.0.1-ALPHA.1',
        date: new Date().toISOString(),
        background: workingFileStore.get('background'),
        colorModel: workingFileStore.get('colorModel'),
        colorSpace: workingFileStore.get('colorSpace'),
        drawOriginX: workingFileStore.get('drawOriginX'),
        drawOriginY: workingFileStore.get('drawOriginY'),
        height: workingFileStore.get('height'),
        layerIdCounter: workingFileStore.get('layerIdCounter'),
        maskIdCounter: workingFileStore.get('maskIdCounter'),
        masks: workingFileStore.get('masks'),
        measuringUnits: workingFileStore.get('measuringUnits'),
        resolutionUnits: workingFileStore.get('resolutionUnits'),
        resolutionX: workingFileStore.get('resolutionX'),
        resolutionY: workingFileStore.get('resolutionY'),
        scaleFactor: workingFileStore.get('scaleFactor'),
        selectedLayerIds: workingFileStore.get('selectedLayerIds'),
        width: workingFileStore.get('width'),
        layers: workingFileStore.get('layers'),
    }
    try {
        await writeWorkingFile(workingFile);
    } catch (error) {
        console.warn(error);
        throw new Error('Could not save file. It may be too large.');
    }
}

function serializeWorkingFile(): SerializedFile<ColorModel> {
    const masks = workingFileStore.get('masks');
    const serializedMasks: Record<number, SerializedFileLayerMask> = {};
    for (const maskId of Object.keys(masks).map(key => parseInt(key))) {
        const mask = masks[maskId];
        serializedMasks[maskId] = {
            sourceImageSerialized: serializeStoredImage(mask.sourceUuid),
            hash: mask.hash,
            offset: mask.offset,
        }
    }

    const serializedFile: SerializedFile<ColorModel> = {
        version: '0.0.1-ALPHA.1',
        date: new Date().toISOString(),
        background: workingFileStore.get('background'),
        colorModel: workingFileStore.get('colorModel'),
        colorSpace: workingFileStore.get('colorSpace'),
        drawOriginX: workingFileStore.get('drawOriginX'),
        drawOriginY: workingFileStore.get('drawOriginY'),
        height: workingFileStore.get('height'),
        layerIdCounter: workingFileStore.get('layerIdCounter'),
        masks: serializedMasks,
        measuringUnits: workingFileStore.get('measuringUnits'),
        resolutionUnits: workingFileStore.get('resolutionUnits'),
        resolutionX: workingFileStore.get('resolutionX'),
        resolutionY: workingFileStore.get('resolutionY'),
        scaleFactor: workingFileStore.get('scaleFactor'),
        selectedLayerIds: workingFileStore.get('selectedLayerIds'),
        width: workingFileStore.get('width'),
        layers: serializeWorkingFileLayers(workingFileStore.get('layers'))
    };
    return serializedFile;
}

function serializeStoredImage(imageUuid?: string): string {
    const canvas = document.createElement('canvas');
    try {
        const sourceImage = getStoredImageOrCanvas(imageUuid);
        if (!sourceImage) return '';

        canvas.width = sourceImage.width;
        canvas.height = sourceImage.height;
        const ctx = canvas.getContext('2d', getCanvasRenderingContext2DSettings());
        if (!ctx) {
            return '';
        }
        ctx.imageSmoothingEnabled = false;
        
        if (canvasStore.state.renderer === 'webgl' && sourceImage instanceof ImageBitmap) {
            ctx.scale(1, -1);
            ctx.translate(0, -sourceImage.height);
        }
        if (sourceImage) {
            ctx.drawImage(sourceImage, 0, 0);
        }
        return canvas.toDataURL('image/png');
    } catch (error: any) {
        canvas.width = 1;
        canvas.height = 1;
    }
    return '';
}

function serializeWorkingFileLayers(layers: WorkingFileLayer<ColorModel>[]): SerializedFileLayer<ColorModel>[] {
    let serializedLayers: SerializedFileLayer<ColorModel>[] = [];
    for (let layer of layers) {
        let serializedLayer: SerializedFileLayer<ColorModel> = {
            blendingMode: layer.blendingMode,
            filters: layer.filters,
            groupId: layer.groupId,
            height: layer.height,
            id: layer.id,
            name: layer.name,
            opacity: layer.opacity,
            transform: [layer.transform.a, layer.transform.b, layer.transform.c, layer.transform.d, layer.transform.e, layer.transform.f],
            type: layer.type,
            visible: layer.visible,
            width: layer.width,
        };
        if (layer.type === 'gradient') {
            serializedLayer = {
                ...serializedLayer,
                type: 'gradient',
                data: (layer as WorkingFileGradientLayer<ColorModel>).data
            } as SerializedFileGradientLayer<ColorModel>;
        }
        else if (layer.type === 'group') {
            serializedLayer = {
                ...serializedLayer,
                type: 'group',
                expanded: (layer as WorkingFileGroupLayer<ColorModel>).expanded,
                layers: serializeWorkingFileLayers((layer as WorkingFileGroupLayer<ColorModel>).layers)
            } as SerializedFileGroupLayer<ColorModel>;
        }
        else if (layer.type === 'raster') {
            serializedLayer = {
                ...serializedLayer,
                type: 'raster',
                data: {
                    sourceImageSerialized: serializeStoredImage((layer as WorkingFileRasterLayer<ColorModel>).data.sourceUuid)
                }
            } as SerializedFileRasterLayer<ColorModel>;
        }
        else if (layer.type === 'rasterSequence') {
            const memoryLayer = (layer as WorkingFileRasterSequenceLayer<ColorModel>);
            const serializedSequence: SerializedFileRasterSequenceLayer<ColorModel>['data']['sequence'] = [];
            for (let frame of memoryLayer.data.sequence) {
                serializedSequence.push({
                    start: frame.start,
                    end: frame.end,
                    image: {
                        sourceImageSerialized: serializeStoredImage(frame.image.sourceUuid)
                    }
                });
            }
            serializedLayer = {
                ...serializedLayer,
                type: 'rasterSequence',
                data: {
                    sequence: serializedSequence
                }
            } as SerializedFileRasterSequenceLayer<ColorModel>;
        }
        else if (layer.type === 'text') {
            serializedLayer = {
                ...serializedLayer,
                type: 'text',
                data: (layer as WorkingFileTextLayer<ColorModel>).data
            } as SerializedFileTextLayer<ColorModel>;
        }
        else if (layer.type === 'vector') {
            serializedLayer = {
                ...serializedLayer,
                type: 'vector',
                data: {
                    sourceSvgSerialized: getStoredSvgDataUrl(
                        (layer as WorkingFileVectorLayer<ColorModel>).data.sourceUuid
                    )
                }
            } as SerializedFileVectorLayer<ColorModel>;
        }
        else if (layer.type === 'video') {
            serializedLayer = {
                ...serializedLayer,
                type: 'video',
                data: {
                    sourceVideoSerialized: getStoredVideoDataUrl(
                        (layer as WorkingFileVideoLayer<ColorModel>).data.sourceUuid
                    )
                }
            } as SerializedFileVideoLayer<ColorModel>;
        }
        serializedLayers.push(serializedLayer);
    }
    return serializedLayers;
}
