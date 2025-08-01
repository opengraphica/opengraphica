import { nextTick, toRefs, watch, type WatchStopHandle } from 'vue';

import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import workingFileStore, { getLayerById, regenerateLayerThumbnail } from '@/store/working-file';
import { getStoredImageAsBitmap } from '@/store/image';
import { getStoredSvgImage } from '@/store/svg';
import {
    activeSelectionMask, activeSelectionMaskCanvasOffset, appliedSelectionMask,
    appliedSelectionMaskCanvasOffset, selectedLayersSelectionMaskPreview,
    selectedLayersSelectionMaskPreviewCanvasOffset,
} from '@/canvas/store/selection-state';

import appEmitter, { type AppEmitterEvents } from '@/lib/emitter';
import { colorToHex, colorToRgba, getColorModelName } from '@/lib/color';
import { deepToRaw } from '@/lib/vue';

import { messageBus } from '@/renderers/webgl2/backend/message-bus';
import { VideoPlayer } from './video-player';

import type { Webgl2RendererBackend, Webgl2RendererBackendPublic } from '@/renderers/webgl2/backend';
import type {
    RGBAColor,
    ClassType, RendererFrontend, RendererFrontendTakeSnapshotOptions,
    RendererBrushStrokeSettings, RendererBrushStrokePreviewsettings,
    RendererFrontendApplySelectionMaskToAlphaChannelOptions,
    RendererLayerWatcher, RendererTextureTile, WorkingFileAnyLayer
} from '@/types';

export class Webgl2RenderFrontend implements RendererFrontend {
    rendererBackend: Webgl2RendererBackendPublic;
    videoPlayer: VideoPlayer | undefined;

    stopWatchBackgroundColor: WatchStopHandle | undefined;
    stopWatchMasks: WatchStopHandle | undefined;
    stopWatchShowBoundary: WatchStopHandle | undefined;
    stopWatchSize: WatchStopHandle | undefined;
    stopWatchSelectionMask: WatchStopHandle | undefined;
    stopWatchViewTransform: WatchStopHandle | undefined;

    layerWatchersByType: Record<string, ClassType<RendererLayerWatcher>> = {};
    layerWatchersById: Map<number, RendererLayerWatcher> = new Map();

    constructor(backend: Webgl2RendererBackendPublic) {
        this.rendererBackend = backend;
    }

