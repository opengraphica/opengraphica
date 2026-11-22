/**
 * This file constructs the necessary assets to render a raster layer.
 * It can run in the main thread or a worker.
 */

import { ImagePlaneGeometry } from '@/renderers/webgl2/geometries/image-plane-geometry';
import { OrthographicCamera } from 'three/src/cameras/OrthographicCamera';
import { Matrix4 } from 'three/src/math/Matrix4';
import { Mesh } from 'three/src/objects/Mesh';
import { Scene } from 'three/src/scenes/Scene';
import { Texture } from 'three/src/textures/Texture';
import { Vector2 } from 'three/src/math/Vector2';
import { Vector4 } from 'three/src/math/Vector4';

import { getWebgl2RendererBackend, markRenderDirty, requestFrontendTexture } from '@/renderers/webgl2/backend';
import { messageBus } from '@/renderers/webgl2/backend/message-bus';
import { createCanvasFiltersFromLayerConfig, createLayerShaderUniformsAndDefines } from '../base/material';
import { assignMaterialBlendingMode } from '../base/blending-mode';
import { createRasterMaterials, disposeRasterMaterials, updateRasterMaterials } from './material';

import type { ShaderMaterial } from 'three';
import type {
    Webgl2RendererCanvasFilter, Webgl2RendererMeshController,
    WorkingFileLayerBlendingMode, WorkingFileRasterLayer, WorkingFileLayerFilter
} from '@/types';

export class RasterLayerMeshController implements Webgl2RendererMeshController {
    
    /** @deprecated use materials */
    material: InstanceType<typeof ShaderMaterial> | undefined;
    materials: InstanceType<typeof ShaderMaterial>[] = [];
    plane: InstanceType<typeof Mesh> | undefined;
    prepassPlane: InstanceType<typeof Mesh> | undefined;
    planeGeometry: InstanceType<typeof ImagePlaneGeometry> | undefined;
    scene: InstanceType<typeof Scene> | undefined;
    prepassScene: InstanceType<typeof Scene> | undefined;
    prepassCamera: InstanceType<typeof OrthographicCamera> | undefined;
    sourceTexture: InstanceType<typeof Texture<any>> | undefined;
    draftTexture: InstanceType<typeof Texture<any>> | undefined;

    id: number = -1;
    blendingMode: WorkingFileLayerBlendingMode = 'normal';
    opacity: number = 1;
    filters: Array<Webgl2RendererCanvasFilter | null> = [];
    filtersOverride: Array<Webgl2RendererCanvasFilter | null> | undefined = undefined;
    height: number = 0;
    sourceUuid: string | undefined;
    tileUpdateId: string | undefined;
    visible: boolean = true;
    visibleOverride: boolean | undefined = undefined;
    width: number = 0;

    isHalfFloat: boolean = false;
    materialUpdates: Array<'destroyAndCreate' | 'update'> = [];
    regenerateThumbnailTimeoutHandle: number | undefined;
    isRequestingSourceTexture: boolean = false;
    sourceTextureFetchCallbacks: Array<(texture: Texture | null) => void> = [];
    overrideFilterParamTextures: Texture<any>[] = [];

    attach(id: number) {
        this.id = id;
        const backend = getWebgl2RendererBackend();
        backend.addMeshController(id, this);
        this.scene = backend.scene;
        this.plane = new Mesh(undefined, undefined);
        this.plane.matrixAutoUpdate = false;
        this.scene.add(this.plane);

        const gl = backend.renderer.getContext();
        this.isHalfFloat = !!(
            (backend.renderer.capabilities.isWebGL2 || gl.getExtension('OES_texture_half_float'))
        );

        this.beforeRender = this.beforeRender.bind(this);
        this.plane.onBeforeRender = this.beforeRender;

        this.readBufferTextureUpdate = this.readBufferTextureUpdate.bind(this);
        messageBus.on('renderer.pass.readBufferTextureUpdate', this.readBufferTextureUpdate);
    }

    queueRegenerateThumbnail() {
        clearTimeout(this.regenerateThumbnailTimeoutHandle);
        this.regenerateThumbnailTimeoutHandle = setTimeout(this.regenerateThumbnail.bind(this), 25);
    }
    regenerateThumbnail() {
        messageBus.emit('layer.regenerateThumbnail', this.id);
    }

