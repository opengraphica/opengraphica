/**
 * This file constructs the necessary assets to render a raster layer.
 * It can run in the main thread or a worker.
 */

import { CanvasTexture } from 'three/src/textures/CanvasTexture';
import { ImagePlaneGeometry } from '@/renderers/webgl2/geometries/image-plane-geometry';
import { Matrix4 } from 'three/src/math/Matrix4';
import { Mesh } from 'three/src/objects/Mesh';
import { Texture } from 'three/src/textures/Texture';
import { Vector2 } from 'three/src/math/Vector2';

import { createCanvasTexture, getWebgl2RendererBackend, markRenderDirty, requestFrontendBitmap } from '@/renderers/webgl2/backend';
import { messageBus } from '@/renderers/webgl2/backend/message-bus';
import { createCanvasFiltersFromLayerConfig } from '../base/material';
import { assignMaterialBlendingMode } from '../base/blending-mode';
import { createRasterMaterial, disposeRasterMaterial, updateRasterMaterial } from '../raster/material';

import type { Scene, ShaderMaterial } from 'three';
import type {
    Webgl2RendererCanvasFilter, Webgl2RendererMeshController,
    WorkingFileLayerBlendingMode, WorkingFileRasterSequenceLayer, WorkingFileLayerFilter,
    WorkingFileRasterSequenceLayerFrame
} from '@/types';

export class RasterSequenceLayerMeshController implements Webgl2RendererMeshController {
    
    material: InstanceType<typeof ShaderMaterial> | undefined;
    plane: InstanceType<typeof Mesh> | undefined;
    planeGeometry: InstanceType<typeof ImagePlaneGeometry> | undefined;
    scene: InstanceType<typeof Scene> | undefined;
    sourceTexture: InstanceType<typeof Texture> | undefined;
    sourceTextureCanvas: InstanceType<typeof HTMLCanvasElement | typeof OffscreenCanvas> | undefined;
    sourceTextureCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | undefined;

    requestedSourceUuids = new Set<string>();
    sourceBitmaps = new Map<string, ImageBitmap>();
    lastDrawnSourceUuid: string = '';

    id: number = -1;
    blendingMode: WorkingFileLayerBlendingMode = 'normal';
    data: WorkingFileRasterSequenceLayer['data'] | undefined = undefined;
    filters: Webgl2RendererCanvasFilter[] = [];
    filtersOverride: Webgl2RendererCanvasFilter[] | undefined = undefined;
    sourceUuid: string | undefined;
    tileUpdateId: string | undefined;
    visible: boolean = true;
    visibleOverride: boolean | undefined = undefined;

    materialUpdates: Array<'destroyAndCreate' | 'update'> = [];
    regenerateThumbnailTimeoutHandle: number | undefined;

    attach(id: number) {
        this.id = id;
        const backend = getWebgl2RendererBackend();
        backend.addMeshController(id, this);
        this.scene = backend.scene;
        this.plane = new Mesh(undefined, undefined);
        this.plane.matrixAutoUpdate = false;
        this.scene.add(this.plane);

        if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
            this.sourceTextureCanvas = new OffscreenCanvas(10, 10);
        } else {
            this.sourceTextureCanvas = document.createElement('canvas');
            this.sourceTextureCanvas.width = 256;
            this.sourceTextureCanvas.height = 256;
        }
        this.sourceTextureCtx = this.sourceTextureCanvas.getContext('2d') || undefined;
        if (this.sourceTextureCtx) {
            this.sourceTextureCtx.imageSmoothingEnabled = false;
        }
        this.sourceTexture = createCanvasTexture(this.sourceTextureCanvas);

        this.beforeRender = this.beforeRender.bind(this);
        backend.registerBeforeRenderCallback(this.beforeRender);

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
                    });
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

    async updateData(data: WorkingFileRasterSequenceLayer['data']) {
        this.data = data;
        await this.scheduleMaterialUpdate('update');
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

    beforeRender(timelineCursor: number) {
        if (!this.data || !this.sourceTextureCtx) return;

        // TODO - find the current frame in a way that doesn't potentially loop through all frames.
        let currentFrame: WorkingFileRasterSequenceLayerFrame | undefined;
        for (let frame of this.data.sequence) {
            if (timelineCursor >= frame.start && timelineCursor < frame.end) {
                currentFrame = frame;
                break;
            }
        }
        if (!currentFrame?.image?.sourceUuid) return;

        const sourceUuid = currentFrame.image.sourceUuid;
        if (!this.sourceBitmaps.has(sourceUuid) && !this.requestedSourceUuids.has(sourceUuid)) {
            this.requestedSourceUuids.add(sourceUuid);
            requestFrontendBitmap(sourceUuid).then((bitmap) => {
                this.requestedSourceUuids.delete(sourceUuid);
                if (bitmap) {
                    this.sourceBitmaps.set(sourceUuid, bitmap);
                    if (this.sourceTextureCanvas && this.sourceTexture) {
                        if (this.sourceTextureCanvas.width !== bitmap.width || this.sourceTextureCanvas.height !== bitmap.height) {
                            this.sourceTextureCanvas.width = bitmap.width;
                            this.sourceTextureCanvas.height = bitmap.height;
                            this.sourceTexture?.dispose();
                            this.sourceTexture = createCanvasTexture(this.sourceTextureCanvas);
                        }
                    }
                }
            });
        }
        if (this.lastDrawnSourceUuid !== currentFrame.image.sourceUuid) {
            const bitmap = this.sourceBitmaps.get(sourceUuid);
            if (bitmap && this.sourceTexture) {
                this.sourceTextureCtx.save();
                this.sourceTextureCtx.translate(0, bitmap.height / 2);
                this.sourceTextureCtx.scale(1, -1);
                this.sourceTextureCtx.translate(0, -bitmap.height / 2);
                this.sourceTextureCtx.drawImage(bitmap, 0, 0);
                this.sourceTextureCtx.restore();
                this.lastDrawnSourceUuid = currentFrame.image.sourceUuid;
                this.sourceTexture.needsUpdate = true;
            }
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
        backend.unregisterBeforeRenderCallback(this.beforeRender);

        messageBus.off('renderer.pass.readBufferTextureUpdate', this.readBufferTextureUpdate);

        this.requestedSourceUuids.clear();
        for (const bitmap of this.sourceBitmaps.values()) {
            bitmap.close();
        }
        this.sourceBitmaps.clear();
        this.lastDrawnSourceUuid = '';

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
