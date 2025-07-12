import { v4 as uuidv4 } from 'uuid';
import { BackendWorkerMessage } from '@/renderers/webgl2-offscreen/backend/backend.types';

import { messageBus } from '@/renderers/webgl2/backend/message-bus';

import type {
    Webgl2RendererBackendPublic, Webgl2RendererApplySelectionMaskToAlphaChannelOptions,
    Webgl2RendererBackendTakeSnapshotOptions, MeshControllerInterface,
} from '@/renderers/webgl2/backend';
import type {
    RendererBrushStrokeSettings, RendererBrushStrokePreviewsettings, RendererTextureTile,
    WorkingFileLayer, WorkingFileLayerMask,
} from '@/types';

export class Webgl2RendererBackendInterface implements Webgl2RendererBackendPublic {
    isOffscreen: boolean = true;

    backendWorker!: Worker;
    messageReceivedCallbacks = new Map<BackendWorkerMessage, Array<(arg?: any) => void>>();

    onRequestFrontendSvg!: (request: { sourceUuid: string, width: number, height: number }) => void;
    onRequestFrontendTexture!: (sourceUuid: string) => void;

    constructor() {
        this.backendWorker = new Worker(
            /* webpackChunkName: 'worker-webgl2-renderer-backend' */ new URL('../backend/backend.worker.ts', import.meta.url)
        );
        this.backendWorker.onmessage = ({ data }) => {
            switch (data.type) {
                case BackendWorkerMessage.LOG:
                    console.error(data.message);
                    break;
                case BackendWorkerMessage.REQUEST_FRONTEND_SVG:
                    this.onRequestFrontendSvg(data.request);
                    break;
                case BackendWorkerMessage.REQUEST_FRONTEND_TEXTURE:
                    this.onRequestFrontendTexture(data.sourceUuid);
                    break;
                default:
                    const callbacks = this.messageReceivedCallbacks.get(data.type);
                    if (callbacks && callbacks.length > 0) {
                        callbacks.shift()!(data);
                        this.messageReceivedCallbacks.set(data.type, callbacks);
                    }
            }
        };

        messageBus.on('frontend.replyFrontendSvg', (request) => {
            this.backendWorker.postMessage({
                type: BackendWorkerMessage.REQUEST_FRONTEND_SVG_RESULT,
                sourceUuid: request?.sourceUuid,
                bitmap: request?.bitmap,
            });
        });

        messageBus.on('frontend.replyFrontendTexture', (request) => {
            this.backendWorker.postMessage({
                type: BackendWorkerMessage.REQUEST_FRONTEND_TEXTURE_RESULT,
                sourceUuid: request?.sourceUuid,
                bitmap: request?.bitmap,
            });
        });
    }

    async createMeshController(controllerType: string): Promise<MeshControllerInterface> {
        const id = uuidv4();
        const backendWorker = this.backendWorker;
        const messageReceived = this.messageReceived.bind(this);

        const meshControllerInterface: MeshControllerInterface = {
            id,
            dispose() {
                backendWorker.postMessage({
                    type: BackendWorkerMessage.DISPOSE_MESH_CONTROLLER,
                    id,
                });
            }
        };

        async function forwardControllerMethod(this: { prop: string | symbol }) {
            backendWorker.postMessage({
                type: BackendWorkerMessage.UPDATE_MESH_CONTROLLER,
                methodName: this.prop,
                id,
                arguments: [...arguments],
            });

            return (await messageReceived(BackendWorkerMessage.UPDATE_MESH_CONTROLLER_RESULT)).result;
        }

        const meshControllerInterfaceProxy = new Proxy(meshControllerInterface, {
            get(target, prop, receiver) {
                if (prop === 'id' || prop === 'dispose' || prop === 'then' || prop === 'catch') {
                    return Reflect.get(target, prop, receiver);
                }
                return forwardControllerMethod.bind({ prop });
            }
        });

        this.backendWorker.postMessage({
            type: BackendWorkerMessage.CREATE_MESH_CONTROLLER,
            controllerType,
            id,
        });

        await messageReceived(BackendWorkerMessage.CREATE_MESH_CONTROLLER_RESULT);

        return meshControllerInterfaceProxy;
    }

    messageReceived(type: BackendWorkerMessage): Promise<any> {
        return new Promise((resolve) => {
            const callbacks = this.messageReceivedCallbacks.get(type) ?? [];
            callbacks.push(resolve);
            this.messageReceivedCallbacks.set(type, callbacks);
        });
    }

    async initialize(canvas: HTMLCanvasElement | OffscreenCanvas, imageWidth: number, imageHeight: number, viewWidth: number, viewHeight: number) {
        if (canvas instanceof HTMLCanvasElement) {
            canvas = canvas.transferControlToOffscreen();
        }

        this.backendWorker.postMessage({
            type: BackendWorkerMessage.INITIALIZE,
            canvas,
            imageWidth,
            imageHeight,
            viewWidth,
            viewHeight
        }, [canvas]);

        await this.messageReceived(BackendWorkerMessage.INITIALIZE_RESULT);
    }

    async resize(imageWidth: number, imageHeight: number, viewWidth: number, viewHeight: number) {
        this.backendWorker.postMessage({
            type: BackendWorkerMessage.RESIZE,
            imageWidth,
            imageHeight,
            viewWidth,
            viewHeight
        });

        await this.messageReceived(BackendWorkerMessage.RESIZE_RESULT);
    }

