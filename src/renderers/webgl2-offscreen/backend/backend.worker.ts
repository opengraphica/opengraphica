import { getWebgl2RendererBackend } from '@/renderers/webgl2/backend';

import { messageBus } from '@/renderers/webgl2/backend/message-bus';

import { BackendWorkerMessage } from '@/renderers/webgl2-offscreen/backend/backend.types';

import { GradientLayerMeshController } from '@/renderers/webgl2/layers/gradient/mesh-controller';
// import { GroupLayerMeshController } from '@/renderers/webgl2/layers/group/mesh-controller';
import { RasterLayerMeshController } from '@/renderers/webgl2/layers/raster/mesh-controller';
import { RasterSequenceLayerMeshController } from '@/renderers/webgl2/layers/raster-sequence/mesh-controller';
import { TextLayerMeshController } from '@/renderers/webgl2/layers/text/mesh-controller';
import { VectorLayerMeshController } from '@/renderers/webgl2/layers/vector/mesh-controller';
import { VideoLayerMeshController } from '@/renderers/webgl2/layers/video/mesh-controller';

const rendererBackend = getWebgl2RendererBackend();

let timelineCursor = 0;

function logError(error: any) {
    self.postMessage({
        type: BackendWorkerMessage.LOG,
        message: `${error}, ${error?.stack}`,
    });
}

const meshControllers = new Map<string, any>();
const meshControllerClassesByType = {
    gradient: GradientLayerMeshController,
    raster: RasterLayerMeshController,
    rasterSequence: RasterSequenceLayerMeshController,
    text: TextLayerMeshController,
    vector: VectorLayerMeshController,
    video: VideoLayerMeshController,
}