    async scheduleMaterialUpdate(type: 'destroyAndCreate' | 'update') {
        if (
            (type === 'destroyAndCreate' && !this.materialUpdates.slice(0, -1).includes('destroyAndCreate')) ||
            (type === 'update' && !this.materialUpdates.slice(0, -1).includes('update'))
        ) {
            this.materialUpdates.unshift(type);
        }
        if (this.materialUpdates.length === 1) {
            this.disposeOverrideFilterParamTextures();

            while (this.materialUpdates.length > 0) {
                const updateType = this.materialUpdates[this.materialUpdates.length - 1];
                if (!updateType) break;
                if (updateType === 'destroyAndCreate') {
                    if (this.materials.length > 0) {
                        await disposeRasterMaterials(this.materials);
                    }
                }
                if (this.materials.length === 0 || updateType === 'destroyAndCreate') {
                    this.materials = await createRasterMaterials({
                        srcTexture: this.draftTexture ?? this.sourceTexture,
                        canvasFilters: this.filtersOverride ?? this.filters,
                        opacity: this.opacity,
                        isHalfFloat: this.isHalfFloat,
                    });
                    if (this.materials.length > 1) {
                        this.setupPrepass();
                    }
                    assignMaterialBlendingMode(this.materials[this.materials.length - 1], this.blendingMode);
                } else {
                    await updateRasterMaterials(this.materials, {
                        srcTexture: this.draftTexture ?? this.sourceTexture,
                        canvasFilters: this.filtersOverride ?? this.filters,
                        opacity: this.opacity,
                        isHalfFloat: this.isHalfFloat,
                    })
                }
                this.plane && (this.plane.material = this.materials[this.materials.length - 1]);
                this.materialUpdates.pop();
                if (this.materialUpdates.length < 1) {
                    markRenderDirty();
                    this.queueRegenerateThumbnail();
                }
            }
        }
    }

    setupPrepass() {
        if (
            !this.plane
            || !this.sourceTexture
        ) return;
        if (!this.prepassScene) {
            this.prepassScene = new Scene();
        }
        if (!this.prepassPlane) {
            this.prepassPlane = new Mesh(this.planeGeometry, undefined);
            this.prepassScene.add(this.prepassPlane);
        }
        if (!this.prepassCamera) {
            this.prepassCamera = new OrthographicCamera(0, this.sourceTexture.width, 0, this.sourceTexture.height, 0.1, 10000);
        }
        this.prepassCamera.right = this.sourceTexture.width;
        this.prepassCamera.bottom = this.sourceTexture.height;
        this.prepassCamera.position.z = 1;
        this.prepassCamera.updateProjectionMatrix();
    }

    beforeRender() {
        if (
            !this.plane
            || this.materials.length <= 1
            || !this.sourceTexture
            || !this.prepassScene
            || !this.prepassPlane
            || !this.prepassCamera
            || !this.scene
        ) return;
        const backend = getWebgl2RendererBackend();
        const originalRenderTarget = backend.renderer.getRenderTarget();
        const originalViewport = new Vector4();
        const originalAutoClear = backend.renderer.autoClear;
        backend.renderer.autoClear = true;
        backend.renderer.getViewport(originalViewport);
        backend.renderer.setViewport(0, 0, this.sourceTexture.width, this.sourceTexture.height);
        for (let [materialIndex, currentMaterial] of this.materials.entries()) {
            if (materialIndex > 0 && currentMaterial.uniforms.dstTexture) {
                currentMaterial.uniforms.dstTexture.value = this.sourceTexture;
            }
            if (materialIndex < this.materials.length - 1) {
                const nextMaterial = this.materials[materialIndex + 1];
                backend.renderer.setRenderTarget(nextMaterial.userData.srcRenderTarget);
                this.prepassPlane.material = currentMaterial;
                backend.renderer.render(this.prepassScene, this.prepassCamera);
            }
        }
        backend.renderer.autoClear = originalAutoClear;
        backend.renderer.setRenderTarget(originalRenderTarget);
        backend.renderer.setViewport(originalViewport);
    }

    updateBlendingMode(blendingMode: WorkingFileLayerBlendingMode) {
        if (blendingMode !== this.blendingMode) {
            this.blendingMode = blendingMode;
            this.scheduleMaterialUpdate('destroyAndCreate');
        }
    }

