import {
    ClampToEdgeWrapping, DoubleSide, LinearFilter, LinearSRGBColorSpace, NearestFilter,
    SRGBColorSpace, RepeatWrapping, RGBAFormat, UnsignedByteType,
} from 'three/src/constants';
import { OrthographicCamera } from 'three/src/cameras/OrthographicCamera';
import { Matrix4 } from 'three/src/math/Matrix4';
import { Scene } from 'three/src/scenes/Scene';
import { Vector3 } from 'three/src/math/Vector3';
import { Vector4 } from 'three/src/math/Vector4';
import { WebGLRenderer } from 'three/src/renderers/WebGLRenderer';
import { WebGLRenderTarget } from 'three/src/renderers/WebGLRenderTarget';

import { EffectComposer } from './postprocessing/effect-composer';
import { GammaCorrectionShader } from './postprocessing/gamma-correction-shader';
import { RenderPass } from './postprocessing/render-pass';
import { ShaderPass } from './postprocessing/shader-pass';

import { Compositor } from './compositor';
import { ImageBackground } from './image-background';
import { ImageBoundaryMask } from './image-boundary-mask';
import { requestFrontendTexture } from './image-transfer';
import { SelectionMask } from './selection-mask';
import { messageBus } from './message-bus';
import { createCanvasFiltersFromLayerConfig } from '@/renderers/webgl2/layers/base/material';

import type { Camera, Texture } from 'three';
import type {
    RendererBrushStrokeSettings, RendererBrushStrokePreviewsettings, RendererTextureTile,
    Webgl2RendererCanvasFilter, Webgl2RendererMeshController, WorkingFileLayer,
    WorkingFileGroupLayer, WorkingFileLayerFilter, WorkingFileLayerMask,
    RendererFrontendTakeSnapshotCropOptions, ClassType,
} from '@/types';

const noRenderPassModes = new Set(['normal', 'erase']);

export interface Webgl2RendererBackendTakeSnapshotOptions {
    cameraTransform?: Float64Array;
    layerIds?: Uint32Array;
    filters?: WorkingFileLayerFilter[];
    applySelectionMask?: boolean;
    disableScaleToSize?: boolean;
}

export interface Webgl2RendererApplySelectionMaskToAlphaChannelOptions {
    invert?: boolean;
}

export type MeshControllerInterface = any & { dispose: () => void };

export interface Webgl2RendererBackendPublic {
    isOffscreen: boolean;
    onRequestFrontendSvg?: (request: { sourceUuid: string, width: number, height: number }) => void;
    onRequestFrontendTexture?: (sourceUuid: string) => void;
    initialize(canvas: HTMLCanvasElement | OffscreenCanvas, imageWidth: number, imageHeight: number, viewWidth: number, viewHeight: number): Promise<void>;
    resize(imageWidth: number, imageHeight: number, viewWidth: number, viewHeight: number): Promise<void>;
    enableImageBoundaryMask(enabled: boolean): Promise<void>;
    setBackgroundColor(r: number, g: number, b: number, alpha: number): Promise<void>;
    setMasks(masks: Record<number, WorkingFileLayerMask>): Promise<void>;
    setSelectionMask(image?: ImageBitmap, offset?: { x: number, y: number }): Promise<void>;
    setViewTransform(transform: Float64Array): Promise<void>;
    setLayerOrder(layerOrder: WorkingFileLayer[]): Promise<void>;
    queueCreateLayerPasses(): Promise<void>;
    applySelectionMaskToAlphaChannel(layerId: number, options?: Webgl2RendererApplySelectionMaskToAlphaChannelOptions): Promise<RendererTextureTile[]>;
    takeSnapshot(imageWidth: number, imageHeight: number, options?: Webgl2RendererBackendTakeSnapshotOptions): Promise<ImageBitmap>;
    startBrushStroke(settings: RendererBrushStrokeSettings): Promise<void>;
    moveBrushStroke(layerId: number, x: number, y: number, size: number, density: number, colorBlendingStrength: number, concentration: number): Promise<void>;
    stopBrushStroke(layerId: number): Promise<RendererTextureTile[]>;
    createBrushPreview(settings: RendererBrushStrokePreviewsettings): Promise<ImageBitmap>;
    createMeshController(type: string): Promise<MeshControllerInterface>;
    setDirty(): Promise<void>;
    dispose(): Promise<void>;
}

export class Webgl2RendererBackend implements Webgl2RendererBackendPublic {
    isOffscreen: boolean = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
    dirty: boolean = false;
    rendererBusy: boolean = false; // Renderer is being used for other operations and shouldn't be used to draw right now

