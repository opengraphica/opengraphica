import { nextTick, toRefs, watch, type WatchStopHandle } from 'vue';

import canvasStore from '@/store/canvas';

import { createRasterShaderMaterial } from './shaders';
import { createFiltersFromLayerConfig, combineShaders } from '../../filters';

import { NearestFilter, LinearMipmapLinearFilter, LinearMipmapNearestFilter, sRGBEncoding, RGBAFormat, UnsignedByteType } from 'three/src/constants';
import { ImagePlaneGeometry } from './geometries/image-plane-geometry';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import { Mesh } from 'three/src/objects/Mesh';
import { CanvasTexture } from 'three/src/textures/CanvasTexture';

import type { Camera, Scene, WebGLRenderer } from 'three';
import type {
    DrawWorkingFileLayerOptions, WorkingFileLayer, WorkingFileLayerRenderer, WorkingFileGroupLayer, ColorModel,
    WorkingFileLayerFilter, WorkingFileLayerDraft
} from '@/types';

export default class BaseLayerRenderer implements WorkingFileLayerRenderer<ColorModel> {
    renderMode: '2d' | 'webgl' = 'webgl';
    threejsScene: Scene | undefined;
    isAttached: boolean = false;
    order: number = 0;

    private stopWatchBaseDraft: WatchStopHandle | undefined;
    protected draftPlaneGeometry: InstanceType<typeof ImagePlaneGeometry> | undefined;
    protected draftPlaneMaterial: InstanceType<typeof ShaderMaterial> | undefined;
    protected draftPlaneTexture: InstanceType<typeof CanvasTexture> | undefined;
    protected draftPlaneTextureRenderingContext: CanvasRenderingContext2D | undefined;
    protected draftPlane: InstanceType<typeof Mesh> | undefined;
    protected draftPlaneUseFilters: WorkingFileLayerFilter[] | undefined;
    private draftDestroyTimeoutHandle: number | undefined;
    private latestDraftUpdate: WorkingFileLayerDraft | null | undefined;

    private nextUpdatePromises: Array<Promise<void>> = [];

