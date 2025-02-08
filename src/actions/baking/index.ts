import { markRaw } from 'vue';
import canvasStore from '@/store/canvas';
import { getStoredImageOrCanvas } from '@/store/image';
import { getLayerById, regenerateLayerThumbnail } from '@/store/working-file';
import { getImageDataFromImage, getImageDataFromCanvas, getImageDataFromImageBitmap, createImageFromImageData } from '@/lib/image';
import { bakeCanvasFilters, cancelBakeCanvasFilters } from '@/workers';

import type { WorkingFileAnyLayer, ColorModel } from '@/types';

export async function updateBakedImageForLayer(layerOrLayerId: WorkingFileAnyLayer<ColorModel> | number) {
    const layer = typeof layerOrLayerId === 'number' ? getLayerById(layerOrLayerId) : layerOrLayerId;
    if (!layer) return;
    if (!layer.filters || layer.filters.length === 0) {
        layer.bakedImage = null;
        cancelBakeCanvasFilters(layer.id);
        return;
    }
    if (layer.type === 'raster') {
        const sourceImage = getStoredImageOrCanvas(layer.data.sourceUuid ?? '');
        if (!sourceImage) return;
        const sourceImageData = (sourceImage instanceof HTMLImageElement)
            ? getImageDataFromImage(sourceImage)
            : (sourceImage instanceof ImageBitmap)
                ? getImageDataFromImageBitmap(sourceImage, { imageOrientation: layer.renderer.renderMode === 'webgl' ? 'flipY' : 'none' })
                : getImageDataFromCanvas(sourceImage);
        try {
            setTimeout(() => {
                layer.isBaking = true;
            }, 0);
            const newImageData = await bakeCanvasFilters(sourceImageData, layer.id, layer.filters);
            const bakedImage = await createImageFromImageData(newImageData);
            layer.bakedImage = markRaw(bakedImage);
            layer.isBaking = false;
            regenerateLayerThumbnail(layer);
            canvasStore.set('dirty', true);
        } catch (error) {
            layer.isBaking = false;
        }
    }
}