    camera!: OrthographicCamera;
    composer!: EffectComposer;
    compositor!: Compositor;
    imageBackground!: ImageBackground;
    imageBoundaryMask!: ImageBoundaryMask;
    renderer!: WebGLRenderer;
    scene!: Scene;
    selectionMask!: SelectionMask;
    viewport!: Vector4;

    snapshotCanvas?: HTMLCanvasElement | OffscreenCanvas;
    snapshotComposer?: EffectComposer;
    snapshotRenderer?: WebGLRenderer;

    maxTextureSize: number = 2048;
    viewTransform: Matrix4 = new Matrix4();
    imageWidth: number = 1;
    imageHeight: number = 1;

    layerOrder: WorkingFileLayer[] = [];
    masks: Record<number, WorkingFileLayerMask> = {};
    maskTextures: Record<number, Texture> = {};
    maskTextureRequests: Record<number, Promise<Texture | undefined> | undefined> = {};
    meshControllersById: Map<number, Webgl2RendererMeshController> = new Map();

    queueCreateLayerPassesTimeoutHandle: number | undefined;
    beforeRenderCallbacks: Array<(timelineCursor: number) => void> = [];

    compositorBrushStrokes = new Map<number, number>();

    meshControllersByType: Record<string, ClassType<Webgl2RendererMeshController>> = {};

    async createMeshController(type: string) {
        return new this.meshControllersByType[type]();
    }

    async initialize(canvas: HTMLCanvasElement | OffscreenCanvas, imageWidth: number, imageHeight: number, viewWidth: number, viewHeight: number) {
        this.imageWidth = imageWidth;
        this.imageHeight = imageHeight;

        if (!this.isOffscreen) {
            this.meshControllersByType = {
                gradient: (await import('@/renderers/webgl2/layers/gradient/mesh-controller')).GradientLayerMeshController,
                raster: (await import('@/renderers/webgl2/layers/raster/mesh-controller')).RasterLayerMeshController,
                rasterSequence: (await import('@/renderers/webgl2/layers/raster-sequence/mesh-controller')).RasterSequenceLayerMeshController,
                text: (await import('@/renderers/webgl2/layers/text/mesh-controller')).TextLayerMeshController,
                vector: (await import('@/renderers/webgl2/layers/vector/mesh-controller')).VectorLayerMeshController,
                video: (await import('@/renderers/webgl2/layers/video/mesh-controller')).VideoLayerMeshController,
            };
        }

        this.renderer = new WebGLRenderer({
            alpha: true,
            canvas,
            premultipliedAlpha: false, // KEEP THIS FALSE - It gives the most flexibility for renderer reuse.
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance',
        });
        this.renderer.outputColorSpace = SRGBColorSpace;
        this.renderer.setSize(1, 1, false);
        this.viewport = new Vector4();
        this.maxTextureSize = this.renderer?.capabilities?.maxTextureSize ?? 2048;

        this.scene = new Scene();
        this.scene.background = null;

        this.camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10000);
        this.camera.matrixAutoUpdate = false;

        this.selectionMask = new SelectionMask();

        this.compositor = new Compositor(this.renderer, this.selectionMask);
        this.compositor.setOriginalViewport(this.viewport);

        this.imageBackground = new ImageBackground();
        this.imageBoundaryMask = new ImageBoundaryMask();

        await Promise.all([
            this.imageBackground.initialize(this.scene, imageWidth, imageHeight),
            this.imageBoundaryMask.initialize(this.scene, viewWidth, viewHeight),
            this.selectionMask.initialize(this.camera, this.scene, viewWidth, viewHeight),
        ]);

        this.composer = new EffectComposer(this.renderer);
        this.createLayerPasses();

        await this.resize(imageWidth, imageHeight, viewWidth, viewHeight);

