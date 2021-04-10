import { inject } from 'vue';
import { INotification, INotificationOptions, INotificationHandle } from 'element-plus/lib/el-notification/src/notification.type';

export function notifyInjector(injectName: string): INotification {
    const $notify = inject<INotification>(injectName) as INotification;
    return (options?: INotificationOptions): INotificationHandle => {
        const notificationHandle = $notify(options);
        const notifications = document.querySelectorAll('body > .el-notification');
        (document.querySelector('.opengraphica') as Element).appendChild(
            notifications[notifications.length - 1]
        );
        return notificationHandle;
    };
}

export const unexpectedErrorMessage: string = 'An unexpected error occurred. If this error persists, please <a href="https://github.com/opengraphica/opengraphica/issues/new" target="_blank">report an issue on Github</a>.';
export const validationSubmissionErrorMessage: string = 'Please correct the error messages shown in the form before submitting.';
