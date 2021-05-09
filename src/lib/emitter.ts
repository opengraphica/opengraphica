import mitt, { Handler } from 'mitt';
import { INotificationOptions } from 'element-plus/lib/el-notification/src/notification.type';

interface AppEmitterEvents {
    'app.canvas.resetTransform': undefined | {
        margin?: number;
    };
    'app.component.register': any;
    'app.dialogs.openFromDock': {
        name: string;
    };
    'app.dialogs.openFromModule': {
        name: string;
    };
    'app.notify': INotificationOptions;
    'app.wait.startBlocking': {
        id: string;
        label?: string;
    };
    'app.wait.stopBlocking': {
        id: string;
    };
    'editor.history.step': undefined;
}

const emitter = mitt();

class ProtectedEmitter<T extends Object> {
    on<K extends keyof T>(type: K, handler: Handler<T[K]>): void;
    on(type: any, handler: any): void {
        return emitter.on(type, handler);
    }

    off<K extends keyof T>(type: K, handler: Handler<T[K]>): void;
    off(type: any, handler: any): void {
        return emitter.off(type, handler);
    }

    emit<K extends keyof T>(type: K, event?: T[K]): void;
    emit(type: any, event?: any) {
        return emitter.emit(type, event);
    }
}

const appEmitter = new ProtectedEmitter<AppEmitterEvents>();

export default appEmitter;

export { AppEmitterEvents };