    reorder(order: number) {
        this.order = order;
        this.onReorder(order);

        // Handle draft logic
        if (this.draftPlane) {
            this.draftPlane.renderOrder = order + 0.2;
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
                const { draft } = toRefs(layer);
                this.stopWatchBaseDraft = watch([draft], ([draft]) => {
                    this.update({ draft });
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

            // Handle draft logic
            try {
                this.draftPlaneGeometry?.dispose();
                this.draftPlaneGeometry = undefined;
                this.draftPlaneMaterial?.dispose();
                this.draftPlaneMaterial = undefined;
                this.draftPlaneTexture?.dispose();
                this.draftPlaneTexture = undefined;
                this.draftPlane && (this.threejsScene ?? canvasStore.get('threejsScene'))?.remove(this.draftPlane)
                this.draftPlane = undefined;
                this.threejsScene = undefined;
                this.stopWatchBaseDraft?.();
            } catch (error) {
                console.error('[src/canvas/renderers/webgl/base.ts] Error disposing draft assets. ', error);
            }

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

        // Store filters definition in case it is needed later - assumed that inherited class calls update for this
        if (updates.filters) {
            this.draftPlaneUseFilters = updates.filters;
            // TODO - could update the draft plane material here, but not really
            // expecting this to possibly change mid-draft creation?
            this.draftPlaneMaterial?.dispose();
            this.draftPlaneMaterial = undefined;
        }

        // Handle draft logic
        if (updates.draft !== undefined) {
            this.latestDraftUpdate = updates.draft;
            window.clearTimeout(this.draftDestroyTimeoutHandle);
            if (updates.draft == null) {
                this.draftPlaneTextureRenderingContext?.clearRect(0, 0, this.draftPlaneTexture?.image?.width ?? 1, this.draftPlaneTexture?.image?.height ?? 1);
                if (this.draftPlaneTexture) this.draftPlaneTexture.needsUpdate = true;
                this.draftDestroyTimeoutHandle = window.setTimeout(() => {
                    this.draftPlaneGeometry?.dispose();
                    this.draftPlaneGeometry = undefined;
                    this.draftPlaneMaterial?.dispose();
                    this.draftPlaneMaterial = undefined;
                    this.draftPlaneTexture?.dispose();
                    this.draftPlaneTexture = undefined;
                    this.draftPlaneTextureRenderingContext = undefined;
                    this.draftPlane && (this.threejsScene ?? canvasStore.get('threejsScene'))?.remove(this.draftPlane)
                    this.draftPlane = undefined;
                }, 60000);
            } else {
                if (!this.draftPlaneMaterial) {
                    createFiltersFromLayerConfig(this.draftPlaneUseFilters ?? []).then((filterClasses) => {
                        const combinedShaderResult = combineShaders(
                            filterClasses,
                            { width: updates.draft?.logicalWidth, height: updates.draft?.logicalHeight }
                        );
                        this.draftPlaneMaterial = createRasterShaderMaterial(null, combinedShaderResult);
                        if (this.draftPlaneTexture) {
                            this.draftPlaneMaterial.uniforms.map.value = this.draftPlaneTexture
                        }
                        if (this.draftPlane) {
                            this.draftPlane.material = this.draftPlaneMaterial;
                        }

                        canvasStore.set('dirty', true);
                    });
                }

                if (
                    !this.draftPlaneGeometry ||
                    (this.draftPlaneGeometry?.parameters.width !== updates.draft.width) ||
                    (this.draftPlaneGeometry?.parameters.height !== updates.draft.height)
                ) {
                    this.draftPlaneGeometry?.dispose();
                    this.draftPlaneGeometry = new ImagePlaneGeometry(updates.draft.width, updates.draft.height);
                    if (this.draftPlane) {
                        this.draftPlane.geometry = this.draftPlaneGeometry;
                    }

                    canvasStore.set('dirty', true);
                }

                if (!this.draftPlane) {
                    this.draftPlane = new Mesh(this.draftPlaneGeometry, this.draftPlaneMaterial);
                    this.draftPlane.renderOrder = this.order + 0.2;
                    this.draftPlane.matrixAutoUpdate = false;
                    this.draftPlane.onBeforeRender = (renderer) => {
                        this.applyDraftUpdateChunks(renderer);
                    };
                    (this.threejsScene ?? canvasStore.get('threejsScene'))?.add(this.draftPlane);

                    canvasStore.set('dirty', true);
                }

                const logicalWidth = Math.round(updates.draft.logicalWidth);
                const logicalHeight = Math.round(updates.draft.logicalHeight);

                if (
                    !this.draftPlaneTexture ||
                    (this.draftPlaneTexture?.image?.width !== logicalWidth) ||
                    (this.draftPlaneTexture?.image?.height !== logicalHeight)
                ) {
                    const draftPlaneCanvas = document.createElement('canvas');
                    draftPlaneCanvas.width = logicalWidth;
                    draftPlaneCanvas.height = logicalHeight;
                    this.draftPlaneTextureRenderingContext = draftPlaneCanvas.getContext('2d') ?? undefined;

                    if (this.draftPlaneTextureRenderingContext) {
                        this.draftPlaneTexture = new CanvasTexture(draftPlaneCanvas);
                        this.draftPlaneTexture.generateMipmaps = false;
                        this.draftPlaneTexture.encoding = sRGBEncoding;
                        this.draftPlaneTexture.magFilter = NearestFilter;
                        this.draftPlaneTexture.minFilter = LinearMipmapLinearFilter;
                        this.draftPlaneMaterial && (this.draftPlaneMaterial.uniforms.map.value = this.draftPlaneTexture);

                        canvasStore.set('dirty', true);
                    }
                }

                if (updates.draft.transform) {
                    const transform = updates.draft.transform;
                    this.draftPlane?.matrix.set(
                        transform.m11, transform.m21, transform.m31, transform.m41,
                        transform.m12, transform.m22, transform.m32, transform.m42,
                        transform.m13, transform.m23, transform.m33, transform.m43, 
                        transform.m14, transform.m24, transform.m34, transform.m44
                    );
                }

                if (updates.draft.updateChunks.length > 0) {
                    canvasStore.set('dirty', true);
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

    private applyDraftUpdateChunks(renderer?: WebGLRenderer) {
        const draft = this.latestDraftUpdate;
        if (!draft || !this.draftPlaneTexture || !this.draftPlaneTextureRenderingContext) return;
        renderer = renderer ?? canvasStore.get('threejsRenderer')!;
        for (const chunk of draft.updateChunks) {
            this.draftPlaneTextureRenderingContext.clearRect(chunk.x, chunk.y, chunk.width, chunk.height);
            this.draftPlaneTextureRenderingContext.drawImage(chunk.data, chunk.x, chunk.y);
            this.draftPlaneTexture.needsUpdate = true;
        }
        draft.updateChunks = [];
    }

}
