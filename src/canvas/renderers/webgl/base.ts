import { markRaw, nextTick, toRefs, watch, type WatchStopHandle } from 'vue';

import canvasStore from '@/store/canvas';

import { createRasterShaderMaterial } from './shaders';
import { assignMaterialBlendModes } from './blending';
import { createFiltersFromLayerConfig, combineShaders } from '../../filters';
import { getCanvasRenderingContext2DSettings } from '@/store/working-file';

import { NearestFilter, LinearEncoding, LinearFilter, LinearMipmapLinearFilter, LinearMipmapNearestFilter, sRGBEncoding, RGBAFormat, UnsignedByteType } from 'three/src/constants';
import { ImagePlaneGeometry } from './geometries/image-plane-geometry';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import { Mesh } from 'three/src/objects/Mesh';
import { CanvasTexture } from 'three/src/textures/CanvasTexture';
import { Vector2 } from 'three/src/math/Vector2';

import { Camera, Scene, WebGLRenderer } from 'three';
import type {
    DrawWorkingFileLayerOptions, WorkingFileLayer, WorkingFileLayerRenderer, WorkingFileGroupLayer, ColorModel,
    WorkingFileLayerFilter, WorkingFileLayerDraft, WorkingFileLayerBlendingMode
} from '@/types';

interface DraftAssets {
    planeGeometry: InstanceType<typeof ImagePlaneGeometry> | undefined;
    planeMaterial: InstanceType<typeof ShaderMaterial> | undefined;
    planeTexture: InstanceType<typeof CanvasTexture> | undefined;
    planeTextureRenderingContext: CanvasRenderingContext2D | undefined;
    plane: InstanceType<typeof Mesh> | undefined;
    draftDestroyTimeoutHandle: number | undefined;
    latestDraftUpdate: WorkingFileLayerDraft | null | undefined;
}

export default class BaseLayerRenderer implements WorkingFileLayerRenderer<ColorModel> {
    renderMode: '2d' | 'webgl' = 'webgl';
    threejsScene: Scene | undefined;
    isAttached: boolean = false;
    order: number = 0;

    private stopWatchBaseDrafts: WatchStopHandle | undefined;
    private draftPlaneUseFilters: WorkingFileLayerFilter[] = [];
    private draftAssetMap: Map<string, DraftAssets> = markRaw(new Map());
    private recycledDraftAssets: DraftAssets | null = null;

    private nextUpdatePromises: Array<Promise<void>> = [];

    private lastBaseBlendingMode: WorkingFileLayerBlendingMode = 'normal';

    reorder(order: number) {
        this.order = order;
        this.onReorder(order);

        // Handle draft logic
        let orderIterator = 0;
        for (const draft of this.draftAssetMap.values()) {
            if (draft.plane) {
                draft.plane.renderOrder = order + 0.2 + orderIterator;
            }
            orderIterator += 0.01;
        }
    }
    onReorder(order: number) {
        // Override
    }

    attach(layer: WorkingFileLayer<ColorModel>) {
        if (!this.isAttached) {
            try {
                this.onAttach(layer);
            } catch (error) {
                console.error('[src/canvas/renderers/webgl/base.ts] Error during layer attach. ', error);
            }

            // Handle draft logic
            try {
                const { drafts } = toRefs(layer);
                this.stopWatchBaseDrafts = watch([drafts], ([drafts]) => {
                    this.update({ drafts });
                }, { immediate: true, deep: true });
            } catch (error) {
                console.error('[src/canvas/renderers/webgl/base.ts] Error setting up draft update watcher. ', error);
            }

            this.isAttached = true;
        }
    }
    onAttach(layer: WorkingFileLayer<ColorModel>) {
        // Override
    }

    detach() {
        if (this.isAttached) {
            try {
                this.onDetach();
            } catch (error) {
                console.error('[src/canvas/renderers/webgl/base.ts] Error during layer detach. ', error);
            }

            this.disposeAllDrafts();
            this.draftAssetMap.clear();
            this.threejsScene = undefined;
            this.stopWatchBaseDrafts?.();

            this.isAttached = false;
        }
    }
    onDetach() {
        // Override
    }

