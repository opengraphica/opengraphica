import appEmitter from '@/lib/emitter';
import { unexpectedErrorMessage } from '@/lib/notify';

// For firefox, experiment with 
// dom.events.asyncClipboard.clipboardItem

export async function copyAllLayers() {
    try {
        const { exportAsImage } = await import(/* webpackChunkName: 'module-file-export' */ '../file/export');
        await exportAsImage({
            fileType: 'png',
            toClipboard: true
        });
    } catch (error) {
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