        this.render(0);
    }

    async resize(imageWidth: number, imageHeight: number, viewWidth: number, viewHeight: number) {
        this.imageWidth = imageWidth;
        this.imageHeight = imageHeight;
        if (this.renderer) {
            this.renderer.setSize(viewWidth, viewHeight, false);
            this.renderer.getViewport(this.viewport);
        }
        if (this.composer) {
            this.composer.setSize(viewWidth, viewHeight);
        }
        if (this.camera) {
            this.camera.left = 0;
            this.camera.right = viewWidth;
            this.camera.top = 0;
            this.camera.bottom = viewHeight;
            this.camera.updateProjectionMatrix();
        }
        if (this.compositor) {
            this.compositor.setOriginalViewport(this.viewport);
        }
        if (this.imageBackground) {
            this.imageBackground.resize(imageWidth, imageHeight);
        }
        if (this.imageBoundaryMask) {
            this.imageBoundaryMask.resize(imageWidth, imageHeight);
        }
        this.dirty = true;
    }

    async enableImageBoundaryMask(enabled: boolean) {
        if (!this.imageBoundaryMask) return;
        this.imageBoundaryMask.visible = enabled;
        this.dirty = true;
    }

    async setBackgroundColor(r: number, g: number, b: number, alpha: number) {
        if (!this.imageBackground) return;
        this.imageBackground.setColor(r, g, b, alpha);
        this.dirty = true;
    }

    async setMasks(masks: Record<number, WorkingFileLayerMask>) {
        const maskIds = new Set(Object.keys(masks));
        const maskTextureIds = new Set(Object.keys(this.maskTextures));

        const addedOrChanged = [...maskIds].filter((id) => {
            const idNumber = parseInt(id);
            return !maskTextureIds.has(id) || this.masks[idNumber].hash !== masks[idNumber].hash
        });
        const removed = [...maskTextureIds].filter((id) => !maskIds.has(id));

        for (const key of addedOrChanged) {
            const id = parseInt(key);
            this.maskTextures[id]?.dispose();
            this.maskTextureRequests[id] = requestFrontendTexture(masks[id].sourceUuid);
            this.maskTextureRequests[id]!.then((texture) => {
                if (texture) {
                    this.maskTextures[id] = texture;
                }
                delete this.maskTextureRequests[id];
                return texture;
            });
        }
        for (const key of removed) {
            const id = parseInt(key);
            this.maskTextures[id]?.dispose();
            delete this.maskTextures[id];
        }
        this.masks = JSON.parse(JSON.stringify(masks));
    }

    async getMaskTexture(maskId: number): Promise<Texture | undefined> {
        if (this.maskTextureRequests[maskId]) {
            return await this.maskTextureRequests[maskId];
        }
        return this.maskTextures[maskId];
    }

    async setSelectionMask(image?: ImageBitmap, offset?: { x: number, y: number }) {
        this.selectionMask.setImage(image, offset);
        this.dirty = true;
    }

    async setViewTransform(transform: Float64Array) {
        this.viewTransform.set(
            transform[0], transform[1], transform[2], transform[3],
            transform[4], transform[5], transform[6], transform[7],
            transform[8], transform[9], transform[10], transform[11], 
            transform[12], transform[13], transform[14], transform[15],
        );
        this.dirty = true;
    }

    addMeshController(id: number, controller: Webgl2RendererMeshController) {
        this.meshControllersById.set(id, controller);
        this.queueCreateLayerPasses();
    }

    removeMeshController(id: number) {
        this.meshControllersById.delete(id);
    }

    async setLayerOrder(layerOrder: WorkingFileLayer[]) {
        this.layerOrder = layerOrder;
        this.createLayerPasses();
    }

    async queueCreateLayerPasses() {
        clearTimeout(this.queueCreateLayerPassesTimeoutHandle);
        this.queueCreateLayerPassesTimeoutHandle = setTimeout(this.createLayerPasses.bind(this), 0);
    }

    createLayerPasses(composer?: EffectComposer, camera?: Camera, includeLayerIds?: Uint32Array) {
        clearTimeout(this.queueCreateLayerPassesTimeoutHandle);

        composer = composer ?? this.composer;
        camera = camera ?? this.camera;

        if (!composer) return;

        composer.disposeAllPasses();
    
        let passScenes: Array<Scene> = [];
    
        if (this.imageBackground) {
            const backgroundScene = new Scene();
            backgroundScene.background = null;
            this.imageBackground.swapScene(backgroundScene);
            passScenes.push(backgroundScene);
        }
    
        let currentScene = new Scene();
        currentScene.background = null;
        let currentSceneIsUsed = false;

        const stack: Array<WorkingFileLayer> = [
            { type: 'group', layers: this.layerOrder } as WorkingFileGroupLayer,
        ];
        while (stack.length > 0) {
            const layer = stack.pop()!;
            if (layer.type === 'group') {
                for (const childLayer of (layer as WorkingFileGroupLayer).layers) {
                    stack.unshift(childLayer);
                }
            }
            const meshController = includeLayerIds == null || includeLayerIds?.includes(layer.id)
                ? this.meshControllersById.get(layer.id)
                : undefined;
            if (meshController) {
                if (!noRenderPassModes.has(meshController.blendingMode)) {
                    if (currentSceneIsUsed) {
                        passScenes.push(currentScene);
                        currentScene = new Scene();
                        currentScene.background = null;
                        currentSceneIsUsed = false;
                    }
                }
                meshController.swapScene(currentScene);
                currentSceneIsUsed = true;
            }
        }
        if (currentSceneIsUsed) {
            passScenes.push(currentScene);
        }
    
        if (this.selectionMask) {
            this.selectionMask.swapScene(passScenes[passScenes.length - 1]);
        }
        if (this.imageBoundaryMask) {
            this.imageBoundaryMask.swapScene(passScenes[passScenes.length - 1]);
        }
    
        let isFirstPass = true;
        for (const scene of passScenes) {
            const renderPass = new RenderPass(scene, camera);
            renderPass.isFirstPass = isFirstPass;
            if (isFirstPass) isFirstPass = false;
            composer.addPass(renderPass);
        }
    
        composer.addPass(new ShaderPass(GammaCorrectionShader));
        composer.renderTarget1.samples = 4;
        composer.renderTarget2.samples = 4;
        this.dirty = true;
    }

    registerBeforeRenderCallback(callback: (timelineCursor: number) => void) {
        this.beforeRenderCallbacks.push(callback);
    }

    unregisterBeforeRenderCallback(callback: (timelineCursor: number) => void) {
        let index = this.beforeRenderCallbacks.indexOf(callback);
        if (index > -1) {
            this.beforeRenderCallbacks.splice(index, 1);
        }
    }

    render(timelineCursor: number) {
        if (!this.camera || this.rendererBusy) return;

        for (const callback of this.beforeRenderCallbacks) {
            callback(timelineCursor);
        }

        this.camera.matrix = this.viewTransform.clone().invert().multiply(new Matrix4().makeTranslation(0, 0, 1));
        this.camera.updateMatrixWorld(true);
        this.camera.updateProjectionMatrix();

        this.composer.render();

        this.dirty = false;
        messageBus.emit('renderer.renderComplete');
    }

    async applySelectionMaskToAlphaChannel(layerId: number, options?: Webgl2RendererApplySelectionMaskToAlphaChannelOptions): Promise<RendererTextureTile[]> {
        const meshController = this.meshControllersById.get(layerId);
        if (!meshController) return [];
        const texture = await meshController.getTexture();
        if (!texture) return [];
        const transform = meshController.getTransform();
        try {
            this.rendererBusy = true;
            const tiles = await this.selectionMask.applyToTextureAlphaChannel(
                texture,
                new Matrix4().multiply(transform),
                this.renderer,
                this.viewport,
                options?.invert,
            );
            this.rendererBusy = false;
            this.dirty = true;
            return tiles;
        } catch (error) {
            this.rendererBusy = false;
            console.error('[renderers/webgl2/backend/renderer.ts] Error when applying selection mask.', error);
        }
        return [];
    }

    async takeSnapshot(
        imageWidth: number,
        imageHeight: number,
        options?: Webgl2RendererBackendTakeSnapshotOptions
    ): Promise<ImageBitmap> {

        let filtersOverride: Webgl2RendererCanvasFilter[] | undefined;
        if (options?.filters) {
            filtersOverride = await createCanvasFiltersFromLayerConfig(options.filters);
        }

        const snapshotCamera = new OrthographicCamera(0, imageWidth, 0, imageHeight, 0.1, 10000);
        snapshotCamera.position.z = 1;
        snapshotCamera.updateProjectionMatrix();
        if (options?.cameraTransform) {
            const t = options.cameraTransform;
            snapshotCamera.projectionMatrix.multiply(
                new Matrix4(
                    t[0], t[4], t[8], t[12],
                    t[1], t[5], t[9], t[13],
                    t[2], t[6], t[10], t[14],
                    t[3], t[7], t[11], t[15],
                )
            )
        }
        if (!options?.disableScaleToSize) {
            snapshotCamera.projectionMatrix.scale(
                new Vector3(imageWidth / this.imageWidth, imageHeight / this.imageHeight, 1)
            );
        }

        const snapshotRenderTarget = new WebGLRenderTarget(imageWidth, imageHeight, {
            type: UnsignedByteType,
            minFilter: LinearFilter,
            magFilter: LinearFilter,
            format: RGBAFormat,
            depthBuffer: false,
            colorSpace: SRGBColorSpace,
            stencilBuffer: false,
        });

        this.rendererBusy = true;

        try {

            this.renderer.setViewport(0, 0, imageWidth, imageHeight);

            if (!this.snapshotComposer) {
                this.snapshotComposer = new EffectComposer(this.renderer, snapshotRenderTarget);
            } else {
                this.snapshotComposer.reset(snapshotRenderTarget);
                this.snapshotComposer.setSize(imageWidth, imageHeight);
            }

            const selectionMaskWasVisible = !!(this.selectionMask?.visible);
            if (this.selectionMask) {
                if (options?.applySelectionMask) {
                    this.selectionMask.visible = true;    
                    this.selectionMask.setCamera(snapshotCamera);
                    this.selectionMask.useClipping(true);
                } else {
                    this.selectionMask.visible = false;
                }
            }

            const imageBoundaryMaskWasVisible = !!(this.imageBoundaryMask?.visible);
            if (this.imageBoundaryMask) {
                this.imageBoundaryMask.visible = false;
            }

            if (options?.layerIds) {
                for (const layerId of options.layerIds) {
                    const meshController = this.meshControllersById.get(layerId);
                    meshController?.overrideVisibility(true);
                    if (filtersOverride) {
                        await meshController?.overrideFilters(filtersOverride);
                    }
                }
            }

            this.createLayerPasses(this.snapshotComposer, snapshotCamera, options?.layerIds);
            this.snapshotComposer.renderToScreen = false;

            this.snapshotComposer.render();

            if (this.selectionMask) {
                this.selectionMask.visible = selectionMaskWasVisible;
                if (options?.applySelectionMask) {
                    this.selectionMask.setCamera(this.camera);
                    this.selectionMask.useClipping(false);
                }
            }
            if (imageBoundaryMaskWasVisible && this.imageBoundaryMask) {
                this.imageBoundaryMask.visible = true;
            }

            if (options?.layerIds) {
                for (const layerId of options.layerIds) {
                    const meshController = this.meshControllersById.get(layerId);
                    meshController?.overrideVisibility(undefined);
                    if (filtersOverride) {
                        meshController?.overrideFilters(undefined);
                    }
                }
            }

            this.createLayerPasses();
        } catch (error) {
            console.error('[renderers/webgl2/backend/renderer] Error taking snapshot. ', error);
        }

        this.renderer.setViewport(this.viewport);

        this.rendererBusy = false;

        const buffer = new Uint8Array(imageWidth * imageHeight * 4);
        await this.renderer.readRenderTargetPixelsAsync(snapshotRenderTarget, 0, 0, imageWidth, imageHeight, buffer);

        const bitmap = await createImageBitmap(
            new ImageData(new Uint8ClampedArray(buffer), imageWidth, imageHeight),
            { imageOrientation: 'flipY' }
        );

        snapshotRenderTarget.dispose();

        return bitmap;
    }

    async startBrushStroke(
        settings: RendererBrushStrokeSettings,
    ) {
        const meshController = this.meshControllersById.get(settings.layerId);
        if (!meshController) return;
        const texture = await meshController.getTexture(true);
        if (!texture) return;
        const transform = meshController.getTransform();

        this.compositorBrushStrokes.set(settings.layerId,
            this.compositor.startBrushStroke(
                texture,
                transform,
                settings,
            )
        );
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
        const brushStrokeId = this.compositorBrushStrokes.get(layerId);
        if (brushStrokeId == null) return;

        this.compositor.moveBrushStroke(brushStrokeId, x, y, size, density, colorBlendingStrength, concentration);
    }

    async stopBrushStroke(
        layerId: number,
    ): Promise<RendererTextureTile[]> {
        const brushStrokeId = this.compositorBrushStrokes.get(layerId);
        if (brushStrokeId == null) return [];

        return this.compositor.stopBrushStroke(brushStrokeId);
    }

    async createBrushPreview(
        settings: RendererBrushStrokePreviewsettings,
    ): Promise<ImageBitmap> {
        return await this.compositor.createBrushPreview(settings);
    }

    async setDirty() {
        this.dirty = true;
    }

    async dispose() {
        this.composer?.dispose();
        this.imageBackground?.dispose();
        this.imageBoundaryMask?.dispose();
        this.renderer?.dispose();
        this.selectionMask?.dispose();

        (this.composer as any) = undefined;
        (this.imageBackground as any) = undefined;
        (this.imageBoundaryMask as any) = undefined;
        (this.renderer as any) = undefined;
        (this.selectionMask as any) = undefined;
    }
}

let rendererBackendInstance: Webgl2RendererBackend | undefined;

export function getWebgl2RendererBackend(): Webgl2RendererBackend {
    if (!rendererBackendInstance) {
        rendererBackendInstance = new Webgl2RendererBackend();
    }
    return rendererBackendInstance;
}

export function disposeWebgl2RendererBackend() {
    if (rendererBackendInstance) {
        rendererBackendInstance.dispose();
    }
    rendererBackendInstance = undefined;
}