    update(updates: Partial<WorkingFileLayer<ColorModel>>) {
        this.nextUpdatePromises.push(
            this.onUpdate(updates)
        );

        if (updates.blendingMode) {
            this.lastBaseBlendingMode = updates.blendingMode;
            for (const draftUuid of this.draftAssetMap.keys()) {
                const draftAssets = this.draftAssetMap.get(draftUuid);
                if (draftAssets?.planeMaterial) {
                    assignMaterialBlendModes(draftAssets.planeMaterial, updates.blendingMode);
                }
            }
        }

        // Store filters definition in case it is needed later - assumed that inherited class calls update for this
        if (updates.filters) {
            this.draftPlaneUseFilters = updates.filters;
            // TODO - could update the draft plane material here, but not really
            // expecting this to possibly change mid-draft creation?
            for (const draft of this.draftAssetMap.values()) {
                draft.planeMaterial?.dispose();
                draft.planeMaterial = undefined;
            }
        }

        // Handle draft logic
        updateDrafts:
        if (updates.drafts !== undefined) {
            if (updates.drafts == null) {
                this.disposeAllDrafts();
                canvasStore.set('dirty', true);
                break updateDrafts;
            }

            let usedDraftIds = [];
            let orderIterator = 0;
            for (const draftUpdate of updates.drafts) {
                usedDraftIds.push(draftUpdate.uuid);
                let draftAssets = this.draftAssetMap.get(draftUpdate.uuid)!;

                if (!draftAssets) {
                    draftAssets = this.createDraftAssets();
                    this.draftAssetMap.set(draftUpdate.uuid, draftAssets);
                }

                draftAssets.latestDraftUpdate = draftUpdate;

                if (!draftAssets.planeMaterial) {
                    createFiltersFromLayerConfig(this.draftPlaneUseFilters ?? []).then((filterClasses) => {
                        const combinedShaderResult = combineShaders(
                            filterClasses,
                            { width: draftUpdate.logicalWidth, height: draftUpdate.logicalHeight }
                        );
                        draftAssets.planeMaterial = createRasterShaderMaterial(null, combinedShaderResult);
                        assignMaterialBlendModes(draftAssets.planeMaterial, this.lastBaseBlendingMode);
                        if (draftAssets.planeTexture) {
                            draftAssets.planeMaterial.uniforms.map.value = draftAssets.planeTexture
                        }
                        if (draftAssets.plane) {
                            draftAssets.plane.material = draftAssets.planeMaterial;
                        }
                        canvasStore.set('dirty', true);
                    });
                }

                if (
                    !draftAssets.planeGeometry ||
                    (draftAssets.planeGeometry?.parameters.width !== draftUpdate.width) ||
                    (draftAssets.planeGeometry?.parameters.height !== draftUpdate.height)
                ) {
                    draftAssets.planeGeometry?.dispose();
                    draftAssets.planeGeometry = new ImagePlaneGeometry(draftUpdate.width, draftUpdate.height);
                    if (draftAssets.plane) {
                        draftAssets.plane.geometry = draftAssets.planeGeometry;
                    }

                    canvasStore.set('dirty', true);
                }

                if (!draftAssets.plane) {
                    draftAssets.plane = new Mesh(draftAssets.planeGeometry, draftAssets.planeMaterial);
                    draftAssets.plane.renderOrder = this.order + 0.2;
                    draftAssets.plane.matrixAutoUpdate = false;
                    draftAssets.plane.onBeforeRender = (renderer) => {
                        this.applyDraftUpdateChunks(renderer, draftUpdate.uuid);
                    };
                    (this.threejsScene ?? canvasStore.get('threejsScene'))?.add(draftAssets.plane);

                    canvasStore.set('dirty', true);
                }

                const logicalWidth = Math.round(draftUpdate.logicalWidth);
                const logicalHeight = Math.round(draftUpdate.logicalHeight);

                if (
                    !draftAssets.planeTexture ||
                    (draftAssets.planeTexture?.image?.width !== logicalWidth) ||
                    (draftAssets.planeTexture?.image?.height !== logicalHeight)
                ) {
                    const draftPlaneCanvas = document.createElement('canvas');
                    draftPlaneCanvas.width = logicalWidth;
                    draftPlaneCanvas.height = logicalHeight;
                    draftAssets.planeTextureRenderingContext = draftPlaneCanvas.getContext('2d') ?? undefined;

                    draftAssets.planeTexture = new CanvasTexture(draftPlaneCanvas);
                    draftAssets.planeTexture.premultiplyAlpha = false;
                    draftAssets.planeTexture.generateMipmaps = false;
                    draftAssets.planeTexture.format = RGBAFormat;
                    draftAssets.planeTexture.encoding = sRGBEncoding;
                    draftAssets.planeTexture.magFilter = NearestFilter;
                    draftAssets.planeTexture.minFilter = NearestFilter;
                    draftAssets.planeMaterial && (draftAssets.planeMaterial.uniforms.map.value = draftAssets.planeTexture);

                    canvasStore.set('dirty', true);
                }

                if (draftUpdate.transform) {
                    const transform = draftUpdate.transform;
                    draftAssets.plane?.matrix.set(
                        transform.m11, transform.m21, transform.m31, transform.m41,
                        transform.m12, transform.m22, transform.m32, transform.m42,
                        transform.m13, transform.m23, transform.m33, transform.m43, 
                        transform.m14, transform.m24, transform.m34, transform.m44
                    );
                }

                if (draftUpdate.updateChunks.length > 0) {
                    canvasStore.set('dirty', true);
                }

                if (draftAssets.plane) {
                    draftAssets.plane.renderOrder = this.order + 0.2 + orderIterator;
                }
                orderIterator += 0.01;
            }

            // Remove unused drafts.
            for (const uuid of this.draftAssetMap.keys()) {
                if (!usedDraftIds.includes(uuid)) {
                    canvasStore.set('dirty', true);
                    setTimeout(() => {
                        this.recycleDraftById(uuid);
                    }, 0);
                }
            }
        }
    }
    async onUpdate(updates: Partial<WorkingFileLayer<ColorModel>>) {
        // Override
    }
    async nextUpdate() {
        await nextTick();
        const nextUpdatePromises = this.nextUpdatePromises;
        this.nextUpdatePromises = [];
        await Promise.allSettled(nextUpdatePromises);
    }