    updateOpacity(opacity: number) {
        if (opacity !== this.opacity) {
            this.opacity = opacity;
            this.scheduleMaterialUpdate('update');
        }
    }

    async updateData(data: WorkingFileRasterLayer['data']) {
        if (this.sourceTexture && data.tileUpdates) {
            if (data.tileUpdateId === this.tileUpdateId) return;
            const backend = getWebgl2RendererBackend();
            const tileTextures = await Promise.allSettled(
                data.tileUpdates.map((tileUpdate) => requestFrontendTexture(tileUpdate.sourceUuid))
            );
            for (const [updateIndex, tileUpdate] of data.tileUpdates.entries()) {
                const tileTexture = tileTextures[updateIndex].status === 'fulfilled' ? tileTextures[updateIndex].value : null;
                if (!tileTexture) continue;
                backend.renderer.copyTextureToTexture(
                    tileTexture,
                    this.sourceTexture,
                    null,
                    new Vector2(tileUpdate.x, this.sourceTexture.image.height - tileUpdate.y - tileTexture.image.height)
                );
                if (tileTexture.userData.shouldDisposeBitmap) {
                    tileTexture.image?.close();
                }
                tileTexture.dispose();
            }
            markRenderDirty();
            this.queueRegenerateThumbnail();
        } else {
            this.sourceUuid = data.sourceUuid;
            this.isRequestingSourceTexture = true;
            const sourceTexture = await requestFrontendTexture(data.sourceUuid)
            if (data.sourceUuid !== this.sourceUuid) {
                this.disposeSourceTexture();
                return;
            }
            if (sourceTexture) {
                this.disposeSourceTexture();
                this.sourceTexture = sourceTexture;
                this.sourceTexture.needsUpdate = true;
                this.isRequestingSourceTexture = false;
                if (this.materials.length > 1) {
                    this.setupPrepass();
                }
                for (const callback of this.sourceTextureFetchCallbacks) {
                    callback(this.sourceTexture);
                }
                await this.scheduleMaterialUpdate('update');
            } else {
                this.disposeSourceTexture();
                this.isRequestingSourceTexture = false;
                for (const callback of this.sourceTextureFetchCallbacks) {
                    callback(null);
                }
                await this.scheduleMaterialUpdate('update');
            }
        }
        this.tileUpdateId = data.tileUpdateId;
    }

    async updateFilters(filters: WorkingFileLayerFilter[]) {
        this.filters = await createCanvasFiltersFromLayerConfig(filters);
        await this.scheduleMaterialUpdate('destroyAndCreate');
    }

    updateName(name: string) {
        if (this.plane) {
            this.plane.name = name;
        }
    }

    updateSize(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.planeGeometry?.dispose();
        this.planeGeometry = new ImagePlaneGeometry(width, height);
        if (this.plane) {
            this.plane.geometry = this.planeGeometry;
        }
        markRenderDirty();
    }

    updateTransform(transform: Float64Array) {
        this.plane?.matrix.set(
            transform[0], transform[1], transform[2], transform[3],
            transform[4], transform[5], transform[6], transform[7],
            transform[8], transform[9], transform[10], transform[11], 
            transform[12], transform[13], transform[14], transform[15],
        );
        markRenderDirty();
    }

    updateVisible(visible: boolean) {
        this.visible = visible;
        let oldVisibility = this.plane?.visible;
        this.plane && (this.plane.visible = this.visibleOverride ?? this.visible);
        if (this.plane?.visible !== oldVisibility) {
            markRenderDirty();
        }
    }

    renderHighQuality(isHighQuality: boolean) {
        if (this.materials.length === 0) return;
        const highQualityFlag = isHighQuality ? 1 : 0;
        for (const material of this.materials) {
            if (material.defines.cHighQualityRender !== highQualityFlag) {
                material.defines.cHighQualityRender = highQualityFlag;
                material.needsUpdate = true;
            }
        }
    }

    reorder(order: number) {
        if (this.plane) {
            this.plane.renderOrder = order + 0.1;
        }
    }

    getLayerWidth() {
        return this.width;
    }

    getLayerHeight() {
        return this.height;
    }

