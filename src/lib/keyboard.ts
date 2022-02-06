/**
 * Parts of this file were adapted from miniPaint
 * @license MIT https://github.com/viliusle/miniPaint/blob/master/MIT-LICENSE.txt
 */

import { ref } from 'vue';
import appEmitter from '@/lib/emitter';
import { isInput } from '@/lib/events';

export const isCtrlKeyPressed = ref<boolean>(false);
export const isShiftKeyPressed = ref<boolean>(false);
export const isAltKeyPressed = ref<boolean>(false);

function onDocumentKeyDown(e: KeyboardEvent) {
    if (e.key === 'Control') {
        isCtrlKeyPressed.value = true;
    } else if (e.key === 'Shift') {
        isShiftKeyPressed.value = true;
    } else if (e.key === 'Alt') {
        isAltKeyPressed.value = true;
    }
}

function onDocumentKeyUp(e: KeyboardEvent) {
    if (e.key === 'Control') {
        isCtrlKeyPressed.value = false;
    } else if (e.key === 'Shift') {
        isShiftKeyPressed.value = false;
    } else if (e.key === 'Alt') {
        isAltKeyPressed.value = false;
    }
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