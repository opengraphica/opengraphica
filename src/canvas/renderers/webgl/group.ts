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

import { createFiltersFromLayerConfig, combineShaders } from '../../filters';
import { createRasterShaderMaterial } from './shaders';
import { assignMaterialBlendModes } from './blending';

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
    private material: InstanceType<typeof ShaderMaterial> | undefined;
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
        await this.recreateMaterial(null, layer.filters);
        this.plane = new Mesh(this.planeGeometry, this.material);
        this.plane.renderOrder = this.order;
        this.plane.matrixAutoUpdate = false;
        (this.threejsScene ?? canvasStore.get('threejsScene'))?.add(this.plane);
        this.childrenScene = new Scene();

        await this.updateChildrenLayerScene(layer.layers, []);

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
            this.lastBlendingMode = updates.blendingMode;
            if (this.material) {
                assignMaterialBlendModes(this.material, updates.blendingMode);
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
            await this.recreateMaterial(this.groupRenderTarget?.texture ?? null, updates.filters);
            this.plane && this.material && (this.plane.material = this.material);
        }
    }

    onRenderGroup(renderer: WebGLRenderer, camera: Camera, layer: WorkingFileGroupLayer<ColorModel>): void {
        for (const childLayer of layer.layers) {
            if (childLayer.type === 'group') {
                childLayer.renderer.renderGroup(renderer, camera, childLayer);
            }
        }
        if (this.groupRenderTarget && this.childrenScene && this.camera) {
            renderer.setRenderTarget(this.groupRenderTarget);
            renderer.render(this.childrenScene, this.camera);
            this.recreateMaterial(this.groupRenderTarget.texture, layer.filters);
            this.plane && this.material && (this.plane.material = this.material);
            renderer.setRenderTarget(null);
        }
    }

    onDetach(): void {
        // Clean up old stuff
        this.camera = undefined;
        this.groupRenderTarget?.dispose();
        this.groupRenderTarget = undefined;
        this.plane && (this.threejsScene ?? canvasStore.get('threejsScene'))?.remove(this.plane);
        this.plane = undefined;
        this.planeGeometry?.dispose();
        this.planeGeometry = undefined;
        this.material?.dispose();
        this.material = undefined;
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

    private async recreateMaterial(texture: Texture | null, filters: WorkingFileLayerFilter[]) {
        if (texture) {
            texture.encoding = LinearEncoding;
        }
        const combinedShaderResult = combineShaders(
            await createFiltersFromLayerConfig(filters),
            { width: workingFileStore.state.width, height: workingFileStore.state.height }
        );
        this.material?.dispose();
        this.material = createRasterShaderMaterial(texture, combinedShaderResult);
        assignMaterialBlendModes(this.material, this.lastBlendingMode);
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
}