    async initialize(canvas: HTMLCanvasElement | OffscreenCanvas) {
        this.videoPlayer = new VideoPlayer();

        this.layerWatchersByType['gradient'] = (await import('@/renderers/webgl2/layers/gradient/watcher')).GradientLayerWatcher;
        this.layerWatchersByType['raster'] = (await import('@/renderers/webgl2/layers/raster/watcher')).RasterLayerWatcher;
        this.layerWatchersByType['rasterSequence'] = (await import('@/renderers/webgl2/layers/raster-sequence/watcher')).RasterSequenceLayerWatcher;
        this.layerWatchersByType['text'] = (await import('@/renderers/webgl2/layers/text/watcher')).TextLayerWatcher;
        this.layerWatchersByType['vector'] = (await import('@/renderers/webgl2/layers/vector/watcher')).VectorLayerWatcher;
        this.layerWatchersByType['video'] = (await import('@/renderers/webgl2/layers/video/watcher')).VideoLayerWatcher;

        const { viewWidth, viewHeight } = toRefs(canvasStore.state);
        const { width: imageWidth, height: imageHeight } = toRefs(workingFileStore.state);

        await this.rendererBackend.initialize(canvas, imageWidth.value, imageHeight.value, viewWidth.value, viewHeight.value);

        this.stopWatchSize = watch(() => [
            imageWidth.value,
            imageHeight.value,
            viewWidth.value,
            viewHeight.value,
        ] as const, async ([imageWidth, imageHeight, viewWidth, viewHeight]) => {
            this.rendererBackend.resize(
                imageWidth,
                imageHeight,
                viewWidth,
                viewHeight,
            );
        });

        this.stopWatchMasks = watch(() => workingFileStore.state.masks, (masks) => {
            this.rendererBackend.setMasks(deepToRaw(masks));
        }, { deep: true });

        this.stopWatchShowBoundary = watch(() => canvasStore.state.showAreaOutsideWorkingFile, (showAreaOutsideWorkingFile) => {
            this.rendererBackend.enableImageBoundaryMask(!showAreaOutsideWorkingFile);
        }, { immediate: true });

        this.stopWatchSelectionMask = watch([
            activeSelectionMask, activeSelectionMaskCanvasOffset,
            appliedSelectionMask, appliedSelectionMaskCanvasOffset,
            selectedLayersSelectionMaskPreview, selectedLayersSelectionMaskPreviewCanvasOffset,
        ], async (
            [newActiveSelectionMask, newActiveSelectionMaskCanvasOffset, newAppliedSelectionMask, newAppliedSelectionMaskCanvasOffset,
            newSelectedLayersSelectionMaskPreview, newSelectedLayersSelectionMaskPreviewCanvasOffset],
        ) => {
            const newSelectionMask = newActiveSelectionMask ?? newAppliedSelectionMask ?? newSelectedLayersSelectionMaskPreview;
            const newCanvasOffset = newActiveSelectionMask ? newActiveSelectionMaskCanvasOffset : (newAppliedSelectionMask ? newAppliedSelectionMaskCanvasOffset : newSelectedLayersSelectionMaskPreviewCanvasOffset);
            if (newSelectionMask) {
                this.rendererBackend.setSelectionMask(
                    await createImageBitmap(newSelectionMask, { imageOrientation: 'flipY' }),
                    { x: newCanvasOffset.x, y: newCanvasOffset.y },
                );
            } else {
                this.rendererBackend.setSelectionMask(undefined);
            }
        });

        this.stopWatchBackgroundColor = watch(() => [
            workingFileStore.state.background.color,
            workingFileStore.state.background.visible,
        ] as const, ([color, visible]) => {
            let { r, g, b, alpha } = colorToRgba(color, getColorModelName(color));
            if (!visible) alpha = 0;
            this.rendererBackend.setBackgroundColor(r, g, b, alpha);
        }, { immediate: true });

        this.onSvgRequest = this.onSvgRequest.bind(this);
        this.onTextureRequest = this.onTextureRequest.bind(this);
        if (this.rendererBackend.isOffscreen) {
            this.rendererBackend.onRequestFrontendSvg = this.onSvgRequest;
            this.rendererBackend.onRequestFrontendTexture = this.onTextureRequest;
        } else {
            messageBus.on('backend.requestFrontendSvg', this.onSvgRequest);
            messageBus.on('backend.requestFrontendTexture', this.onTextureRequest);
        }

        this.onRegenerateThumbnail = this.onRegenerateThumbnail.bind(this);
        messageBus.on('layer.regenerateThumbnail', this.onRegenerateThumbnail);

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

        this.onEditorHistoryStep = this.onEditorHistoryStep.bind(this);
        appEmitter.on('editor.history.step', this.onEditorHistoryStep);

        let viewDirtyTrail = false;
        const setViewDirtyTrail = () => {
            viewDirtyTrail = true;
        };

        let timelineCursor = 0;
        const renderLoop = this.rendererBackend.isOffscreen
            ? () => {
                const isViewDirty = canvasStore.get('viewDirty');
                const isPlayingAnimation = canvasStore.get('playingAnimation');

                if (isViewDirty || viewDirtyTrail) {
                    viewDirtyTrail = false;
                    canvasStore.set('viewDirty', false);
                    const transform = canvasStore.get('transform');
                    this.rendererBackend.setViewTransform(
                        new Float64Array([
                            transform.m11, transform.m21, transform.m31, transform.m41,
                            transform.m12, transform.m22, transform.m32, transform.m42,
                            transform.m13, transform.m23, transform.m33, transform.m43,
                            transform.m14, transform.m24, transform.m34, transform.m44,
                        ])
                    );
                    if (isViewDirty) {
                        nextTick(setViewDirtyTrail);
                    }
                }

                if (isPlayingAnimation) {
                    this.rendererBackend.setDirty();
                    const now = performance.now();
                    const { timelinePlayStartTime, timelineStart, timelineEnd } = editorStore.state;
                    const timelineRange = timelineEnd - timelineStart;
                    timelineCursor = ((now - timelinePlayStartTime) % timelineRange) + timelineStart;
                    editorStore.dispatch('setTimelineCursor', timelineCursor);
                }

                // TODO - Remove this altogether? No longer used.
                canvasStore.set('dirty', false);

                requestAnimationFrame(renderLoop);
            }
            : () => {
                const isViewDirty = canvasStore.get('viewDirty');
                const isPlayingAnimation = canvasStore.get('playingAnimation');

                if (isViewDirty || viewDirtyTrail) {
                    viewDirtyTrail = false;
                    canvasStore.set('viewDirty', false);
                    const transform = canvasStore.get('transform');
                    this.rendererBackend.setViewTransform(
                        new Float64Array([
                            transform.m11, transform.m21, transform.m31, transform.m41,
                            transform.m12, transform.m22, transform.m32, transform.m42,
                            transform.m13, transform.m23, transform.m33, transform.m43,
                            transform.m14, transform.m24, transform.m34, transform.m44,
                        ])
                    );
                    if (isViewDirty) {
                        nextTick(setViewDirtyTrail);
                    }
                }

                if (isPlayingAnimation) {
                    this.rendererBackend.setDirty();
                    const now = performance.now();
                    const { timelinePlayStartTime, timelineStart, timelineEnd } = editorStore.state;
                    const timelineRange = timelineEnd - timelineStart;
                    timelineCursor = ((now - timelinePlayStartTime) % timelineRange) + timelineStart;
                    editorStore.dispatch('setTimelineCursor', timelineCursor);
                }

                if ((this.rendererBackend as Webgl2RendererBackend).dirty) {
                    canvasStore.set('dirty', false);
                    (this.rendererBackend as Webgl2RendererBackend).render(timelineCursor);
                }
                requestAnimationFrame(renderLoop);
            };
        requestAnimationFrame(renderLoop);
    }

