import { inject } from 'vue';
import { INotification, INotificationOptions, INotificationHandle } from 'element-plus/lib/el-notification/src/notification.type';

function notifyInjector(injectName: string): INotification {
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

export { notifyInjector };