self.onmessage = ({ data }) => {
    switch (data.type) {
        case BackendWorkerMessage.INITIALIZE:
            rendererBackend.initialize(data.canvas, data.imageWidth, data.imageHeight, data.viewWidth, data.viewHeight).then(() => {
                self.postMessage({
                    type: BackendWorkerMessage.INITIALIZE_RESULT,
                });
            }).catch(logError);
            break;
        case BackendWorkerMessage.RESIZE:
            rendererBackend.resize(data.imageWidth, data.imageHeight, data.viewWidth, data.viewHeight).then(() => {
                self.postMessage({
                    type: BackendWorkerMessage.RESIZE_RESULT,
                });
            }).catch(logError);
            break;
        case BackendWorkerMessage.ENABLE_IMAGE_BOUNDARY_MASK:
            rendererBackend.enableImageBoundaryMask(data.enabled).then(() => {
                self.postMessage({
                    type: BackendWorkerMessage.ENABLE_IMAGE_BOUNDARY_MASK_RESULT,
                });
            }).catch(logError);
            break;
        case BackendWorkerMessage.SET_BACKGROUND_COLOR:
            rendererBackend.setBackgroundColor(data.r, data.g, data.b, data.alpha).then(() => {
                self.postMessage({
                    type: BackendWorkerMessage.SET_BACKGROUND_COLOR_RESULT,
                });
            }).catch(logError);
            break;
        case BackendWorkerMessage.SET_MASKS:
            rendererBackend.setMasks(data.masks).then(() => {
                self.postMessage({
                    type: BackendWorkerMessage.SET_MASKS_RESULT,
                });
            }).catch(logError);
            break;
        case BackendWorkerMessage.SET_SELECTION_MASK:
            rendererBackend.setSelectionMask(data.image, data.offset).then(() => {
                self.postMessage({
                    type: BackendWorkerMessage.SET_SELECTION_MASK_RESULT,
                });
            }).catch(logError);
            break;
        case BackendWorkerMessage.SET_VIEW_TRANSFORM:
            rendererBackend.setViewTransform(data.transform).then(() => {
                self.postMessage({
                    type: BackendWorkerMessage.SET_VIEW_TRANSFORM_RESULT,
                });
            }).catch(logError);
            break;
        case BackendWorkerMessage.SET_LAYER_ORDER:
            rendererBackend.setLayerOrder(data.layerOrder).then(() => {
                self.postMessage({
                    type: BackendWorkerMessage.SET_LAYER_ORDER_RESULT,
                });
            }).catch(logError);
            break;
        case BackendWorkerMessage.QUEUE_CREATE_LAYER_PASSES:
            rendererBackend.queueCreateLayerPasses().then(() => {
                self.postMessage({
                    type: BackendWorkerMessage.QUEUE_CREATE_LAYER_PASSES_RESULT,
                });
            }).catch(logError);
            break;
        case BackendWorkerMessage.APPLY_SELECTION_MASK_TO_ALPHA_CHANNEL:
            rendererBackend.applySelectionMaskToAlphaChannel(data.layerId, data.options).then((tiles) => {
                const transferables = tiles.reduce((accumulator, item) => {
                    accumulator.push(item.image);
                    if (item.oldImage) {
                        accumulator.push(item.oldImage);
                    }
                    return accumulator;
                }, [] as Transferable[]);
                self.postMessage({
                    type: BackendWorkerMessage.APPLY_SELECTION_MASK_TO_ALPHA_CHANNEL_RESULT,
                    tiles,
                }, transferables);
            }).catch(logError);
            break;
        case BackendWorkerMessage.TAKE_SNAPSHOT:
            rendererBackend.takeSnapshot(data.imageWidth, data.imageHeight, data.options).then((bitmap) => {
                self.postMessage({
                    type: BackendWorkerMessage.TAKE_SNAPSHOT_RESULT,
                    bitmap,
                }, [bitmap]);
            }).catch(logError);
            break;
        case BackendWorkerMessage.START_BRUSH_STROKE:
            rendererBackend.startBrushStroke(data.settings).then(() => {
                self.postMessage({
                    type: BackendWorkerMessage.START_BRUSH_STROKE_RESULT,
                });
            }).catch(logError);
            break;
        case BackendWorkerMessage.MOVE_BRUSH_STROKE:
            rendererBackend.moveBrushStroke(data.layerId, data.x, data.y, data.size, data.density, data.colorBlendingStrength, data.concentration).then(() => {
                self.postMessage({
                    type: BackendWorkerMessage.MOVE_BRUSH_STROKE_RESULT,
                });
            }).catch(logError);
            break;
        case BackendWorkerMessage.STOP_BRUSH_STROKE:
            rendererBackend.stopBrushStroke(data.layerId).then((tiles) => {
                const transferables = tiles.reduce((accumulator, item) => {
                    accumulator.push(item.image);
                    if (item.oldImage) {
                        accumulator.push(item.oldImage);
                    }
                    return accumulator;
                }, [] as Transferable[]);
                self.postMessage({
                    type: BackendWorkerMessage.STOP_BRUSH_STROKE_RESULT,
                    tiles,
                }, transferables);
            }).catch(logError);
            break;
        case BackendWorkerMessage.CREATE_BRUSH_PREVIEW:
            rendererBackend.createBrushPreview(data.settings).then((bitmap) => {
                self.postMessage({
                    type: BackendWorkerMessage.CREATE_BRUSH_PREVIEW_RESULT,
                    bitmap,
                }, [bitmap]);
            }).catch(logError);
            break;
        case BackendWorkerMessage.SET_DIRTY:
            rendererBackend.setDirty();
            break;
        case BackendWorkerMessage.DISPOSE:
            rendererBackend.dispose().then(() => {
                self.postMessage({
                    type: BackendWorkerMessage.DISPOSE_RESULT,
                });
            }).catch(logError);
            break;
        case BackendWorkerMessage.REQUEST_FRONTEND_SVG_RESULT:
            messageBus.emit('frontend.replyFrontendSvg', {
                sourceUuid: data.sourceUuid,
                bitmap: data.bitmap,
            });
            break;
        case BackendWorkerMessage.REQUEST_FRONTEND_TEXTURE_RESULT:
            messageBus.emit('frontend.replyFrontendTexture', {
                sourceUuid: data.sourceUuid,
                bitmap: data.bitmap,
            });
            break;
        case BackendWorkerMessage.CREATE_MESH_CONTROLLER:
            meshControllers.set(data.id, new meshControllerClassesByType[data.controllerType]());
            self.postMessage({
                type: BackendWorkerMessage.CREATE_MESH_CONTROLLER_RESULT,
            });
            break;
        case BackendWorkerMessage.UPDATE_MESH_CONTROLLER:
            const meshController = meshControllers.get(data.id);
            let result = meshController[data.methodName].apply(meshController, data.arguments);
            if (result?.then) {
                result.then((result) => {
                    self.postMessage({
                        type: BackendWorkerMessage.UPDATE_MESH_CONTROLLER_RESULT,
                        result,
                    });
                });
            } else {
                self.postMessage({
                    type: BackendWorkerMessage.UPDATE_MESH_CONTROLLER_RESULT,
                    result,
                });
            }
            break;
        case BackendWorkerMessage.DISPOSE_MESH_CONTROLLER:
            meshControllers.get(data.id).dispose();
            meshControllers.delete(data.id);
            self.postMessage({
                type: BackendWorkerMessage.DISPOSE_MESH_CONTROLLER_RESULT,
            });
            break;
    }
};

messageBus.on('backend.requestFrontendSvg', (request) => {
    self.postMessage({
        type: BackendWorkerMessage.REQUEST_FRONTEND_SVG,
        request,
    });
});

messageBus.on('backend.requestFrontendTexture', (sourceUuid) => {
    self.postMessage({
        type: BackendWorkerMessage.REQUEST_FRONTEND_TEXTURE,
        sourceUuid,
    });
});

function renderLoop() {
    if (rendererBackend.dirty) {
        rendererBackend.render(timelineCursor);
    }

    requestAnimationFrame(renderLoop);
}
requestAnimationFrame(renderLoop);
