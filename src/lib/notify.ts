import { inject } from 'vue';
import { Notify, NotificationParams, NotificationHandle } from 'element-plus/lib/components/notification/src/notification.d';

export function notifyInjector(injectName: string): any {
    const $notify = inject<Notify>(injectName) as Notify;
    return notifyPolyfill($notify);
}

export function notifyPolyfill($notify: Notify): Notify {
    const notifyFn = (options?: NotificationParams): NotificationHandle => {
        const notificationHandle = $notify(options);
        const notifications = document.querySelectorAll('body > .el-notification');
        if (notifications.length > 0) {
            (document.querySelector('.opengraphica') as Element).appendChild(
                notifications[notifications.length - 1]
            );
        }
        return notificationHandle;
    };
    notifyFn.closeAll = () => {
        return $notify.closeAll();
    }
    notifyFn.success = function() {
        return $notify.success(...arguments);
    }
    notifyFn.warning = function() {
        return $notify.warning(...arguments);
    }
    notifyFn.error = function() {
        return $notify.error(...arguments);
    }
    notifyFn.info = function() {
        return $notify.info(...arguments);
    }
    return notifyFn;
}

export const unexpectedErrorMessage: string = 'An unexpected error occurred. If this error persists, please <a href="https://github.com/opengraphica/opengraphica/issues/new" target="_blank">report an issue on Github</a>.';
export const validationSubmissionErrorMessage: string = 'Please correct the error messages shown in the form before submitting.';
