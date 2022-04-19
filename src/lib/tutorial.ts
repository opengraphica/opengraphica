import appEmitter from '@/lib/emitter';
import editorStore, { TutorialFlags } from '@/store/editor';

interface TutorialNotification {
    flag: keyof TutorialFlags;
    title: string;
    message: string | { touch: string, mouse: string };
}

const tutorialNotificationStack: TutorialNotification[] = [];
let notificationCanShowIntervalHandle: number | undefined = undefined;
let isCurrentlyShowingTutorialNotification: boolean = false;

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
    tutorialNotificationStack.push(notification);
    if (notificationCanShowIntervalHandle == null && !isCurrentlyShowingTutorialNotification) {
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

function showNextTutorialNotification() {
    const notification = tutorialNotificationStack.shift();
    if (notification) {
        if (editorStore.state.tutorialFlags[notification.flag]) {
            showNextTutorialNotification();
        } else {
            isCurrentlyShowingTutorialNotification = true;
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
                onClose() {
                    isCurrentlyShowingTutorialNotification = false;
                    editorStore.dispatch('addTutorialFlag', notification.flag);
                    showNextTutorialNotification();
                }
            });
        }
    }
}