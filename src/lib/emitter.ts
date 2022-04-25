import mitt, { Handler } from 'mitt';
import { NotificationProps, NotificationHandle } from 'element-plus/lib/components/notification/src/notification.d';
import { CanvasViewResetOptions } from '@/types';

interface AppEmitterEvents {
    'app.canvas.calculateDndArea': undefined;
    'app.canvas.resetTransform': undefined | CanvasViewResetOptions;
    'app.component.register': any;
    'app.dialogs.openFromDock': {
        name: string;
        props?: any;
        onClose?: (event?: any) => void;
    };
    'app.dialogs.openFromModule': {
        name: string;
        props?: any;
        onClose?: (event?: any) => void;
    };
    'app.menuDrawer.closeAll': undefined;
    'app.menuDrawer.openFromDock': {
        name: string;
        placement: 'top' | 'bottom' | 'left' | 'right';
        immediate?: boolean;
    },
    'app.menuDrawer.openFromModule': {
        name: string;
        placement: 'top' | 'bottom' | 'left' | 'right';
        immediate?: boolean;
    },
    'app.notify': Partial<NotificationProps> & { onCreated?: (handle: NotificationHandle) => void; };
    'app.wait.startBlocking': {
        id: string;
        label?: string;
        cancelable?: boolean;
        immediate?: boolean;
    };
    'app.wait.cancelBlocking': {
        id: string;
    };
    'app.wait.stopBlocking': {
        id: string;
    };
    'app.workingFile.notifyImageLoadedFromClipboard': undefined;
    'app.workingFile.notifyImageLoadedFromDragAndDrop': undefined;
    'editor.history.step': {
        trigger: 'do' | 'undo' | 'redo';
        action: {
            id: string;
        }
    };
    'editor.tool.cancelCurrentAction': undefined;
    'editor.tool.commitCurrentAction': undefined;
    'editor.tool.selectAll': undefined;
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