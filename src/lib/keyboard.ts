/**
 * Parts of this file were adapted from miniPaint
 * @license MIT https://github.com/viliusle/miniPaint/blob/master/MIT-LICENSE.txt
 */

import appEmitter from '@/lib/emitter';
import { isInput } from '@/lib/events';

function onDocumentKeyDown(e: KeyboardEvent) {

}

function onDocumentKeyUp(e: KeyboardEvent) {
    
}

let isPastingImage: boolean = false;
async function onDocumentPaste(e: ClipboardEvent) {
    if (isInput(e.target)) return;

    if (!isPastingImage) {
        if (e.clipboardData) {
            const items = e.clipboardData.items;
            if (items) {
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    if (item.type.indexOf("image") !== -1) {
                        const file = item.getAsFile();
                        if (file) {
                            appEmitter.emit('app.wait.startBlocking', { id: 'documentPasteImage', label: 'Loading Image' });
                            isPastingImage = true;
                            const { openFromFileList } = await import(/* webpackChunkName: 'module-file-open' */ '@/modules/file/open');
                            await openFromFileList([file], { insert: true });
                            isPastingImage = false;
                            appEmitter.emit('app.wait.stopBlocking', { id: 'documentPasteImage' });
                        }
                    }
                }
                e.preventDefault();
            }
        }
    }
} 

document.addEventListener('keydown', onDocumentKeyDown, false);
document.addEventListener('keyup', onDocumentKeyUp, false);
document.addEventListener('paste', onDocumentPaste, false);