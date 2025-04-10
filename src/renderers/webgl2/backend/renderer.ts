import { SRGBColorSpace } from 'three/src/constants';
import { WebGLRenderer } from 'three/src/renderers/WebGLRenderer';
import { Scene } from 'three/src/scenes/Scene';
import { OrthographicCamera } from 'three/src/cameras/OrthographicCamera';
import { Matrix4 } from 'three/src/math/Matrix4';

import { EffectComposer } from './postprocessing/effect-composer';
import { GammaCorrectionShader } from './postprocessing/gamma-correction-shader';
import { RenderPass } from './postprocessing/render-pass';
import { ShaderPass } from './postprocessing/shader-pass';

import { ImageBackground } from './image-background';
import { ImageBoundaryMask } from './image-boundary-mask';
import { SelectionMask } from './selection-mask';
import { messageBus } from './message-bus';

import type { Camera } from 'three';
import type { RendererMeshController, WorkingFileLayer, WorkingFileGroupLayer } from '@/types';

const noRenderPassModes = new Set(['normal', 'erase']);

function createCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
    if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
        return new OffscreenCanvas(width, height);
    } else {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }
}

export interface Webgl2RendererBackendTakeSnapshotOptions {
    cameraTransform?: Float64Array;
    layerIds?: Uint32Array;
}

export class Webgl2RendererBackend {
    dirty: boolean = false;

    camera!: OrthographicCamera;
    composer!: EffectComposer;
    imageBackground!: ImageBackground;
    imageBoundaryMask!: ImageBoundaryMask;
    renderer!: WebGLRenderer;
    scene!: Scene;
    selectionMask!: SelectionMask;

    snapshotCanvas?: HTMLCanvasElement | OffscreenCanvas;
    snapshotComposer?: EffectComposer;
    snapshotRenderer?: WebGLRenderer;

    maxTextureSize: number = 2048;
    viewTransform: Matrix4 = new Matrix4();

    layerOrder: WorkingFileLayer[] = [];
    meshControllersById: Map<number, RendererMeshController> = new Map();

    async initialize(canvas: HTMLCanvasElement | OffscreenCanvas, imageWidth: number, imageHeight: number, viewWidth: number, viewHeight: number) {
        this.renderer = new WebGLRenderer({
            alpha: true,
            canvas,
            premultipliedAlpha: false,
            powerPreference: 'high-performance'
        });
        this.renderer.outputColorSpace = SRGBColorSpace;
        this.renderer.setSize(1, 1);
        this.maxTextureSize = this.renderer?.capabilities?.maxTextureSize ?? 2048;

        this.scene = new Scene();
        this.scene.background = null;

        this.camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10000);
        this.camera.matrixAutoUpdate = false;

        this.imageBackground = new ImageBackground();
        await this.imageBackground.initialize(this.scene, imageWidth, imageHeight);

        this.imageBoundaryMask = new ImageBoundaryMask();
        await this.imageBoundaryMask.initialize(this.scene, viewWidth, viewHeight);

        this.selectionMask = new SelectionMask();
        await this.selectionMask.initialize(this.camera, this.scene, viewWidth, viewHeight);

        this.composer = new EffectComposer(this.renderer);
        this.createLayerPasses();

        await this.resize(imageWidth, imageHeight, viewWidth, viewHeight);

