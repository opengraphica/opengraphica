import { toRefs, watch, type WatchStopHandle } from 'vue';

import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import workingFileStore from '@/store/working-file';
import { getStoredImageAsBitmap } from '@/store/image';

import appEmitter from '@/lib/emitter';
import { colorToRgba, getColorModelName } from '@/lib/color';

import { messageBus } from '@/renderers/webgl2/backend/message-bus';

import type { Webgl2RendererBackend } from '@/renderers/webgl2/backend';
import type {
    ClassType, RendererFrontend, RendererFrontendTakeSnapshotOptions,
    RendererLayerWatcher, WorkingFileAnyLayer
} from '@/types';

export class Webgl2RenderFrontend implements RendererFrontend {
    rendererBackend: Webgl2RendererBackend | undefined;

    stopWatchBackgroundColor: WatchStopHandle | undefined;
    stopWatchShowBoundary: WatchStopHandle | undefined;
    stopWatchSize: WatchStopHandle | undefined;
    stopWatchViewTransform: WatchStopHandle | undefined;

    layerWatchersByType: Record<string, ClassType<RendererLayerWatcher>> = {};
    layerWatchersById: Map<number, RendererLayerWatcher> = new Map();

    async initialize(canvas: HTMLCanvasElement | OffscreenCanvas) {
        const { getWebgl2RendererBackend } = await import('@/renderers/webgl2/backend');
        this.rendererBackend = getWebgl2RendererBackend();

        this.layerWatchersByType['raster'] = (await import('@/renderers/webgl2/layers/raster/watcher')).RasterLayerWatcher;

        const { viewWidth, viewHeight } = toRefs(canvasStore.state);
        const { width: imageWidth, height: imageHeight } = toRefs(workingFileStore.state);

        await this.rendererBackend.initialize(canvas, imageWidth.value, imageHeight.value, viewWidth.value, viewHeight.value);

        this.stopWatchSize = watch(() => [
            imageWidth.value,
            imageHeight.value,
            viewWidth.value,
            viewHeight.value,
        ] as const, async ([imageWidth, imageHeight, viewWidth, viewHeight]) => {
            this.rendererBackend?.resize(
                imageWidth,
                imageHeight,
                viewWidth,
                viewHeight,
            );
        });

        this.stopWatchShowBoundary = watch(() => canvasStore.state.showAreaOutsideWorkingFile, (showAreaOutsideWorkingFile) => {
            this.rendererBackend?.enableImageBoundaryMask(!showAreaOutsideWorkingFile);
        }, { immediate: true });

        this.stopWatchBackgroundColor = watch(() => [
            workingFileStore.state.background.color,
            workingFileStore.state.background.visible,
        ] as const, ([color, visible]) => {
            let { r, g, b, alpha } = colorToRgba(color, getColorModelName(color));
            if (!visible) alpha = 0;
            this.rendererBackend?.setBackgroundColor(r, g, b, alpha);
        }, { immediate: true });

        this.onTextureRequest = this.onTextureRequest.bind(this);
        messageBus.on('backend.requestFrontendTexture', this.onTextureRequest);

        this.onLayerAttached = this.onLayerAttached.bind(this);
        appEmitter.on('app.workingFile.layerAttached', this.onLayerAttached);

        this.onLayerReordered = this.onLayerReordered.bind(this);
        appEmitter.on('app.workingFile.layerReordered', this.onLayerReordered);

        this.onLayerDetached = this.onLayerDetached.bind(this);
        appEmitter.on('app.workingFile.layerDetached', this.onLayerDetached);

        this.onDetachAllLayers = this.onDetachAllLayers.bind(this);
        appEmitter.on('app.workingFile.detachAllLayers', this.onDetachAllLayers);

        this.onLayerOrderCalculated = this.onLayerOrderCalculated.bind(this);
        appEmitter.on('app.workingFile.layerOrderCalculated', this.onLayerOrderCalculated);

        const renderLoop = () => {
            if (!this.rendererBackend) return;
            const isViewDirty = canvasStore.get('viewDirty');
            const isPlayingAnimation = canvasStore.get('playingAnimation');

            if (isViewDirty) {
                canvasStore.set('viewDirty', false);
                const transform = canvasStore.get('transform');
                this.rendererBackend?.setViewTransform(
                    new Float64Array([
                        transform.m11, transform.m21, transform.m31, transform.m41,
                        transform.m12, transform.m22, transform.m32, transform.m42,
                        transform.m13, transform.m23, transform.m33, transform.m43,
                        transform.m14, transform.m24, transform.m34, transform.m44,
                    ])
                );
            }

            if (isPlayingAnimation) {
                this.rendererBackend.dirty = true;
                const now = performance.now();
                const { timelinePlayStartTime, timelineStart, timelineEnd } = editorStore.state;
                const timelineRange = timelineEnd - timelineStart;
                const cursor = ((now - timelinePlayStartTime) % timelineRange) + timelineStart;
                editorStore.dispatch('setTimelineCursor', cursor);
            }

            if (this.rendererBackend.dirty) {
                canvasStore.set('dirty', false);
                this.rendererBackend.render();
            }
            requestAnimationFrame(renderLoop);
        };
        requestAnimationFrame(renderLoop);
    }

