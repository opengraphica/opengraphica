import { v4 as uuidv4 } from 'uuid';
import i18n from '@/i18n';
import appEmitter from '@/lib/emitter';

import { NotificationHandle } from 'element-plus/lib/components/notification/src/notification.d';

const notifyContentId = 'og-font-notify-' + uuidv4();
const loadingFontFamilies = new Set<string>();

let currentlyShowingNotification = false;
let currentlyShowingNotificationHandle: NotificationHandle | null = null;

function updateLoadingFontFamilyList() {
    const notifyContentContainer = document.getElementById(notifyContentId);
    if (notifyContentContainer && loadingFontFamilies.size > 0) {
        let html = `<ul>`;
        const sortedFontFamilies = Array.from(loadingFontFamilies).sort();
        for (const fontFamily of sortedFontFamilies) {
            html += '<li>' + fontFamily + '</li>';
        }
        html += '</ul>';
        notifyContentContainer.innerHTML = html;
    }
}

export async function notifyLoadingFontFamilies(fontFamilies: string[]) {
    for (const fontFamily of fontFamilies) {
        loadingFontFamilies.add(fontFamily);
    }

    if (loadingFontFamilies.size > 0) {
        if (!currentlyShowingNotification) {
            const { t } = i18n.global;
            currentlyShowingNotification = true;
            appEmitter.emit('app.notify', {
                type: 'info',
                title: t('lib.fontNotify.title'),
                message: `
                    ${t('lib.fontNotify.pleaseWait')}
                    <div id="${notifyContentId}"></div>
                `,
                dangerouslyUseHTMLString: true,
                duration: 0,
                onCreated(handle) {
                    currentlyShowingNotificationHandle = handle;
                    updateLoadingFontFamilyList();
                },
                onClose() {
                    currentlyShowingNotificationHandle = null;
                    currentlyShowingNotification = false;
                }
            });
        } else {
            updateLoadingFontFamilyList();
        }
    }
}

export async function notifyFontFamiliesLoaded(fontFamilies: string[]) {
    for (const fontFamily of fontFamilies) {
        loadingFontFamilies.delete(fontFamily);
    }

    updateLoadingFontFamilyList();
    appEmitter.emit('editor.tool.fontsLoaded');

    setTimeout(() => {
        if (loadingFontFamilies.size === 0) {
            currentlyShowingNotificationHandle?.close();
        }
    }, 1);
}
