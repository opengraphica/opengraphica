/**
 * This file constructs the necessary assets to render a raster layer.
 * It can run in the main thread or a worker.
 */

import { ImagePlaneGeometry } from '@/renderers/webgl2/geometries/image-plane-geometry';
import { Matrix4 } from 'three/src/math/Matrix4';
import { Mesh } from 'three/src/objects/Mesh';
import { Quaternion } from 'three/src/math/Quaternion';
import { Texture } from 'three/src/textures/Texture';
import { Vector3 } from 'three/src/math/Vector3';

import { throttle } from '@/lib/timing';

import { getWebgl2RendererBackend, markRenderDirty, requestFrontendSvg } from '@/renderers/webgl2/backend';
import { messageBus } from '@/renderers/webgl2/backend/message-bus';
import { createCanvasFiltersFromLayerConfig } from '../base/material';
import { assignMaterialBlendingMode } from '../base/blending-mode';
import { createRasterMaterial, disposeRasterMaterial, updateRasterMaterial } from '../raster/material';

import type { Scene, ShaderMaterial } from 'three';
import type {
    Webgl2RendererCanvasFilter, Webgl2RendererMeshController,
    WorkingFileLayerBlendingMode, WorkingFileVectorLayer, WorkingFileLayerFilter
} from '@/types';

const epsilon = 0.000001;

export class VectorLayerMeshController implements Webgl2RendererMeshController {
    
    material: InstanceType<typeof ShaderMaterial> | undefined;
    plane: InstanceType<typeof Mesh> | undefined;
    planeGeometry: InstanceType<typeof ImagePlaneGeometry> | undefined;
    scene: InstanceType<typeof Scene> | undefined;
    sourceSvg: Blob | undefined;
    sourceTexture: InstanceType<typeof Texture> | undefined;

    id: number = -1;
    blendingMode: WorkingFileLayerBlendingMode = 'normal';
    filters: Webgl2RendererCanvasFilter[] = [];
    filtersOverride: Webgl2RendererCanvasFilter[] | undefined = undefined;
    height: number = 0;
    sourceUuid: string | undefined;
    tileUpdateId: string | undefined;
    visible: boolean = true;
    visibleOverride: boolean | undefined = undefined;
    width: number = 0;

    lastResizeScaledWidth: number = 0;
    lastResizeScaledHeight: number = 0;

    materialUpdates: Array<'destroyAndCreate' | 'update'> = [];
    regenerateThumbnailTimeoutHandle: number | undefined;

    handleResize: (() => void);

    constructor() {
        this.handleResize = throttle(() => {
            this.generateSvgTexture();
        }, 500);
    }

    attach(id: number) {
        this.id = id;
        const backend = getWebgl2RendererBackend();
        backend.addMeshController(id, this);
        this.scene = backend.scene;
        this.plane = new Mesh(undefined, undefined);
        this.plane.matrixAutoUpdate = false;
        this.scene.add(this.plane);

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
            while (this.materialUpdates.length > 0) {
                const updateType = this.materialUpdates[this.materialUpdates.length - 1];
                if (!updateType) break;
                if (updateType === 'destroyAndCreate') {
                    if (this.material) {
                        await disposeRasterMaterial(this.material);
                    }
                }
                if (!this.material || updateType === 'destroyAndCreate') {
                    this.material = await createRasterMaterial({
                        srcTexture: this.sourceTexture,
                        canvasFilters: this.filtersOverride ?? this.filters,
                    });
                    assignMaterialBlendingMode(this.material, this.blendingMode);
                } else {
                    await updateRasterMaterial(this.material, {
                        srcTexture: this.sourceTexture,
                    })
                }
                this.plane && (this.plane.material = this.material);
                this.materialUpdates.pop();
                if (this.materialUpdates.length < 1) {
                    markRenderDirty();
                    this.queueRegenerateThumbnail();
                }
            }
        }
    }

    updateBlendingMode(blendingMode: WorkingFileLayerBlendingMode) {
        if (blendingMode !== this.blendingMode) {
            this.blendingMode = blendingMode;
            this.scheduleMaterialUpdate('destroyAndCreate');
        }
    }

    async updateData(data: WorkingFileVectorLayer['data']) {
        this.sourceUuid = data.sourceUuid;
        this.generateSvgTexture();
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
        this.handleResize?.();
    }

    updateTransform(transform: Float64Array) {
        this.plane?.matrix.set(
            transform[0], transform[1], transform[2], transform[3],
            transform[4], transform[5], transform[6], transform[7],
            transform[8], transform[9], transform[10], transform[11], 
            transform[12], transform[13], transform[14], transform[15],
        );
        markRenderDirty();
        this.handleResize?.();
    }

    updateVisible(visible: boolean) {
        this.visible = visible;
        let oldVisibility = this.plane?.visible;
        this.plane && (this.plane.visible = this.visibleOverride ?? this.visible);
        if (this.plane?.visible !== oldVisibility) {
            markRenderDirty();
        }
    }

    async generateSvgTexture() {
        if (this.sourceUuid && this.plane) {
            let scale = new Vector3();
            this.plane.matrix.decompose(new Vector3(), new Quaternion(), scale);
            const scaledWidth = scale.x * this.width;
            const scaledHeight = scale.y * this.height;
            if (
                Math.abs(scaledWidth - this.lastResizeScaledWidth) <= epsilon
                && Math.abs(scaledHeight - this.lastResizeScaledHeight) <= epsilon) {
                return;
            }

            this.lastResizeScaledWidth = scaledWidth;
            this.lastResizeScaledHeight = scaledHeight;

            const sourceTexture = await requestFrontendSvg(
                this.sourceUuid, scaledWidth, scaledHeight,
            );
            this.disposeSourceTexture();
            this.sourceTexture = sourceTexture;

            this.scheduleMaterialUpdate('update');
        } else {
            this.disposeSourceTexture();
            this.scheduleMaterialUpdate('update');
        }
    }

    reorder(order: number) {
        if (this.plane) {
            this.plane.renderOrder = order + 0.1;
        }
    }

    getTexture() {
        return Promise.resolve(this.sourceTexture ?? null);
    }

    getTransform() {
        return this.plane?.matrix ?? new Matrix4();
    }
    
    swapScene(scene: Scene) {
        if (!this.plane) return;
        this.scene?.remove(this.plane);
        scene.add(this.plane);
        this.scene = scene;
    }

    async overrideFilters(filters?: Webgl2RendererCanvasFilter[]) {
        this.filtersOverride = filters;
        await this.scheduleMaterialUpdate('destroyAndCreate');
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

        if (this.material) {
            disposeRasterMaterial(this.material);
            this.material = undefined;
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
