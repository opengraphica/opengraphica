import workingFileStore, { WorkingFileState, getLayersByType } from '@/store/working-file';
import historyStore from '@/store/history';
import editorStore, { updateRasterSequenceLayerWithTimeline } from '@/store/editor';
import { ColorModel, WorkingFileRasterLayer, InsertRasterSequenceLayerOptions } from '@/types';
import { BundleAction } from '@/actions/bundle';
import { DeleteLayersAction } from '@/actions/delete-layers';
import { InsertLayerAction } from '@/actions/insert-layer';

interface ConvertLayersToImageSequenceOptions {
    frameDelay?: number;
}

export async function convertLayersToImageSequence(options: ConvertLayersToImageSequenceOptions = {}): Promise<void> {
    let frameDelay = options.frameDelay || 1;

    // TODO - base on selected layers

    const combineLayers = getLayersByType<WorkingFileRasterLayer<ColorModel>>('raster');
    const rasterSequenceLayer: InsertRasterSequenceLayerOptions<ColorModel> = {
        type: 'rasterSequence',
        height: workingFileStore.get('height'),
        name: 'New Image Sequence',
        width: workingFileStore.get('width'),
        data: {
            sequence: []
        }
    };
    let start: number = 0;
    if (combineLayers.length > 0) {
        for (let layer of combineLayers) {
            let image = new Image();
            await new Promise<void>((resolve, reject) => {
                image.onload = () => {
                    resolve();
                };
                image.onerror = () => {
                    reject();
                };
                image.src = layer.data.sourceImage?.src || '';
            });
            rasterSequenceLayer.data?.sequence.push({
                start: start,
                end: Math.floor(start + frameDelay),
                image: {
                    sourceImage: image,
                    sourceImageIsObjectUrl: layer.data.sourceImageIsObjectUrl
                },
                thumbnailImageSrc: null
            });
            start = Math.floor(start + frameDelay);
        }
        rasterSequenceLayer.data && (rasterSequenceLayer.data.currentFrame = rasterSequenceLayer.data?.sequence[0].image);
        editorStore.dispatch('setTimelineCursor', start);
        updateRasterSequenceLayerWithTimeline(rasterSequenceLayer as any);
        historyStore.dispatch('runAction', {
            action: new BundleAction('convertLayersToImageSequence', 'action.convertLayersToImageSequence', [
                new DeleteLayersAction(combineLayers.map((layer) => layer.id)),
                new InsertLayerAction(rasterSequenceLayer)
            ])
        });
    }
}
