import { nextTick, toRefs, watch, type WatchStopHandle } from 'vue';

import canvasStore from '@/store/canvas';
import editorStore from '@/store/editor';
import workingFileStore, { getLayerById, regenerateLayerThumbnail } from '@/store/working-file';
import {
    activeSelectionMask, activeSelectionMaskCanvasOffset, appliedSelectionMask,
    appliedSelectionMaskCanvasOffset, selectedLayersSelectionMaskPreview,
    selectedLayersSelectionMaskPreviewCanvasOffset,
} from '@/canvas/store/selection-state';

import { colorToHex, colorToRgba, getColorModelName } from '@/lib/color';
import { deepToRaw } from '@/lib/vue';

import type { WgpuWasmRendererBackend, WgpuWasmRendererBackendPublic } from '@/renderers/wgpu-wasm/backend';
import type {
    RGBAColor,
    ClassType, RendererFrontend, RendererFrontendTakeSnapshotOptions,
    RendererBrushStrokeSettings, RendererBrushStrokePreviewsettings,
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

        await this.rendererBackend.initialize(canvas, imageWidth.value, imageHeight.value, viewWidth.value, viewHeight.value);

        // TODO - layers, etc

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

        // TODO - message bus

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

    async applySelectionMaskToAlphaChannel(layerId: number, options?: RendererFrontendApplySelectionMaskToAlphaChannelOptions): Promise<RendererTextureTile[]> {
        return [];
    }

    async takeSnapshot(imageWidth: number, imageHeight: number, options?: RendererFrontendTakeSnapshotOptions): Promise<ImageBitmap> {
        return new ImageBitmap();
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

    async createBrushPreview(settings: RendererBrushStrokePreviewsettings): Promise<ImageBitmap> {
        return new ImageBitmap();
    }

    async dispose() {
        this.rendererBackend.dispose();
        (this.rendererBackend as unknown) = undefined;

        // TODO
    }
}