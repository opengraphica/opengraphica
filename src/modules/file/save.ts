/**
 * Parts of this file were adapted from miniPaint
 * @license MIT https://github.com/viliusle/miniPaint/blob/master/MIT-LICENSE.txt
 */
import {
    SerializedFile, SerializedFileLayer, WorkingFileLayer, RGBAColor,
    SerializedFileGroupLayer, SerializedFileTextLayer, SerializedFileRasterLayer, SerializedFileRasterSequenceLayer, SerializedFileVectorLayer,
    WorkingFileGroupLayer, WorkingFileTextLayer, WorkingFileRasterLayer, WorkingFileRasterSequenceLayer, WorkingFileVectorLayer
} from '@/types';
import workingFileStore from '@/store/working-file';
import { saveAs } from 'file-saver';

interface SaveImageAsOptions {
    fileName?: string;
}

export async function saveImageAs(options: SaveImageAsOptions = {}) {
    const serializedFile = serializeWorkingFile();
    const fileName = (options.fileName || 'image').replace(/(\.(json|png|jpg|jpeg|webp|gif|bmp|tif|tiff))$/ig, '') + '.json';
    saveAs(new Blob([JSON.stringify(serializedFile, null, "\t")], { type: 'text/plain' }), fileName);
}

function serializeWorkingFile(): SerializedFile<RGBAColor> {
    const serializedFile: SerializedFile<RGBAColor> = {
        version: '0.0.1-ALPHA.1',
        date: new Date().toISOString(),
        colorModel: workingFileStore.get('colorModel'),
        colorSpace: workingFileStore.get('colorSpace'),
        drawOriginX: workingFileStore.get('drawOriginX'),
        drawOriginY: workingFileStore.get('drawOriginY'),
        height: workingFileStore.get('height'),
        layerIdCounter: workingFileStore.get('layerIdCounter'),
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

function serializeWorkingFileLayers(layers: WorkingFileLayer<RGBAColor>[]): SerializedFileLayer<RGBAColor>[] {
    let serializedLayers: SerializedFileLayer<RGBAColor>[] = [];
    for (let layer of layers) {
        let serializedLayer: SerializedFileLayer<RGBAColor> = {
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
        if (layer.type === 'group') {
            serializedLayer = {
                ...serializedLayer,
                type: 'group',
                layers: serializeWorkingFileLayers((layer as WorkingFileGroupLayer<RGBAColor>).layers)
            } as SerializedFileGroupLayer<RGBAColor>;
        } else if (layer.type === 'raster') {
            const canvas = document.createElement('canvas');
            canvas.width = layer.width;
            canvas.height = layer.height;
            const ctx = canvas.getContext('2d');
            try {
                if (!ctx) {
                    throw new Error('Missing canvas context');
                }
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage((layer as WorkingFileRasterLayer<RGBAColor>).data.sourceImage as HTMLImageElement, 0, 0);
                serializedLayer = {
                    ...serializedLayer,
                    type: 'raster',
                    data: {
                        sourceImageSerialized: canvas.toDataURL('image/png')
                    }
                } as SerializedFileRasterLayer<RGBAColor>;
                canvas.width = 1;
                canvas.height = 1;
            } catch (error: any) {
                canvas.width = 1;
                canvas.height = 1;
                throw error;
            }
        } else if (layer.type === 'rasterSequence') {
            const memoryLayer = (layer as WorkingFileRasterSequenceLayer<RGBAColor>);
            const serializedSequence: SerializedFileRasterSequenceLayer<RGBAColor>['data']['sequence'] = [];
            for (let frame of memoryLayer.data.sequence) {
                const canvas = document.createElement('canvas');
                canvas.width = layer.width;
                canvas.height = layer.height;
                const ctx = canvas.getContext('2d');
                try {
                    if (!ctx) {
                        throw new Error('Missing canvas context');
                    }
                    ctx.imageSmoothingEnabled = false;
                    ctx.drawImage(frame.image.sourceImage as HTMLImageElement, 0, 0);
                    serializedSequence.push({
                        start: frame.start,
                        end: frame.end,
                        image: {
                            sourceImageSerialized: canvas.toDataURL('image/png')
                        }
                    });
                    canvas.width = 1;
                    canvas.height = 1;
                } catch (error: any) {
                    canvas.width = 1;
                    canvas.height = 1;
                    throw error;
                }
            }
            serializedLayer = {
                ...serializedLayer,
                type: 'rasterSequence',
                data: {
                    sequence: serializedSequence
                }
            } as SerializedFileRasterSequenceLayer<RGBAColor>;
        } else if (layer.type === 'vector') {
            serializedLayer = {
                ...serializedLayer,
                type: 'vector',
                data: (layer as WorkingFileVectorLayer<RGBAColor>).data
            } as SerializedFileVectorLayer<RGBAColor>;
        } else if (layer.type === 'text') {
            serializedLayer = {
                ...serializedLayer,
                type: 'text',
                data: (layer as WorkingFileTextLayer<RGBAColor>).data
            } as SerializedFileTextLayer<RGBAColor>;
        }
        serializedLayers.push(serializedLayer);
    }
    return serializedLayers;
}