    async enableImageBoundaryMask(enabled: boolean) {
        this.backendWorker.postMessage({
            type: BackendWorkerMessage.ENABLE_IMAGE_BOUNDARY_MASK,
            enabled,
        });

        await this.messageReceived(BackendWorkerMessage.ENABLE_IMAGE_BOUNDARY_MASK_RESULT);
    }

    async setBackgroundColor(r: number, g: number, b: number, alpha: number) {
        this.backendWorker.postMessage({
            type: BackendWorkerMessage.SET_BACKGROUND_COLOR,
            r, g, b, alpha,
        });

        await this.messageReceived(BackendWorkerMessage.SET_BACKGROUND_COLOR_RESULT);
    }

    async setMasks(masks: Record<number, WorkingFileLayerMask>) {
        this.backendWorker.postMessage({
            type: BackendWorkerMessage.SET_MASKS,
            masks,
        });

        await this.messageReceived(BackendWorkerMessage.SET_MASKS_RESULT);
    }

    async setSelectionMask(image?: ImageBitmap, offset?: { x: number, y: number }) {
        this.backendWorker.postMessage({
            type: BackendWorkerMessage.SET_SELECTION_MASK,
            image, offset,
        }, image ? [image] : undefined);

        await this.messageReceived(BackendWorkerMessage.SET_SELECTION_MASK_RESULT);
    }

    async setViewTransform(transform: Float64Array) {
        this.backendWorker.postMessage({
            type: BackendWorkerMessage.SET_VIEW_TRANSFORM,
            transform,
        }, [transform.buffer]);

        await this.messageReceived(BackendWorkerMessage.SET_VIEW_TRANSFORM_RESULT);
    }

    async setLayerOrder(layerOrder: WorkingFileLayer[]) {
        this.backendWorker.postMessage({
            type: BackendWorkerMessage.SET_LAYER_ORDER,
            layerOrder,
        });

        await this.messageReceived(BackendWorkerMessage.SET_LAYER_ORDER_RESULT);
    }

    async queueCreateLayerPasses() {
        this.backendWorker.postMessage({
            type: BackendWorkerMessage.QUEUE_CREATE_LAYER_PASSES,
        });

        await this.messageReceived(BackendWorkerMessage.QUEUE_CREATE_LAYER_PASSES_RESULT);
    }

    async applySelectionMaskToAlphaChannel(layerId: number, options?: Webgl2RendererApplySelectionMaskToAlphaChannelOptions): Promise<RendererTextureTile[]> {
        this.backendWorker.postMessage({
            type: BackendWorkerMessage.APPLY_SELECTION_MASK_TO_ALPHA_CHANNEL,
            layerId, options,
        });

        return (await this.messageReceived(BackendWorkerMessage.APPLY_SELECTION_MASK_TO_ALPHA_CHANNEL_RESULT)).tiles;
    }

    async takeSnapshot(imageWidth: number, imageHeight: number, options?: Webgl2RendererBackendTakeSnapshotOptions): Promise<ImageBitmap> {
        this.backendWorker.postMessage({
            type: BackendWorkerMessage.TAKE_SNAPSHOT,
            imageWidth, imageHeight, options,
        });

        return (await this.messageReceived(BackendWorkerMessage.TAKE_SNAPSHOT_RESULT)).bitmap;
    }

    async startBrushStroke(settings: RendererBrushStrokeSettings) {
        this.backendWorker.postMessage({
            type: BackendWorkerMessage.START_BRUSH_STROKE,
            settings,
        });

        await this.messageReceived(BackendWorkerMessage.START_BRUSH_STROKE_RESULT);
    }

    async moveBrushStroke(layerId: number, x: number, y: number, size: number, density: number, colorBlendingStrength: number, concentration: number) {
        // TODO - transfer? avoid using memory somehow?
        this.backendWorker.postMessage({
            type: BackendWorkerMessage.MOVE_BRUSH_STROKE,
            layerId, x, y, size, density, colorBlendingStrength, concentration,
        });

        await this.messageReceived(BackendWorkerMessage.MOVE_BRUSH_STROKE_RESULT);
    }

    async stopBrushStroke(layerId: number): Promise<RendererTextureTile[]> {
        this.backendWorker.postMessage({
            type: BackendWorkerMessage.STOP_BRUSH_STROKE,
            layerId,
        });

        return (await this.messageReceived(BackendWorkerMessage.STOP_BRUSH_STROKE_RESULT)).tiles;
    }

    async createBrushPreview(settings: RendererBrushStrokePreviewsettings): Promise<ImageBitmap> {
        this.backendWorker.postMessage({
            type: BackendWorkerMessage.CREATE_BRUSH_PREVIEW,
            settings,
        });

        return (await this.messageReceived(BackendWorkerMessage.CREATE_BRUSH_PREVIEW_RESULT)).bitmap;
    }

    async setDirty() {
        this.backendWorker.postMessage({
            type: BackendWorkerMessage.SET_DIRTY,
        });
    }

    async dispose() {
        this.backendWorker.postMessage({
            type: BackendWorkerMessage.DISPOSE,
        });

        await this.messageReceived(BackendWorkerMessage.DISPOSE_RESULT);
    }

}