        this.render();
    }

    async resize(imageWidth: number, imageHeight: number, viewWidth: number, viewHeight: number) {
        if (this.renderer) {
            this.renderer.setSize(viewWidth, viewHeight, true);
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
        if (this.imageBackground) {
            this.imageBackground.resize(imageWidth, imageHeight);
        }
        if (this.imageBoundaryMask) {
            this.imageBoundaryMask.resize(imageWidth, imageHeight);
        }
        this.dirty = true;
    }

    enableImageBoundaryMask(enabled: boolean) {
        if (!this.imageBoundaryMask) return;
        this.imageBoundaryMask.enable(enabled);
        this.dirty = true;
    }

    setBackgroundColor(r: number, g: number, b: number, alpha: number) {
        if (!this.imageBackground) return;
        this.imageBackground.setColor(r, g, b, alpha);
        this.dirty = true;
    }

    setViewTransform(transform: Float64Array) {
        this.viewTransform.set(
            transform[0], transform[1], transform[2], transform[3],
            transform[4], transform[5], transform[6], transform[7],
            transform[8], transform[9], transform[10], transform[11], 
            transform[12], transform[13], transform[14], transform[15],
        );
        this.dirty = true;
    }

    addMeshController(id: number, controller: RendererMeshController) {
        this.meshControllersById.set(id, controller);
    }

    removeMeshController(id: number) {
        this.meshControllersById.delete(id);
    }

    setLayerOrder(layerOrder: WorkingFileLayer[]) {
        this.layerOrder = layerOrder;
        this.createLayerPasses();
    }

    createLayerPasses(composer?: EffectComposer, camera?: Camera, includeLayerIds?: Uint32Array) {
        composer = composer ?? this.composer;
        camera = camera ?? this.camera;

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
                if (!noRenderPassModes.has(layer.blendingMode)) {
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
    
        // composer.addPass(new ShaderPass(GammaCorrectionShader));
        this.dirty = true;
    }

    render() {
        if (!this.camera) return;

        this.camera.matrix = this.viewTransform.clone().invert().multiply(new Matrix4().makeTranslation(0, 0, 1));
        this.camera.updateMatrixWorld(true);
        this.camera.updateProjectionMatrix();

        this.composer.render();

        this.dirty = false;
        messageBus.emit('renderer.renderComplete');
    }

    async takeSnapshot(
        imageWidth: number, imageHeight: number, options?: Webgl2RendererBackendTakeSnapshotOptions
    ): Promise<ImageBitmap> {

        const snapshotCamera = new OrthographicCamera(0, imageWidth, 0, imageHeight, 0.1, 10000);
        snapshotCamera.position.z = 1;
        snapshotCamera.updateProjectionMatrix();
        if (options?.cameraTransform) {
            const t = options.cameraTransform;
            snapshotCamera.projectionMatrix.multiply(
                new Matrix4(
                    t[0], t[1], t[2], t[3],
                    t[4], t[5], t[6], t[7],
                    t[8], t[9], t[10], t[11],
                    t[12], t[13], t[14], t[15],
                )
            )
        }

        if (!this.snapshotCanvas) {
            this.snapshotCanvas = createCanvas(imageWidth, imageHeight);
        }

        if (!this.snapshotRenderer) {
            this.snapshotRenderer = new WebGLRenderer({
                alpha: true,
                canvas: this.snapshotCanvas,
                premultipliedAlpha: false,
                preserveDrawingBuffer: true,
                powerPreference: 'high-performance'
            });
            this.snapshotRenderer.setClearColor(0x000000, 0);
            this.snapshotRenderer.outputColorSpace = SRGBColorSpace;
        }
        this.snapshotRenderer.setSize(imageWidth, imageHeight);

        if (!this.snapshotComposer) {
            this.snapshotComposer = new EffectComposer(this.snapshotRenderer);
        }
        this.createLayerPasses(this.snapshotComposer, snapshotCamera, options?.layerIds);

        const selectionMaskWasVisible = !!(this.selectionMask?.visible);
        if (this.selectionMask) {
            this.selectionMask.visible = false;
        }

        this.snapshotComposer.render();

        if (selectionMaskWasVisible && this.selectionMask) {
            this.selectionMask.visible = true;
        }

        this.createLayerPasses();

        if (window.OffscreenCanvas && this.snapshotCanvas instanceof window.OffscreenCanvas) {
            return this.snapshotCanvas.transferToImageBitmap();
        } else {
            return createImageBitmap(this.snapshotCanvas, 0, 0, imageWidth, imageHeight, { imageOrientation: 'none' });
        }
    }

    dispose() {
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
    if (!rendererBackendInstance?.composer) {
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