    waitForRendererInitialized() {
        return new Promise<void>((resolve) => {
            let intervalHandle = setInterval(() => {
                if (this.rendererBackend) {
                    clearInterval(intervalHandle);
                    resolve();
                }
            }, 50);
        });
    }

    async onSvgRequest(request?: { sourceUuid: string, width: number, height: number }) {
        if (!request) return;
        const { sourceUuid, width, height } = request;
        let bitmap: ImageBitmap | undefined;
        const sourceImage = getStoredSvgImage(sourceUuid);
        if (sourceImage) {
            bitmap = await createImageBitmap(sourceImage, {
                resizeWidth: width,
                resizeHeight: height,
                resizeQuality: 'high',
                imageOrientation: 'flipY',
            });
        }
        messageBus.emit('frontend.replyFrontendSvg', {
            sourceUuid,
            bitmap,
        });
    }

    async onTextureRequest(sourceUuid?: string) {
        if (!sourceUuid) return;
        messageBus.emit('frontend.replyFrontendTexture', {
            sourceUuid,
            bitmap: await getStoredImageAsBitmap(sourceUuid, {
                imageOrientation: 'flipY',
            }) ?? undefined,
        });
    }

    onRegenerateThumbnail(event?: number) {
        if (event == null) return;
        const layer = getLayerById(event);
        if (!layer) return;
        regenerateLayerThumbnail(layer);
    }

    onLayerAttached(layer?: WorkingFileAnyLayer) {
        if (!layer) return;
        const LayerWatcher = this.layerWatchersByType[layer.type];
        if (!LayerWatcher) return;
        const layerWatcher = new LayerWatcher(this.rendererBackend);
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
        this.rendererBackend.setLayerOrder(
            deepToRaw(workingFileStore.get('layers'))
        );
    }

    onEditorHistoryStep(event?: AppEmitterEvents['editor.history.step']) {
        if (!event) return;
        if (event.action.id === 'updateLayerBlendingMode') {
            this.rendererBackend.queueCreateLayerPasses();
        }
    }

    async applySelectionMaskToAlphaChannel(layerId: number, options?: RendererFrontendApplySelectionMaskToAlphaChannelOptions): Promise<RendererTextureTile[]> {
        if (this.rendererBackend) {
            return this.rendererBackend.applySelectionMaskToAlphaChannel(layerId, options);
        }
        return [];
    }

