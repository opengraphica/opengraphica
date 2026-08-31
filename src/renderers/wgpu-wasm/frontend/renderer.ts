import { nextTick, toRefs, watch, type WatchStopHandle } from 'vue';

import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import { getStoredImageCanvas } from '@/store/image';
import workingFileStore, { getLayerById, regenerateLayerThumbnail } from '@/store/working-file';
import {
    activeSelectionMask, activeSelectionMaskCanvasOffset, appliedSelectionMask,
    appliedSelectionMaskCanvasOffset, selectedLayersSelectionMaskPreview,
    selectedLayersSelectionMaskPreviewCanvasOffset,
} from '@/canvas/store/selection-state';

import appEmitter, { type AppEmitterEvents } from '@/lib/emitter';
import { colorToHex, colorToRgba, getColorModelName } from '@/lib/color';
import { getImageDataFromCanvas } from '@/lib/image';
import { deepToRaw } from '@/lib/vue';

import { messageBus } from '@/renderers/wgpu-wasm/backend/message-bus';

import { WasmImageFormat } from '@/types';
import type { WgpuWasmRendererBackend, WgpuWasmRendererBackendPublic } from '@/renderers/wgpu-wasm/backend';
import type {
    RGBAColor,
    ClassType, RendererFrontend, RendererFrontendTakeSnapshotOptions,
    RendererBrushStrokeSettings, RendererBrushStrokePreviewSettings,
    RendererFrontendApplySelectionMaskToAlphaChannelOptions,
    RendererLayerWatcher, RendererTextureTile, WorkingFileAnyLayer
} from '@/types';

export class WgpuWasmRendererFrontend implements RendererFrontend {
    rendererBackend: WgpuWasmRendererBackendPublic;

    stopWatchBackgroundColor: WatchStopHandle | undefined;
    stopWatchMasks: WatchStopHandle | undefined;
    stopWatchShowBoundary: WatchStopHandle | undefined;
    stopWatchSize: WatchStopHandle | undefined;
    stopWatchSelectionMask: WatchStopHandle | undefined;
    stopWatchViewTransform: WatchStopHandle | undefined;

    layerWatchersByType: Record<string, ClassType<RendererLayerWatcher>> = {};
    layerWatchersById: Map<number, RendererLayerWatcher> = new Map();

    constructor(backend: WgpuWasmRendererBackendPublic) {
        this.rendererBackend = backend;
    }

