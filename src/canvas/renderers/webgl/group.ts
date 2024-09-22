import { toRefs, watch, type WatchStopHandle, toRaw } from 'vue';
import canvasStore from '@/store/canvas';
import workingFileStore from '@/store/working-file';

import BaseLayerRenderer from './base';

import { OrthographicCamera } from 'three/src/cameras/OrthographicCamera';
import { ImagePlaneGeometry } from './geometries/image-plane-geometry';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import { Mesh } from 'three/src/objects/Mesh';
import { WebGLRenderTarget } from 'three/src/renderers/WebGLRenderTarget';
import { LinearFilter, NearestFilter, LinearEncoding } from 'three/src/constants';
import { Matrix4 } from 'three/src/math/Matrix4';
import { Scene } from 'three/src/scenes/Scene';

import { createFiltersFromLayerConfig, combineFiltersToShader } from '../../filters';
import { createMaterial, disposeMaterial, type MaterialWrapper, type MaterialWapperUpdates } from './materials';
import appEmitter from '@/lib/emitter';

import type { WorkingFileLayer, WorkingFileGroupLayer, WorkingFileLayerBlendingMode, WorkingFileLayerFilter, ColorModel } from '@/types';
import type { Camera, Texture, WebGLRenderer } from 'three';

export default class GroupLayerRenderer extends BaseLayerRenderer {

    private stopWatchBlendingMode: WatchStopHandle | undefined;
    private stopWatchVisible: WatchStopHandle | undefined;
    private stopWatchLayers: WatchStopHandle | undefined;
    private stopWatchFilters: WatchStopHandle | undefined;
    private stopWatchWorkingCanvasSize: WatchStopHandle | undefined;

    private groupRenderTarget: InstanceType<typeof WebGLRenderTarget> | undefined;
    private camera: InstanceType<typeof OrthographicCamera> | undefined;
    private materialWrapper: MaterialWrapper<MaterialWapperUpdates['raster']> | undefined;
    private planeGeometry: InstanceType<typeof ImagePlaneGeometry> | undefined;
    private plane: InstanceType<typeof Mesh> | undefined;
    private childrenScene: Scene | undefined;

    private lastBlendingMode: WorkingFileLayerBlendingMode = 'normal';

    async onAttach(layer: WorkingFileGroupLayer<ColorModel>) {
        
        this.camera = new OrthographicCamera(0, 0, workingFileStore.state.width, workingFileStore.state.height, 0.1, 1000);
        this.updateCameraDimensions(workingFileStore.state.width, workingFileStore.state.height);

        this.groupRenderTarget = new WebGLRenderTarget(
            workingFileStore.state.width,
            workingFileStore.state.height,
            { minFilter: LinearFilter, magFilter: NearestFilter }
        );
        this.planeGeometry = new ImagePlaneGeometry(workingFileStore.state.width, workingFileStore.state.height);
        await this.recreateMaterial(undefined, layer.filters);
        this.plane = new Mesh(this.planeGeometry, this.materialWrapper!.material);
        this.plane.renderOrder = this.order;
        this.plane.matrixAutoUpdate = false;
        (this.threejsScene ?? canvasStore.get('threejsScene'))?.add(this.plane);
        this.childrenScene = new Scene();

        await this.updateChildrenLayerScene(layer.layers, []);

        this.readBufferTextureUpdate = this.readBufferTextureUpdate.bind(this);
        appEmitter.on('renderer.pass.readBufferTextureUpdate', this.readBufferTextureUpdate);

        const { width, height } = toRefs(workingFileStore.state);
        const { blendingMode, visible, filters } = toRefs(layer);

        this.stopWatchBlendingMode = watch([blendingMode], ([blendingMode]) => {
            this.update({ blendingMode });
        }, { immediate: true });
        this.stopWatchVisible = watch([visible], ([visible]) => {
            this.update({ visible });
        }, { immediate: true });
        this.stopWatchLayers = watch(() => [...layer.layers], (newLayers, oldLayers) => {
            this.updateChildrenLayerScene(newLayers, oldLayers);
        }, { immediate: false });
        this.stopWatchFilters = watch([filters], async ([filters]) => {
            await createFiltersFromLayerConfig(filters);
            this.update({ filters });
        }, { deep: true, immediate: false });
        this.stopWatchWorkingCanvasSize = watch([width, height], ([width, height]) => {
            this.update({ width, height });
        }, { immediate: false });
    }

    onReorder(order: number) {
        if (this.plane) {
            this.plane.renderOrder = order;
        }
    }