    draw(ctx: CanvasRenderingContext2D, layer: WorkingFileLayer<ColorModel>, options: DrawWorkingFileLayerOptions = {}) {
        this.onDraw(ctx, layer, options);
    }
    onDraw(ctx: CanvasRenderingContext2D, layer: WorkingFileLayer<ColorModel>, options: DrawWorkingFileLayerOptions = {}) {
        // Override
    }

    renderGroup(renderer: WebGLRenderer, camera: Camera, layer: WorkingFileGroupLayer<ColorModel>) {
        this.onRenderGroup(renderer, camera, layer);
    }
    onRenderGroup(renderer: WebGLRenderer, camera: Camera, layer: WorkingFileGroupLayer<ColorModel>) {
        // Override
    }

    private async applyDraftUpdateChunks(renderer: WebGLRenderer, draftUuid: string) {
        const draftAssets = this.draftAssetMap.get(draftUuid);
        if (!draftAssets) return;
        const draft = draftAssets.latestDraftUpdate;
        if (!draft || !draftAssets.planeTexture || !draftAssets.planeTextureRenderingContext) return;
        renderer = renderer ?? canvasStore.get('threejsRenderer')!;
        const draftWidth = draftAssets.planeTexture.image.width;
        const draftHeight = draftAssets.planeTexture.image.height;
        for (const chunk of draft.updateChunks) {
            let chunkImage: HTMLCanvasElement | ImageBitmap = chunk.data;

            if (chunk.x > draftWidth || chunk.y > draftHeight) continue;

            // Crop the chunk if it is outside the bounds of the draft texture
            let shouldCloseChunkImage = false;
            let chunkWidth = chunk.data.width;
            let chunkHeight = chunk.data.height;
            if (chunk.x + chunk.data.width > draftWidth || chunk.y + chunk.data.height > draftHeight) {
                chunkWidth = Math.min(chunk.data.width, draftWidth - chunk.x);
                chunkHeight = Math.min(chunk.data.height, draftHeight - chunk.y);
                const canvas = document.createElement('canvas');
                canvas.width = chunkWidth;
                canvas.height = chunkHeight;
                const ctx = canvas.getContext('2d', getCanvasRenderingContext2DSettings());
                if (!ctx) {
                    chunkImage = await createImageBitmap(chunkImage, 0, 0, chunkWidth, chunkHeight, {
                        imageOrientation: 'flipY',
                        premultiplyAlpha: 'none',
                    });
                    shouldCloseChunkImage = true;
                } else {
                    ctx.drawImage(chunkImage, 0, 0);
                    chunkImage = canvas;
                }
            }

            // Create a texture from the chunk
            const chunkTexture = new CanvasTexture(chunkImage);
            chunkTexture.premultiplyAlpha = true;
            chunkTexture.generateMipmaps = false;
            chunkTexture.format = RGBAFormat;
            chunkTexture.encoding = sRGBEncoding;
            chunkTexture.minFilter = NearestFilter;
            chunkTexture.magFilter = NearestFilter;

            // This will re-upload entire texture to GPU. Slow.
            // draftAssets.planeTextureRenderingContext.clearRect(chunk.x, chunk.y, chunk.width, chunk.height);
            // draftAssets.planeTextureRenderingContext.drawImage(chunk.data, chunk.x, chunk.y);
            // draftAssets.planeTexture.needsUpdate = true;
            
            renderer.copyTextureToTexture(
                new Vector2(chunk.x, draftAssets.planeTexture.image.height - chunk.y - chunkHeight),
                chunkTexture,
                draftAssets.planeTexture
            );
            if (shouldCloseChunkImage) {
                (chunkImage as ImageBitmap).close();
            }
            chunkTexture.dispose();
        }
        draft.updateChunks = [];
    }

