import cloneDeep from 'lodash/cloneDeep';
import editorStore from '@/store/editor';
import historyStore from '@/store/history';
import workingFileStore, { getSelectedLayers } from '@/store/working-file';
import appEmitter from '@/lib/emitter';
import { unexpectedErrorMessage } from '@/lib/notify';
import { createImageFromCanvas } from '@/lib/image';
import { BundleAction } from '@/actions/bundle';
import { ClearSelectionAction } from '@/actions/clear-selection';
import { DeleteLayersAction } from '@/actions/delete-layers';
import { UpdateLayerAction } from '@/actions/update-layer';
import { activeSelectionMask, activeSelectionMaskCanvasOffset, blitActiveSelectionMask } from '@/canvas/store/selection-state';
import type {
    ColorModel, UpdateAnyLayerOptions, WorkingFileRasterLayer
} from '@/types';

export async function copySelectedLayers() {
    editorStore.set('clipboardBufferLayers',
        cloneDeep(getSelectedLayers())
    );
    editorStore.set('clipboardBufferSelectionMask', activeSelectionMask.value);
    editorStore.set('clipboardBufferSelectionMaskCanvasOffset', new DOMPoint(activeSelectionMaskCanvasOffset.value.x, activeSelectionMaskCanvasOffset.value.y));
    try {
        const { exportAsImage } = await import(/* webpackChunkName: 'module-file-export' */ '../file/export');
        const exportResults = await exportAsImage({
            fileType: 'png',
            layerSelection: 'selected',
            blitActiveSelectionMask: true,
            toClipboard: true,
            generateImageHash: true
        });
        editorStore.set('hasClipboardUpdateSupport', true);
        editorStore.set('clipboardBufferImageHash', exportResults.generatedImageHash);
    } catch (error: any) {
        editorStore.set('clipboardBufferImageHash', null);
        editorStore.set('clipboardBufferUpdateTimestamp', new Date().getTime());
    }
}

export async function cutSelectedLayers() {
    await copySelectedLayers();
    if (activeSelectionMask.value != null) {
        const updateLayerActions: UpdateLayerAction<UpdateAnyLayerOptions<ColorModel>>[] = [];
        const selectedLayers = getSelectedLayers();
        for (const layer of selectedLayers) {
            if (layer.type === 'raster') {
                const rasterLayer = layer as WorkingFileRasterLayer<ColorModel>;
                if (rasterLayer.data.sourceImage) {
                    const newImage = await createImageFromCanvas(
                        await blitActiveSelectionMask(rasterLayer.data.sourceImage, rasterLayer.transform, 'source-out')
                    );
                    updateLayerActions.push(
                        new UpdateLayerAction({
                            id: rasterLayer.id,
                            data: {
                                sourceImage: newImage,
                                sourceImageIsObjectUrl: true
                            }
                        })
                    );
                }
            }
        }
        await historyStore.dispatch('runAction', {
            action: new BundleAction('cutLayers', 'action.cutLayers', [
                ...updateLayerActions,
                new ClearSelectionAction()
            ])
        });
    } else {
        await historyStore.dispatch('runAction', {
            action: new BundleAction('cutLayers', 'action.cutLayers', [
                new DeleteLayersAction(workingFileStore.state.selectedLayerIds)
            ])
        });
    }
}

// For firefox, experiment with 
// dom.events.asyncClipboard.clipboardItem

export async function copyAllLayers(options = {}) {
    try {
        const { exportAsImage } = await import(/* webpackChunkName: 'module-file-export' */ '../file/export');
        const exportResults = await exportAsImage({
            fileType: 'png',
            toClipboard: true,
            generateImageHash: true
        });
        editorStore.set('hasClipboardUpdateSupport', true);
        editorStore.set('clipboardBufferImageHash', exportResults.generatedImageHash);
    } catch (error: any) {
        editorStore.set('clipboardBufferImageHash', null);
        await new Promise<void>((resolve) => {
            setTimeout(resolve, 1);
        });
        appEmitter.emit('app.notify', {
            type: 'error',
            dangerouslyUseHTMLString: true,
            message: unexpectedErrorMessage
        });
    }
}