    async onUpdate(updates: Partial<WorkingFileLayer<ColorModel>>) {
        if (updates.visible != null) {
            this.plane && (this.plane.visible = updates.visible);
        }
        if (updates.blendingMode) {
            if (updates.blendingMode !== this.lastBlendingMode) {
                this.lastBlendingMode = updates.blendingMode;
                if (this.materialWrapper) {
                    this.materialWrapper = this.materialWrapper.changeBlendingMode(updates.blendingMode);
                    this.plane && (this.plane.material = this.materialWrapper.material);
                }
            }
        }
        if (updates.width || updates.height) {
            const width = (updates.width || this.planeGeometry?.parameters.width) ?? 1;
            const height = (updates.height || this.planeGeometry?.parameters.height) ?? 1;
            this.updateCameraDimensions(width, height);
            this.planeGeometry?.dispose();
            this.planeGeometry = new ImagePlaneGeometry(width, height);
            if (this.plane) {
                this.plane.geometry = this.planeGeometry;
            }
        }
        if (updates.filters) {
            await this.recreateMaterial(this.groupRenderTarget?.texture, updates.filters);
        }
    }

    onRenderGroup(renderer: WebGLRenderer, camera: Camera, layer: WorkingFileGroupLayer<ColorModel>): void {
        // for (const childLayer of layer.layers) {
        //     if (childLayer.type === 'group') {
        //         childLayer.renderer.renderGroup(renderer, camera, childLayer);
        //     }
        // }
        // if (this.groupRenderTarget && this.childrenScene && this.camera) {
        //     renderer.setRenderTarget(this.groupRenderTarget);
        //     renderer.render(this.childrenScene, this.camera);
        //     this.recreateMaterial(this.groupRenderTarget.texture, layer.filters);
        //     renderer.setRenderTarget(null);
        // }
    }

    onDetach(): void {
        appEmitter.off('renderer.pass.readBufferTextureUpdate', this.readBufferTextureUpdate);

        // Clean up old stuff
        this.camera = undefined;
        this.groupRenderTarget?.dispose();
        this.groupRenderTarget = undefined;
        this.plane && (this.threejsScene ?? canvasStore.get('threejsScene'))?.remove(this.plane);
        this.plane = undefined;
        this.planeGeometry?.dispose();
        this.planeGeometry = undefined;
        if (this.materialWrapper) {
            disposeMaterial(this.materialWrapper);
        }
        this.childrenScene = undefined;
        this.stopWatchBlendingMode?.();
        this.stopWatchVisible?.();
        this.stopWatchLayers?.();
        this.stopWatchFilters?.();
        this.stopWatchWorkingCanvasSize?.();
    }

    private async updateChildrenLayerScene(layers: WorkingFileLayer<ColorModel>[], oldLayers: WorkingFileLayer<ColorModel>[]) {
        const childrenScene = this.childrenScene; // this.threejsScene ?? canvasStore.get('threejsScene');
        if (childrenScene) {
            for (const childLayer of layers) {
                if (childLayer.renderer.threejsScene != childrenScene) {
                    if (childLayer.renderer.isAttached) {
                        childLayer.renderer.detach();
                        childLayer.renderer.threejsScene = childrenScene;
                        await childLayer.renderer.attach(childLayer);
                    } else {
                        childLayer.renderer.threejsScene = childrenScene;
                    }
                }
            }
        }
    }

    private async recreateMaterial(texture: Texture | undefined, filters: WorkingFileLayerFilter[]) {
        if (texture) {
            texture.encoding = LinearEncoding;
        }
        if (this.materialWrapper) {
            disposeMaterial(this.materialWrapper);
        }
        this.materialWrapper = await createMaterial('raster', { srcTexture: texture }, filters, 
            { width: workingFileStore.state.width, height: workingFileStore.state.height },
            this.lastBlendingMode
        );
        if (texture) {
            this.plane && this.materialWrapper && (this.plane.material = this.materialWrapper.material);
        }
    }

    private updateCameraDimensions(width: number, height: number) {
        if (!this.camera) return;
        this.camera.top = 0;
        this.camera.left = 0;
        this.camera.right = width;
        this.camera.bottom = height;
        this.camera.matrixAutoUpdate = false;
        const cameraTransform = new DOMMatrix().inverse().translate(0, 0, 1);
        const matrix = new Matrix4();
        matrix.set(
            cameraTransform.m11, cameraTransform.m21, cameraTransform.m31, cameraTransform.m41,
            cameraTransform.m12, cameraTransform.m22, cameraTransform.m32, cameraTransform.m42,
            cameraTransform.m13, cameraTransform.m23, cameraTransform.m33, cameraTransform.m43,
            cameraTransform.m14, cameraTransform.m24, cameraTransform.m34, cameraTransform.m44
        );
        this.camera.matrix = matrix;
        this.camera.updateMatrixWorld(true);
        this.camera.updateProjectionMatrix();
    }

    private readBufferTextureUpdate(texture?: Texture) {
        if (!this.materialWrapper) return;
        this.materialWrapper.material.uniforms.dstTexture.value = texture;
        this.materialWrapper.material.uniformsNeedUpdate = true;
    }
}
