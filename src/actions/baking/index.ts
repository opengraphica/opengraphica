import { markRaw } from 'vue';
import canvasStore from '@/store/canvas';
import { getLayerById } from '@/store/working-file';
import { getImageDataFromImage, createImageFromImageData } from '@/lib/image';
import { bakeCanvasFilters } from '@/workers';

import type { WorkingFileAnyLayer, ColorModel } from '@/types';

export async function updateBakedImageForLayer(layerOrLayerId: WorkingFileAnyLayer<ColorModel> | number) {
    const layer = typeof layerOrLayerId === 'number' ? getLayerById(layerOrLayerId) : layerOrLayerId;
    if (!layer) return;
    if (!layer.filters || layer.filters.length === 0) return;
    if (layer.type === 'raster') {
        if (!layer.data.sourceImage) return;
        const sourceImageData = getImageDataFromImage(layer.data.sourceImage);
        try {
            const newImageData = await bakeCanvasFilters(sourceImageData, layer.id, layer.filters);
            const bakedImage = await createImageFromImageData(newImageData);
            layer.bakedImage = markRaw(bakedImage);
            canvasStore.set('dirty', true);
        } catch (error) {
            // Ignore
        }
    }
}
