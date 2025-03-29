import { v4 as uuidv4 } from 'uuid';
import i18n, { rt, t, tm } from '@/i18n';
import appEmitter from '@/lib/emitter';
import { NotificationHandle } from 'element-plus/lib/components/notification/src/notification.d';
import editorStore, { TutorialFlags } from '@/store/editor';
import preferencesStore from '@/store/preferences';

interface TutorialNotification {
    flag: keyof TutorialFlags;
    title: string;
    message: string | { touch: string, mouse: string };
}

const tutorialNotificationStack: TutorialNotification[] = [];
let notificationCanShowIntervalHandle: number | undefined = undefined;
let currentlyShowingTutorialNotification: string | null = null;
let currentlyShowingTutorialNotificationHandle: NotificationHandle | null = null;

export function waitForNoOverlays(): Promise<void> {
    return new Promise<void>((resolve) => {
        const intervalHandle = window.setInterval(() => {
            const preventableElement = document.querySelector('.og-menu-drawers > .og-menu-drawer, .og-dialogs > .el-overlay');
            if (preventableElement == null) {
                resolve();
                window.clearInterval(intervalHandle);
            }
        }, 250);
    });
}

export function scheduleTutorialNotification(notification: TutorialNotification) {
    if (!preferencesStore.state.showTutorialNotifications) return;
    tutorialNotificationStack.push(notification);
    if (notificationCanShowIntervalHandle == null && !currentlyShowingTutorialNotification) {
        notificationCanShowIntervalHandle = window.setInterval(() => {
            const preventableElement = document.querySelector('.og-menu-drawers > .og-menu-drawer, .og-dialogs > .el-overlay');
            if (preventableElement == null) {
                showNextTutorialNotification();
                window.clearInterval(notificationCanShowIntervalHandle);
                notificationCanShowIntervalHandle = undefined;
            }
        }, 250);
    }
}

export function dismissTutorialNotification(flag: keyof TutorialFlags) {
    if (currentlyShowingTutorialNotification === flag && currentlyShowingTutorialNotificationHandle) {
        currentlyShowingTutorialNotificationHandle.close();
    } else {
        for (const [i, tutorialNotification] of tutorialNotificationStack.entries()) {
            if (tutorialNotification.flag === flag) {
                tutorialNotificationStack.splice(i, 1);
                return;
            }
        }
    }
}

function showNextTutorialNotification() {
    const notification = tutorialNotificationStack.shift();
    if (notification) {
        if (editorStore.state.tutorialFlags[notification.flag]) {
            showNextTutorialNotification();
        } else if (preferencesStore.state.showTutorialNotifications) {
            currentlyShowingTutorialNotification = notification.flag;
            let message = '';
            if (typeof notification.message === 'string') {
                message = notification.message;
            } else {
                message = editorStore.get('isTouchUser') ? notification.message.touch : notification.message.mouse;
            }
            const buttonUuid = uuidv4();
            message += `<div class="flex justify-between flex-wrap mt-4">
                <a id="${buttonUuid + '-disable-tutorial'}" class="el-button el-button is-link px-0" style="--el-button-border-color: transparent; --el-button-hover-border-color: transparent; --el-button-text-color: var(--el-color-primary)">${i18n.global.t('lib.tutorial.notification.dontShowTips')}</a>
                <a id="${buttonUuid + '-ok'}" class="el-button el-button el-button--primary ml-3">${i18n.global.t('lib.tutorial.notification.gotIt')}</a>
            </div>`;
            appEmitter.emit('app.notify', {
                type: 'info',
                title: notification.title,
                message,
                dangerouslyUseHTMLString: true,
                duration: 0,
                onCreated(handle) {
                    currentlyShowingTutorialNotificationHandle = handle;
                    document.getElementById(buttonUuid + '-disable-tutorial')?.addEventListener('click', () => {
                        preferencesStore.set('showTutorialNotifications', false);
                        handle.close();
                    });
                    document.getElementById(buttonUuid + '-ok')?.addEventListener('click', () => {
                        handle.close();
                    });
                },
                onClose() {
                    currentlyShowingTutorialNotification = null;
                    currentlyShowingTutorialNotificationHandle = null;
                    editorStore.dispatch('addTutorialFlag', notification.flag);
                    showNextTutorialNotification();
                }
            });
        }
    }
}