    private createDraftAssets(): DraftAssets {
        if (this.recycledDraftAssets) {
            const draftAssets = this.recycledDraftAssets;
            window.clearTimeout(draftAssets.draftDestroyTimeoutHandle);
            draftAssets.draftDestroyTimeoutHandle = undefined;
            this.recycledDraftAssets = null;
            return draftAssets;
        }
        return {
            planeGeometry: undefined,
            planeMaterial: undefined,
            planeTexture: undefined,
            planeTextureRenderingContext: undefined,
            plane: undefined,
            draftDestroyTimeoutHandle: undefined,
            latestDraftUpdate: undefined,
        };
    }

    private disposeAllDrafts() {
        for (const uuid of this.draftAssetMap.keys()) {
            this.disposeDraftById(uuid);
        }
        if (this.recycledDraftAssets) {
            this.disposeDraft(this.recycledDraftAssets);
            this.recycledDraftAssets = null;
        }
    }

    private recycleDraftById(uuid: string) {
        if (!this.recycledDraftAssets) {
            this.recycledDraftAssets = this.draftAssetMap.get(uuid) ?? null;
            if (this.recycledDraftAssets) {
                const recycledAssets = this.recycledDraftAssets;
                recycledAssets.planeTextureRenderingContext?.clearRect(0, 0, recycledAssets.planeTexture?.image?.width ?? 1, recycledAssets.planeTexture?.image?.height ?? 1);
                if (recycledAssets.planeTexture) recycledAssets.planeTexture.needsUpdate = true;
                recycledAssets.latestDraftUpdate = null;
                recycledAssets.plane && (this.threejsScene ?? canvasStore.get('threejsScene'))?.remove(recycledAssets.plane)
                recycledAssets.plane = undefined;
                recycledAssets.draftDestroyTimeoutHandle = window.setTimeout(() => {
                    this.disposeDraft(recycledAssets);
                    if (this.recycledDraftAssets === recycledAssets) {
                        this.recycledDraftAssets = null;
                    }
                }, 60000);
                canvasStore.set('dirty', true);
            }
            this.draftAssetMap.delete(uuid);
        } else {
            this.disposeDraftById(uuid);
        }
    }

    private disposeDraftById(uuid: string) {
        try {
            const draft = this.draftAssetMap.get(uuid);
            if (draft) {
                this.disposeDraft(draft);
                this.draftAssetMap.delete(uuid);
            }
        } catch (error) {
            console.error('[src/canvas/renderers/webgl/base.ts] Error disposing draft assets. ', error);
        }
    }

    private disposeDraft(draftAssets: DraftAssets) {
        draftAssets.planeGeometry?.dispose();
        (draftAssets.planeGeometry as unknown) = undefined;
        draftAssets.planeMaterial?.dispose();
        draftAssets.planeMaterial = undefined;
        draftAssets.planeTexture?.dispose();
        (draftAssets.planeTexture as unknown) = undefined;
        draftAssets.plane && (this.threejsScene ?? canvasStore.get('threejsScene'))?.remove(draftAssets.plane)
    }

}
