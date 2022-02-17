/**
 * Parts of this file were adapted from miniPaint
 * @license MIT https://github.com/viliusle/miniPaint/blob/master/MIT-LICENSE.txt
 */

import defaultKeyboardMapConfig from '@/config/default-keyboard-map.json';
import { ref } from 'vue';
import appEmitter from '@/lib/emitter';
import { isInput } from '@/lib/events';
import { runModule } from '@/modules';
import { KeyboardMapConfigCategory } from '@/types';

export const isCtrlKeyPressed = ref<boolean>(false);
export const isMetaKeyPressed = ref<boolean>(false);
export const isCtrlOrMetaKeyPressed = ref<boolean>(false);
export const isShiftKeyPressed = ref<boolean>(false);
export const isAltKeyPressed = ref<boolean>(false);
export const isAnyModifierKeyPressed = ref<boolean>(false);

interface ShortcutDefinition {
    alt: boolean;
    ctrl: boolean;
    shift: boolean;
    action: {
        type: 'dock' | 'toolGroup' | 'runModule';
        target: string;
    };
}

const shortcutKeyMap = new Map<string, ShortcutDefinition[]>();

export function buildShortcutKeyMap(keyboardMapConfig: KeyboardMapConfigCategory[]) {
    for (const configGroup of keyboardMapConfig) {
        for (const action of configGroup.actions) {
            for (const shortcut of action.shortcuts) {
                const keys = shortcut.split(/[\+ ]+/);
                let primaryKey: string = '';
                let isShift: boolean = false;
                let isCtrl: boolean = false;
                let isAlt: boolean = false;
                for (const key of keys) {
                    if (key === 'shift') {
                        isShift = true;
                    } else if (key === 'ctrl') {
                        isCtrl = true;
                    } else if (key === 'alt') {
                        isAlt = true;
                    } else {
                        primaryKey = key;
                    }
                }
                let existingShortcuts = shortcutKeyMap.get(primaryKey) || [];
                existingShortcuts.push({
                    alt: isAlt,
                    ctrl: isCtrl,
                    shift: isShift,
                    action: action.action
                });
                shortcutKeyMap.set(primaryKey, existingShortcuts);
            }
        }
    }
}
buildShortcutKeyMap(defaultKeyboardMapConfig as any);

function onDocumentKeyDown(e: KeyboardEvent) {
    if (e.key === 'Control') {
        isCtrlKeyPressed.value = true;
        isCtrlOrMetaKeyPressed.value = true;
        isAnyModifierKeyPressed.value = true;
    } else if (e.key === 'Meta') {
        isMetaKeyPressed.value = true;
        isCtrlOrMetaKeyPressed.value = true;
        isAnyModifierKeyPressed.value = true;
    } else if (e.key === 'Shift') {
        isShiftKeyPressed.value = true;
        isAnyModifierKeyPressed.value = true;
    } else if (e.key === 'Alt') {
        isAltKeyPressed.value = true;
        isAnyModifierKeyPressed.value = true;
    } else if (e.key === 'Escape') {
        appEmitter.emit('editor.tool.cancelCurrentAction');
    } else if (isAnyModifierKeyPressed.value === true) {
        if (isInput(e.target)) return;
        const shortcuts = shortcutKeyMap.get(e.key.toLowerCase());
        if (shortcuts) {
            for (const shortcut of shortcuts) {
                if (
                    shortcut.alt === isAltKeyPressed.value &&
                    shortcut.ctrl === isCtrlOrMetaKeyPressed.value &&
                    shortcut.shift === isShiftKeyPressed.value
                ) {
                    e.preventDefault();
                    if (shortcut.action.type === 'toolGroup') {
                        (async () => {
                            const editorStore = (await import('@/store/editor')).default;
                            editorStore.dispatch('setActiveTool', { group: shortcut.action.target });
                        });
                    } else if (shortcut.action.type === 'dock') {
                        appEmitter.emit('app.dialogs.openFromDock', { name: shortcut.action.target });
                    } else if (shortcut.action.type === 'runModule') {
                        const actionSplit = shortcut.action.target.split('/');
                        runModule(actionSplit[0], actionSplit[1]);
                    }
                    break;
                }
            }
        }
    }
}

function onDocumentKeyUp(e: KeyboardEvent) {
    if (e.key === 'Control') {
        isCtrlKeyPressed.value = false;
    } else if (e.key === 'Meta') {
        isMetaKeyPressed.value = false;
    } else if (e.key === 'Shift') {
        isShiftKeyPressed.value = false;
    } else if (e.key === 'Alt') {
        isAltKeyPressed.value = false;
    }
    if (!isCtrlKeyPressed.value && !isMetaKeyPressed.value) {
        isCtrlOrMetaKeyPressed.value = false;
    }
    if (!isCtrlKeyPressed.value && !isMetaKeyPressed.value && !isShiftKeyPressed.value && !isAltKeyPressed.value) {
        isAnyModifierKeyPressed.value = false;
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
                            appEmitter.emit('app.workingFile.notifyImageLoadedFromClipboard');
                        }
                    }
                }
                e.preventDefault();
            }
        }
    }
} 

document.addEventListener('keydown', onDocumentKeyDown, true);
document.addEventListener('keyup', onDocumentKeyUp, true);
document.addEventListener('paste', onDocumentPaste, false);