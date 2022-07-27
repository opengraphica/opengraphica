import cloneDeep from 'lodash/cloneDeep';
import editorStore from '@/store/editor';
import historyStore from '@/store/history';
import workingFileStore, { getSelectedLayers } from '@/store/working-file';
import appEmitter from '@/lib/emitter';
import { unexpectedErrorMessage } from '@/lib/notify';
import { BundleAction } from '@/actions/bundle';
import { DeleteLayersAction } from '@/actions/delete-layers';

export async function copySelectedLayers() {
    editorStore.set('clipboardBufferLayers',
        cloneDeep(getSelectedLayers())
    );
    try {
        const { exportAsImage } = await import(/* webpackChunkName: 'module-file-export' */ '../file/export');
        const exportResults = await exportAsImage({
            fileType: 'png',
            layerSelection: 'selected',
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
    await historyStore.dispatch('runAction', {
        action: new BundleAction('cutLayers', 'action.cutLayers', [
            new DeleteLayersAction(workingFileStore.state.selectedLayerIds)
        ])
    });
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