    async onTextureRequest(sourceUuid?: string) {
        if (!sourceUuid) {
            return;
        }
        messageBus.emit('frontend.replyFrontendTexture', {
            sourceUuid,
            texture: await getStoredImageAsBitmap(sourceUuid, { imageOrientation: 'flipY' }) ?? undefined,
        });
    }

    onLayerAttached(layer?: WorkingFileAnyLayer) {
        if (!layer) return;
        const LayerWatcher = this.layerWatchersByType[layer.type];
        if (!LayerWatcher) return;
        const layerWatcher = new LayerWatcher();
        this.layerWatchersById.set(layer.id, layerWatcher);
        layerWatcher.attach(layer);
    }

    onLayerReordered(options?: { layer: WorkingFileAnyLayer, order: number }) {
        if (!options) return;
        const { layer, order } = options;
        if (!layer || order == null) return;
        const existingLayerWatcher = this.layerWatchersById.get(layer.id);
        if (!existingLayerWatcher) return;
        existingLayerWatcher.reorder(order);
    }

    onLayerDetached(layer?: WorkingFileAnyLayer) {
        if (!layer) return;
        const existingLayerWatcher = this.layerWatchersById.get(layer.id);
        if (!existingLayerWatcher) return;
        existingLayerWatcher.detach();
        this.layerWatchersById.delete(layer.id);
    }

    onDetachAllLayers() {
        for (const key of this.layerWatchersById.keys()) {
            const layerWatcher = this.layerWatchersById.get(key);
            if (!layerWatcher) continue;
            layerWatcher.detach();
        }
        this.layerWatchersById.clear();
    }

    onLayerOrderCalculated() {
        // TODO - only pass necessary data for each layer (id, type, blendingMode, layers).
        this.rendererBackend?.setLayerOrder(
            workingFileStore.get('layers')
        );
    }

    async resize(imageWidth: number, imageHeight: number, viewWidth: number, viewHeight: number) {
        await this.rendererBackend?.resize(imageWidth, imageHeight, viewWidth, viewHeight);
    }

    async takeSnapshot(imageWidth: number, imageHeight: number, options?: RendererFrontendTakeSnapshotOptions): Promise<ImageBitmap> {
        if (!this.rendererBackend) throw Error('Renderer backend not initialized.');
        const cameraTransform = options?.cameraTransform
            ? new Float64Array([
                options.cameraTransform.m11, options.cameraTransform.m12, options.cameraTransform.m13, options.cameraTransform.m14,
                options.cameraTransform.m21, options.cameraTransform.m22, options.cameraTransform.m23, options.cameraTransform.m24,
                options.cameraTransform.m31, options.cameraTransform.m32, options.cameraTransform.m33, options.cameraTransform.m34,
                options.cameraTransform.m41, options.cameraTransform.m42, options.cameraTransform.m43, options.cameraTransform.m44,
            ])
            : undefined;
        return this.rendererBackend.takeSnapshot(imageWidth, imageHeight, {
            cameraTransform,
            layerIds: options?.layerIds,
        });
    }

    async dispose() {
        this.rendererBackend?.dispose();
        this.rendererBackend = undefined;

        for (const key of this.layerWatchersById.keys()) {
            const layerWatcher = this.layerWatchersById.get(key);
            if (!layerWatcher) continue;
            layerWatcher.detach();
        }
        this.layerWatchersById.clear();

        appEmitter.off('app.workingFile.layerAttached', this.onLayerAttached);
        appEmitter.off('app.workingFile.layerReordered', this.onLayerReordered);
        appEmitter.off('app.workingFile.layerDetached', this.onLayerDetached);
        appEmitter.off('app.workingFile.detachAllLayers', this.onDetachAllLayers);
        appEmitter.off('app.workingFile.layerOrderCalculated', this.onLayerOrderCalculated);

        this.stopWatchBackgroundColor?.();
        this.stopWatchShowBoundary?.();
        this.stopWatchSize?.();
        this.stopWatchViewTransform?.();
    }
}
