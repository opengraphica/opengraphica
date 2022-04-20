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
            const preventableElement = document.querySelector('.ogr-menu-drawers > .ogr-menu-drawer, .ogr-dialogs > .el-overlay');
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
            const preventableElement = document.querySelector('.ogr-menu-drawers > .ogr-menu-drawer, .ogr-dialogs > .el-overlay');
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
        } else {
            currentlyShowingTutorialNotification = notification.flag;
            let message = '';
            if (typeof notification.message === 'string') {
                message = notification.message;
            } else {
                message = editorStore.get('isTouchUser') ? notification.message.touch : notification.message.mouse;
            }
            appEmitter.emit('app.notify', {
                type: 'info',
                title: notification.title,
                message,
                dangerouslyUseHTMLString: true,
                duration: 0,
                onCreated(handle) {
                    currentlyShowingTutorialNotificationHandle = handle;
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