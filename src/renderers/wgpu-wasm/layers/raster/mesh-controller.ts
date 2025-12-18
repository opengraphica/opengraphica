/**
 * This file constructs the necessary assets to render a raster layer.
 * It can run in the main thread or a worker.
 */

import { getWgpuWasmRendererBackend, markRenderDirty, requestFrontendTextureImageData } from '@/renderers/wgpu-wasm/backend';
import { messageBus } from '@/renderers/wgpu-wasm/backend/message-bus';
// import { createCanvasFiltersFromLayerConfig } from '../base/material';
// import { assignMaterialBlendingMode } from '../base/blending-mode';
// import { createRasterMaterial, disposeRasterMaterial, updateRasterMaterial } from './material';

import { WasmRendererMeshControllerType } from '@/types/renderer';

import type {
    Webgl2RendererCanvasFilter, WgpuWasmRendererMeshController,
    WorkingFileLayerBlendingMode, WorkingFileRasterLayer, WorkingFileLayerFilter
} from '@/types';

export class RasterLayerMeshController implements WgpuWasmRendererMeshController {
    
    id: number = -1;
    blendingMode: WorkingFileLayerBlendingMode = 'normal';
    filters: Webgl2RendererCanvasFilter[] = [];
    filtersOverride: Webgl2RendererCanvasFilter[] | undefined = undefined;
    sourceUuid: string | undefined;
    tileUpdateId: string | undefined;
    visible: boolean = true;
    visibleOverride: boolean | undefined = undefined;
    lastComputedVisibility: boolean = true;

    materialUpdates: Array<'destroyAndCreate' | 'update'> = [];
    regenerateThumbnailTimeoutHandle: number | undefined;

    attach(id: number) {
        this.id = id;
        const backend = getWgpuWasmRendererBackend();
        backend.addMeshController(id, WasmRendererMeshControllerType.RASTER);

        // this.readBufferTextureUpdate = this.readBufferTextureUpdate.bind(this);
        // messageBus.on('renderer.pass.readBufferTextureUpdate', this.readBufferTextureUpdate);
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
                    // if (this.material) {
                    //     await disposeRasterMaterial(this.material);
                    // }
                }
                // if (!this.material || updateType === 'destroyAndCreate') {
                //     this.material = await createRasterMaterial({
                //         srcTexture: this.sourceTexture,
                //         canvasFilters: this.filtersOverride ?? this.filters,
                //     });
                //     assignMaterialBlendingMode(this.material, this.blendingMode);
                // } else {
                //     await updateRasterMaterial(this.material, {
                //         srcTexture: this.sourceTexture,
                //     })
                // }
                // this.plane && (this.plane.material = this.material);
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

    async updateData(data: WorkingFileRasterLayer['data']) {
        const backend = getWgpuWasmRendererBackend();
        if (data.tileUpdates) {
            if (data.tileUpdateId === this.tileUpdateId) return;
            const tileTextures = await Promise.allSettled(
                data.tileUpdates.map((tileUpdate) => requestFrontendTextureImageData(tileUpdate.sourceUuid))
            );
            for (const [updateIndex, tileUpdate] of data.tileUpdates.entries()) {
                const tileTexture = tileTextures[updateIndex].status === 'fulfilled' ? tileTextures[updateIndex].value : null;
                if (!tileTexture) continue;
                // backend.renderer.copyTextureToTexture(
                //     tileTexture,
                //     this.sourceTexture,
                //     null,
                //     new Vector2(tileUpdate.x, this.sourceTexture.image.height - tileUpdate.y - tileTexture.image.height)
                // );
                // if (tileTexture.userData.shouldDisposeBitmap) {
                //     tileTexture.image?.close();
                // }
                // tileTexture.dispose();
            }
            markRenderDirty();
            this.queueRegenerateThumbnail();
        } else {
            this.sourceUuid = data.sourceUuid;
            const sourceImageData = await requestFrontendTextureImageData(data.sourceUuid)
            if (sourceImageData) {
                backend.updateMeshControllerSourceImageData(this.id, sourceImageData);
                await this.scheduleMaterialUpdate('update');
            } else {
                await this.scheduleMaterialUpdate('update');
            }
        }
        this.tileUpdateId = data.tileUpdateId;
    }

    async updateFilters(filters: WorkingFileLayerFilter[]) {
        // this.filters = await createCanvasFiltersFromLayerConfig(filters);
        await this.scheduleMaterialUpdate('destroyAndCreate');
    }

    updateName(name: string) {
        const backend = getWgpuWasmRendererBackend();
        backend.updateMeshControllerName(this.id, name);
    }

    updateSize(width: number, height: number) {
        const backend = getWgpuWasmRendererBackend();
        backend.updateMeshControllerSize(this.id, width, height);
        markRenderDirty();
    }

    updateTransform(transform: Float32Array) {
        const backend = getWgpuWasmRendererBackend();
        backend.updateMeshControllerTransform(this.id, transform);
        markRenderDirty();
    }

    updateVisible(visible: boolean) {
        const backend = getWgpuWasmRendererBackend();
        this.visible = visible;
        const newVisibility = this.visibleOverride ?? this.visible;
        backend.updateMeshControllerVisible(this.id, newVisibility);
        if (newVisibility !== this.lastComputedVisibility) {
            this.lastComputedVisibility = newVisibility;
            markRenderDirty();
        }
    }

    reorder(order: number) {
        const backend = getWgpuWasmRendererBackend();
        backend.reorderMeshController(this.id, order);
    }

    async overrideFilters(filters?: Webgl2RendererCanvasFilter[]) {
        this.filtersOverride = filters;
        await this.scheduleMaterialUpdate('destroyAndCreate');
    }

    overrideVisibility(visible?: boolean) {
        this.visibleOverride = visible;
        this.updateVisible(this.visible);
    }

    // readBufferTextureUpdate(texture?: Texture) {
    //     if (!this.material?.uniforms?.dstTexture) return;
    //     this.material.uniforms.dstTexture.value = texture;
    //     this.material.uniformsNeedUpdate = true;
    // }
    
    detach() {
        const backend = getWgpuWasmRendererBackend();
        backend.removeMeshController(this.id);

        // messageBus.off('renderer.pass.readBufferTextureUpdate', this.readBufferTextureUpdate);
    }

}