    async initialize(canvas: HTMLCanvasElement | OffscreenCanvas) {

        const { viewWidth, viewHeight } = toRefs(canvasStore.state);
        const { width: imageWidth, height: imageHeight } = toRefs(workingFileStore.state);

        // this.layerWatchersByType['gradient'] = (await import('@/renderers/wgpu-wasm/layers/gradient/watcher')).GradientLayerWatcher;
        this.layerWatchersByType['raster'] = (await import('@/renderers/wgpu-wasm/layers/raster/watcher')).RasterLayerWatcher;
        // this.layerWatchersByType['rasterSequence'] = (await import('@/renderers/wgpu-wasm/layers/raster-sequence/watcher')).RasterSequenceLayerWatcher;
        // this.layerWatchersByType['text'] = (await import('@/renderers/wgpu-wasm/layers/text/watcher')).TextLayerWatcher;
        // this.layerWatchersByType['vector'] = (await import('@/renderers/wgpu-wasm/layers/vector/watcher')).VectorLayerWatcher;
        // this.layerWatchersByType['video'] = (await import('@/renderers/wgpu-wasm/layers/video/watcher')).VideoLayerWatcher;

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
        const setRendererDirty = this.rendererBackend.isOffscreen
            ? () => {
                // TODO - Remove this altogether? No longer used.
                canvasStore.set('dirty', false)
            }
            : () => {
                if ((this.rendererBackend as WgpuWasmRendererBackend).dirty) {
                    canvasStore.set('dirty', false);
                    (this.rendererBackend as WgpuWasmRendererBackend).render(timelineCursor);
                }
            };
        
        let viewTransform = new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
        ]);

        const renderLoop = () => {
            const isViewDirty = canvasStore.get('viewDirty');
            const isPlayingAnimation = canvasStore.get('playingAnimation');

            if (isViewDirty || viewDirtyTrail) {
                viewDirtyTrail = false;
                canvasStore.set('viewDirty', false);
                const transform = canvasStore.get('transform');
                viewTransform[0] = transform.m11; viewTransform[1] = transform.m12;
                viewTransform[2] = transform.m13; viewTransform[3] = transform.m14;
                viewTransform[4] = transform.m21; viewTransform[5] = transform.m22;
                viewTransform[6] = transform.m23; viewTransform[7] = transform.m24;
                viewTransform[8] = transform.m31; viewTransform[9] = transform.m32;
                viewTransform[10] = transform.m33; viewTransform[11] = transform.m34;
                viewTransform[12] = transform.m41; viewTransform[13] = transform.m42;
                viewTransform[14] = transform.m43; viewTransform[15] = transform.m44;
                this.rendererBackend.setViewTransform(viewTransform);
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

            setRendererDirty();

            requestAnimationFrame(renderLoop);
        };

        requestAnimationFrame(renderLoop);
    }

    async resize(imageWidth: number, imageHeight: number, viewWidth: number, viewHeight: number) {
        await this.rendererBackend.resize(imageWidth, imageHeight, viewWidth, viewHeight);
    }

    async getMaxTextureSize(): Promise<number> {
        return Infinity;
    }

    async applySelectionMaskToAlphaChannel(layerId: number, options?: RendererFrontendApplySelectionMaskToAlphaChannelOptions): Promise<RendererTextureTile[]> {
        return [];
    }

    async takeSnapshot(imageWidth: number, imageHeight: number, options?: RendererFrontendTakeSnapshotOptions): Promise<ImageBitmap> {
        if (!this.rendererBackend) throw Error('Renderer backend not initialized.');
        const cameraTransform = options?.cameraTransform
            ? new Float32Array([
                options.cameraTransform.m11, options.cameraTransform.m21, options.cameraTransform.m31, options.cameraTransform.m41,
                options.cameraTransform.m12, options.cameraTransform.m22, options.cameraTransform.m32, options.cameraTransform.m42,
                options.cameraTransform.m13, options.cameraTransform.m23, options.cameraTransform.m33, options.cameraTransform.m43,
                options.cameraTransform.m14, options.cameraTransform.m24, options.cameraTransform.m34, options.cameraTransform.m44,
            ])
            : undefined;
        const layerIds = options?.layerIds
            ? new Uint32Array(options.layerIds)
            : undefined;
        return await this.rendererBackend.takeSnapshot(imageWidth, imageHeight, {
            cameraTransform,
            layerIds,
            filters: options?.filters,
            applySelectionMask: options?.applySelectionMask,
            // invertSelectionMask: options?.invertSelectionMask,
            disableScaleToSize: options?.disableScaleToSize,
        });
    }

    async pickColor(canvasX: number, canvasY: number): Promise<RGBAColor> {
        return {} as RGBAColor;
    }

    async startBrushStroke(settings: RendererBrushStrokeSettings) {

    }

    async moveBrushStroke(layerId: number, x: number, y: number, size: number, density: number, colorBlendingStrength: number, concentration: number) {

    }

    async stopBrushStroke(layerId: number): Promise<RendererTextureTile[]> {
        return [];
    }

    async createBrushPreview(settings: RendererBrushStrokePreviewSettings): Promise<ImageBitmap> {
        return this.rendererBackend.createBrushPreview(settings);
    }

    async dispose() {
        this.rendererBackend.dispose();
        (this.rendererBackend as unknown) = undefined;

        // TODO
    }


    async onSvgRequest(request?: { sourceUuid: string, width: number, height: number }) {
    }

    async onTextureRequest(sourceUuid?: string) {
        if (!sourceUuid) return;

        const storedImageCanvas = await getStoredImageCanvas(sourceUuid);
        if (!storedImageCanvas) {
            messageBus.emit('frontend.replyFrontendTexture', {
                sourceUuid,
                imageData: undefined,
            });
            return;
        }

        const imageData = getImageDataFromCanvas(storedImageCanvas);
        messageBus.emit('frontend.replyFrontendTexture', {
            sourceUuid,
            imageData: {
                width: imageData.width,
                height: imageData.height,
                format: WasmImageFormat.RGBA8_SRGB,
                buffer: new Uint8Array(imageData.data),
            },
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
        // TODO - not sure if passing the layers here is necessary.
        this.rendererBackend.setLayerOrder(
            []
        );
    }

    onEditorHistoryStep(event?: AppEmitterEvents['editor.history.step']) {
        if (!event) return;
        if (event.action.id === 'updateLayerBlendingMode') {
            this.rendererBackend.queueCreateLayerPasses();
        }
    }
}