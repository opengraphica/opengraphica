import cloneDeep from 'lodash/cloneDeep';

import { t } from '@/i18n';

import editorStore from '@/store/editor';
import historyStore from '@/store/history';
import { createStoredImage, getStoredImageCanvas, deleteStoredImage } from '@/store/image';
import workingFileStore, { getSelectedLayers } from '@/store/working-file';
import { activeSelectionMask, activeSelectionMaskCanvasOffset, appliedSelectionMask, appliedSelectionMaskCanvasOffset } from '@/canvas/store/selection-state';

import appEmitter from '@/lib/emitter';
import { cloneCanvas } from '@/lib/image';
import { unexpectedErrorMessage } from '@/lib/notify';

import { BundleAction } from '@/actions/bundle';
import { ClearSelectionAction } from '@/actions/clear-selection';
import { DeleteLayersAction } from '@/actions/delete-layers';
import { UpdateLayerAction } from '@/actions/update-layer';

import { transferRendererTilesToRasterLayerUpdates, useRenderer } from '@/renderers';

import type {
    ColorModel, UpdateAnyLayerOptions,
    WorkingFileAnyLayer,
} from '@/types';

export async function copySelectedLayers() {
    let selectedLayers = getSelectedLayers();
    if (selectedLayers.length === 0) {
        appEmitter.emit('app.notify', {
            type: 'info',
            title: t('moduleGroup.image.modules.copy.noSelectedLayers.title'),
            message: t('moduleGroup.image.modules.copy.noSelectedLayers.message'),
            duration: 5000,
        });
        return;   
    }

    // Delete the cloned images from previous clipboard buffer layers.
    for (const layer of editorStore.get('clipboardBufferLayers')) {
        if (layer.type === 'raster') {
            deleteStoredImage(layer.data.sourceUuid);
        }
    }

    // Clone the images of clipboard buffer layers, don't want future edits to affect clipboard buffer.
    const clipboardBufferLayers: WorkingFileAnyLayer[] = [];
    for (const layer of getSelectedLayers()) {
        const layerCopy = cloneDeep(layer);
        if (layerCopy.type === 'raster') {
            const storedImage = await getStoredImageCanvas(layerCopy.data.sourceUuid);
            if (storedImage) {
                const imageClone = cloneCanvas(storedImage);
                layerCopy.data.sourceUuid = await createStoredImage(imageClone);
            }
        }
        clipboardBufferLayers.push(layerCopy);
    }

    editorStore.set('clipboardBufferLayers', clipboardBufferLayers);
    const selectionMask = activeSelectionMask.value ?? appliedSelectionMask.value;
    const selectionMaskCanvasOffset = activeSelectionMask.value ? activeSelectionMaskCanvasOffset.value : appliedSelectionMaskCanvasOffset.value;
    editorStore.set('clipboardBufferSelectionMask', selectionMask);
    editorStore.set('clipboardBufferSelectionMaskCanvasOffset', new DOMPoint(selectionMaskCanvasOffset.x, selectionMaskCanvasOffset.y));
    try {
        const { exportAsImage } = await import(/* webpackChunkName: 'module-file-export' */ '../file/export');
        const exportResults = await exportAsImage({
            fileType: 'png',
            layerSelection: 'selected',
            applySelectionMask: true,
            toClipboard: true,
            generateImageHash: true
        });
        editorStore.set('hasClipboardUpdateSupport', true);
        editorStore.set('clipboardBufferImageHash', exportResults.generatedImageHash);
    } catch (error) {
        console.error('[src/modules/image/copy.ts]', error);
        editorStore.set('clipboardBufferImageHash', null);
        editorStore.set('clipboardBufferUpdateTimestamp', new Date().getTime());
    }
}

export async function cutSelectedLayers() {
    await copySelectedLayers();
    if (activeSelectionMask.value != null || appliedSelectionMask.value != null) {
        const updateLayerActions: UpdateLayerAction<UpdateAnyLayerOptions<ColorModel>>[] = [];
        const selectedLayers = getSelectedLayers();
        for (const layer of selectedLayers) {
            if (layer.type === 'raster') {
                const renderer = await useRenderer();
                const tiles = await renderer.applySelectionMaskToAlphaChannel(layer.id, { invert: true });
                updateLayerActions.push(
                    new UpdateLayerAction({
                        id: layer.id,
                        data: {
                            tileUpdates: await transferRendererTilesToRasterLayerUpdates(tiles),
                            alreadyRendererd: true,
                        }
                    })
                );
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