    async resize(imageWidth: number, imageHeight: number, viewWidth: number, viewHeight: number) {
        await this.rendererBackend.resize(imageWidth, imageHeight, viewWidth, viewHeight);
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
        const layerIds = options?.layerIds
            ? new Uint32Array(options.layerIds)
            : undefined;
        return this.rendererBackend.takeSnapshot(imageWidth, imageHeight, {
            cameraTransform,
            layerIds,
            filters: options?.filters ? deepToRaw(options.filters) : undefined,
            applySelectionMask: options?.applySelectionMask,
            disableScaleToSize: options?.disableScaleToSize,
        });
    }

    async pickColor(canvasX: number, canvasY: number): Promise<RGBAColor> {
        if (!this.rendererBackend) throw Error('Renderer backend not initialized.');
        const imageWidth = workingFileStore.get('width');
        const imageHeight = workingFileStore.get('height');
        const cameraTransform = new DOMMatrix()
            .scaleSelf(imageWidth, imageHeight)
            .translateSelf(canvasX, canvasY)
        const bitmap = await this.takeSnapshot(1, 1, {
            cameraTransform,
            disableScaleToSize: true,
        });
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(bitmap, 0, 0);
        const imageData = ctx?.getImageData(0, 0, 1, 1);
        const color: RGBAColor = {
            is: 'color',
            r: (imageData?.data[0] ?? 0) / 255,
            g: (imageData?.data[1] ?? 0) / 255,
            b: (imageData?.data[2] ?? 0) / 255,
            alpha: (imageData?.data[3] ?? 0) / 255,
            style: '',
        };
        color.style = colorToHex(color, 'rgba');
        return color;
    }

    async startBrushStroke(
        settings: RendererBrushStrokeSettings,
    ) {
        await this.rendererBackend.startBrushStroke(settings)
    }

    async moveBrushStroke(
        layerId: number,
        x: number,
        y: number,
        size: number,
        density: number,
        colorBlendingStrength: number,
        concentration: number,
    ) {
        await this.rendererBackend.moveBrushStroke(
            layerId,
            x,
            y,
            size,
            density,
            colorBlendingStrength,
            concentration,
        );
    }

    async stopBrushStroke(
        layerId: number,
    ): Promise<RendererTextureTile[]> {
        return this.rendererBackend.stopBrushStroke(
            layerId,
        ) ?? [];
    }

    async createBrushPreview(
        settings: RendererBrushStrokePreviewsettings,
    ): Promise<ImageBitmap> {
        if (!this.rendererBackend) {
            await this.waitForRendererInitialized();
        }
        return await this.rendererBackend!.createBrushPreview(settings);
    }

    async dispose() {
        this.rendererBackend.dispose();
        (this.rendererBackend as unknown) = undefined;
        this.videoPlayer?.dispose();
        this.videoPlayer = undefined;

        for (const key of this.layerWatchersById.keys()) {
            const layerWatcher = this.layerWatchersById.get(key);
            if (!layerWatcher) continue;
            layerWatcher.detach();
        }
        this.layerWatchersById.clear();

        messageBus.off('backend.requestFrontendTexture', this.onTextureRequest);
        messageBus.off('backend.requestFrontendSvg', this.onSvgRequest);
        messageBus.off('layer.regenerateThumbnail', this.onRegenerateThumbnail);
        appEmitter.off('app.workingFile.layerAttached', this.onLayerAttached);
        appEmitter.off('app.workingFile.layerReordered', this.onLayerReordered);
        appEmitter.off('app.workingFile.layerDetached', this.onLayerDetached);
        appEmitter.off('app.workingFile.detachAllLayers', this.onDetachAllLayers);
        appEmitter.off('app.workingFile.layerOrderCalculated', this.onLayerOrderCalculated);
        appEmitter.off('editor.history.step', this.onEditorHistoryStep);

        this.stopWatchBackgroundColor?.();
        this.stopWatchMasks?.();
        this.stopWatchShowBoundary?.();
        this.stopWatchSelectionMask?.();
        this.stopWatchSize?.();
        this.stopWatchViewTransform?.();
    }
}