    getTexture(wait?: boolean) {
        if (wait && this.isRequestingSourceTexture) {
            return new Promise<Texture | null>((resolve) => {
                this.sourceTextureFetchCallbacks.push(resolve)
            });
        } else {
            return Promise.resolve(this.sourceTexture ?? null);
        }
    }

    getTransform() {
        return this.plane?.matrix ?? new Matrix4();
    }

    setDraftTexture(texture?: Texture<any>) {
        if (texture !== this.draftTexture) {
            this.draftTexture?.dispose();
            this.draftTexture = undefined;
            if (texture) {
                texture.userData.isDraft = true;
                this.draftTexture = texture;
            }
            this.scheduleMaterialUpdate('update');
        }
    }
    
    swapScene(scene: Scene) {
        if (!this.plane) return;
        this.scene?.remove(this.plane);
        scene.add(this.plane);
        this.scene = scene;
    }

    async overrideFilters(filters?: Array<Webgl2RendererCanvasFilter | null>) {
        this.filtersOverride = filters;
        await this.scheduleMaterialUpdate('destroyAndCreate');
    }

    overrideFilterParams(filterIndex: number, params?: Record<string, any> | null) {
        if (params === null) {
            this.filtersOverride = this.filters?.map((filter, otherIndex) => {
                return filterIndex === otherIndex ? null : filter;
            });
            this.scheduleMaterialUpdate('destroyAndCreate');
            return;
        } else if (this.filtersOverride) {
            this.filtersOverride = undefined;
            this.scheduleMaterialUpdate('destroyAndCreate');
        }

        let needsDestroyAndCreate = false;

        if (this.filters[filterIndex]) {
            if (params != null) {
                this.filters[filterIndex].overrideParams = params;
                this.filters[filterIndex].overrideDisabled = false;
            } else if (params === undefined) {
                if (this.filters[filterIndex].overrideDisabled != null) {
                    needsDestroyAndCreate = true;
                }
                delete this.filters[filterIndex].overrideParams;
                delete this.filters[filterIndex].overrideDisabled;
            }
        }

        if (this.materials.length === 0) return;

        this.disposeOverrideFilterParamTextures();

        const { defines, uniforms, textures } = createLayerShaderUniformsAndDefines(
            this.sourceTexture?.width ?? 1,
            this.sourceTexture?.height ?? 1,
            this.filters,
        );
        this.overrideFilterParamTextures = textures;

        for (const material of this.materials) {
            for (const defineName in defines) {
                if (material.defines[defineName] !== defines[defineName]) {
                    material.defines[defineName] = defines[defineName];
                    needsDestroyAndCreate = true;
                }
            }
            for (const uniformName in uniforms) {
                material.uniforms[uniformName] = uniforms[uniformName];
            }
            material.uniformsNeedUpdate = true;
        }

        if (needsDestroyAndCreate) {
            this.scheduleMaterialUpdate('destroyAndCreate');
        }

        markRenderDirty();
    }

    disposeOverrideFilterParamTextures() {
        for (const texture of this.overrideFilterParamTextures) {
            texture.dispose();
        }
        this.overrideFilterParamTextures = [];
    }

    overrideVisibility(visible?: boolean) {
        this.visibleOverride = visible;
        this.updateVisible(this.visible);
    }

    readBufferTextureUpdate(texture?: Texture) {
        if (!this.material?.uniforms?.dstTexture) return;
        this.material.uniforms.dstTexture.value = texture;
        this.material.uniformsNeedUpdate = true;
    }
    
    detach() {
        const backend = getWebgl2RendererBackend();
        backend.removeMeshController(this.id);

        messageBus.off('renderer.pass.readBufferTextureUpdate', this.readBufferTextureUpdate);

        this.planeGeometry?.dispose();
        this.planeGeometry = undefined;

        this.plane && this.scene?.remove(this.plane);
        this.plane = undefined;

        this.prepassScene = undefined;

        if (this.materials.length > 0) {
            disposeRasterMaterials(this.materials);
            this.materials = [];
        }

        this.disposeSourceTexture();

        this.scene = undefined;
    }

    disposeSourceTexture() {
        if (this.sourceTexture) {
            if (this.sourceTexture.userData.shouldDisposeBitmap) {
                this.sourceTexture.image?.close();
            }
            this.sourceTexture.dispose();
            this.sourceTexture = undefined;
        }
    }

}
