import mitt, { type Handler } from 'mitt';
import type { Texture } from 'three';

export interface MessageBusEvents {
    'backend.requestFrontendSvg': {
        sourceUuid: string;
        requestId: number;
        width: number;
        height: number;
    };
    'backend.requestFrontendTexture': {
        sourceUuid: string;
        requestId: number;
    };
    'backend.requestFrontendVideoFrame': {
        sourceUuid: string;
        requestId: number;
    };
    'frontend.replyFrontendSvg': {
        sourceUuid: string;
        requestId: number;
        bitmap: ImageBitmap | undefined;
    };
    'frontend.replyFrontendTexture': {
        sourceUuid: string;
        requestId: number;
        bitmap: ImageBitmap | undefined;
    };
    'frontend.replyFrontendVideoFrame': {
        sourceUuid: string;
        requestId: number;
        bitmap: ImageBitmap | undefined;
    };
    'layer.regenerateThumbnail': number;
    'layer.text.notifySizeUpdate': {
        id: number;
        width: number;
        height: number;
    };
    'renderer.pass.readBufferTextureUpdate': Texture;
    'renderer.renderComplete': void;
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

export const messageBus = new ProtectedEmitter<MessageBusEvents>();
export type { ProtectedEmitter };
