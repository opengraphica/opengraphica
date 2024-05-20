import mitt, { Handler } from 'mitt';
import { NotificationProps, NotificationHandle } from 'element-plus/lib/components/notification/src/notification.d';
import { CanvasViewResetOptions, ModuleDefinition } from '@/types';

interface AppEmitterEvents {
    'app.canvas.calculateDndArea': undefined;
    'app.canvas.resetTransform': undefined | CanvasViewResetOptions;
    'app.canvas.ready': undefined;
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
    'app.runModule': {
        action?: ModuleDefinition['action'];
        groupName?: string;
        moduleName?: string;
        props?: any;
        onSuccess?: (event?: any) => void;
        onError?: (error?: any) => void;
    },
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
    'editor.history.startBlocking': {
        trigger: 'do' | 'undo' | 'redo';
        actions: Array<{
            id: string;
            description: string;
        }>;
    };
    'editor.history.stopBlocking': undefined;
    'editor.history.step': {
        trigger: 'do' | 'undo' | 'redo';
        action: {
            id: string;
            description: string;
        }
    };
    'editor.tool.cancelCurrentAction': undefined;
    'editor.tool.commitCurrentAction': undefined;
    'editor.tool.delete': undefined;
    'editor.tool.selectAll': undefined;
    'store.setPreference': {
        key: string;
        value: any;
    };
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