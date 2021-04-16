/**
 * Parts of this file were adapted from miniPaint
 * @license MIT https://github.com/viliusle/miniPaint/blob/master/MIT-LICENSE.txt
 */
import {
    SerializedFile, SerializedFileLayer, WorkingFileLayer, RGBAColor,
    SerializedFileGroupLayer, SerializedFileTextLayer, SerializedFileRasterLayer, SerializedFileVectorLayer,
    WorkingFileGroupLayer, WorkingFileTextLayer, WorkingFileRasterLayer, WorkingFileVectorLayer
} from '@/types';
import workingFileStore from '@/store/working-file';
import { saveAs } from 'file-saver';

interface SaveImageAsOptions {
    fileName?: string;
}

export async function saveImageAs(options: SaveImageAsOptions = {}) {
    const activeLayer = workingFileStore.get('activeLayer');
    const serializedFile: Partial<SerializedFile<RGBAColor>> = {
        version: '0.0.1-ALPHA.1',
        date: new Date().toISOString(),
        activeLayerId: activeLayer ? activeLayer.id : null,
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
        width: workingFileStore.get('width'),
        layers: serializeLayers(workingFileStore.get('layers'))
    };
    const fileName = (options.fileName || 'image').replace(/(\.(json|png|jpg|jpeg|webp|gif|bmp|tif|tiff))$/ig, '') + '.json';
    saveAs(new Blob([JSON.stringify(serializedFile, null, "\t")], { type: 'text/plain' }), fileName);
}

function serializeLayers(layers: WorkingFileLayer<RGBAColor>[]): SerializedFileLayer<RGBAColor>[] {
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
            x: layer.x,
            y: layer.y
        };
        switch (layer.type) {
            case 'group':
                serializedLayer = {
                    ...serializedLayer,
                    type: 'group',
                    layers: serializeLayers((layer as WorkingFileGroupLayer<RGBAColor>).layers)
                } as SerializedFileGroupLayer<RGBAColor>;
                break;
            case 'raster':
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
                } catch (error) {
                    canvas.width = 1;
                    canvas.height = 1;
                    throw error;
                }
                break;
            case 'vector':
                serializedLayer = {
                    ...serializedLayer,
                    type: 'vector',
                    data: (layer as WorkingFileVectorLayer<RGBAColor>).data
                } as SerializedFileVectorLayer<RGBAColor>;
                break;
            case 'text':
                serializedLayer = {
                    ...serializedLayer,
                    type: 'text',
                    data: (layer as WorkingFileTextLayer<RGBAColor>).data
                } as SerializedFileTextLayer<RGBAColor>;
                break;
        }
        serializedLayers.push(serializedLayer);
    }
    return serializedLayers;
}