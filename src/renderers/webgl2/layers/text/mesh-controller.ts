/**
 * This file constructs the necessary assets to render a text layer.
 * It can run in the main thread or a worker.
 */
import { mergeGeometries } from '@/renderers/webgl2/geometries/buffer-geometry-utils';
import { ImagePlaneGeometry } from '@/renderers/webgl2/geometries/image-plane-geometry';

import { BackSide } from 'three/src/constants';
import { Matrix4 } from 'three/src/math/Matrix4';
import { MeshBasicMaterial } from 'three/src/materials/MeshBasicMaterial';
import { Mesh } from 'three/src/objects/Mesh';
import { Object3D } from 'three/src/core/Object3D';
import { Path } from 'three/src/extras/core/Path';
import { Shape } from 'three/src/extras/core/Shape';
import { ShapeGeometry } from 'three/src/geometries/ShapeGeometry';
import { Texture } from 'three/src/textures/Texture';
import { Vector2 } from 'three/src/math/Vector2';
import { Vector3 } from 'three/src/math/Vector3';

import { Clipper, PolyType, ClipType, Paths, PathPoint, PolyFillType, PolyTree } from '@/lib/clipper';
import { textMetaDefaults } from '@/lib/text-common';
import { getUnloadedFontFamilies, loadFontFamilies, calculateTextPlacement } from '@/lib/text-render';

import { getWebgl2RendererBackend, markRenderDirty, requestFrontendTexture } from '@/renderers/webgl2/backend';
import { messageBus } from '@/renderers/webgl2/backend/message-bus';
import { createCanvasFiltersFromLayerConfig } from '../base/material';
import { assignMaterialBlendingMode } from '../base/blending-mode';
import { createTextMaterial, disposeTextMaterial, updateTextMaterial } from './material';
import { LetterMeshCache } from './letter-mesh-cache';

import type { Scene, ShaderMaterial } from 'three';
import type {
    Webgl2RendererCanvasFilter, Webgl2RendererMeshController,
    WorkingFileLayerBlendingMode, WorkingFileTextLayer, WorkingFileLayerFilter
} from '@/types';
import type { Glyph } from '@/lib/opentype';

export class TextLayerMeshController implements Webgl2RendererMeshController {
    
    letterMeshCache: LetterMeshCache | undefined;
    material: InstanceType<typeof ShaderMaterial> | undefined;
    scene: InstanceType<typeof Scene> | undefined;
    sourceTexture: InstanceType<typeof Texture> | undefined;
    textGroup: InstanceType<typeof Object3D> | undefined;

    id: number = -1;
    blendingMode: WorkingFileLayerBlendingMode = 'normal';
    data: WorkingFileTextLayer['data'] | undefined = undefined;
    filters: Webgl2RendererCanvasFilter[] = [];
    filtersOverride: Webgl2RendererCanvasFilter[] | undefined = undefined;
    height: number = 0;
    order: number = 0;
    visible: boolean = true;
    visibleOverride: boolean | undefined = undefined;
    width: number = 0;

    materialUpdates: Array<'destroyAndCreate' | 'update'> = [];
    regenerateThumbnailTimeoutHandle: number | undefined;
    waitingToLoadFontFamilies: string[] = [];
    
    letterMeshes: InstanceType<typeof Mesh>[] = [];

    attach(id: number) {
        this.id = id;
        const backend = getWebgl2RendererBackend();
        backend.addMeshController(id, this);
        this.scene = backend.scene;
        this.textGroup = new Object3D();
        this.textGroup.matrixAutoUpdate = false;
        this.letterMeshCache = new LetterMeshCache(this.textGroup);

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
                        await disposeTextMaterial(this.material);
                    }
                }
                if (!this.material || updateType === 'destroyAndCreate') {
                    this.material = await createTextMaterial({
                        canvasFilters: this.filtersOverride ?? this.filters,
                    });
                    assignMaterialBlendingMode(this.material, this.blendingMode);
                    this.letterMeshCache?.setMaterial(this.material);
                } else {
                    console.warn('[src/renderers/webgl2/layers/text/mesh-controller.ts] Currently no use case for material updates in controller.');
                }
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

    async updateData(data: WorkingFileTextLayer['data']) {
        this.data = data;
        this.waitingToLoadFontFamilies = getUnloadedFontFamilies(data);
        this.loadFontFamilies();
        this.regenerateFromData();
    }

    regenerateFromData() {
        const data = this.data;
        if (!data) return;

        const isHorizontal = ['ltr', 'rtl'].includes(data.lineDirection);

        if (data.boundary !== 'dynamic' && ((isHorizontal && this.width === 0) || (!isHorizontal && this.height === 0))) return;

        const wrapSize = isHorizontal ? this.width : this.height;
        const { lines, lineDirectionSize, wrapDirection, wrapDirectionSize } = calculateTextPlacement(data, { wrapSize });
        const wrapSign = ['ltr', 'ttb'].includes(wrapDirection) ? 1 : -1;
        let wrapOffsetStart = wrapSign > 0 ? 0 : wrapDirectionSize;

        const width = isHorizontal ? data.boundary === 'box' ? this.width : lineDirectionSize : wrapDirectionSize;
        const height = isHorizontal ? wrapDirectionSize : data.boundary === 'box' ? this.height : lineDirectionSize;
        if (this.width !== width || this.height !== height) {
            this.width = width;
            this.height = height;
            messageBus.emit('layer.text.notifySizeUpdate', { id: this.id, width, height });
        }

        for (const mesh of this.letterMeshes) {
            this.textGroup?.remove(mesh);
            mesh.geometry?.dispose();
            (mesh.material as ShaderMaterial)?.dispose();
        }
        this.letterMeshes = [];

        if (isHorizontal) {
            for (const line of lines) {
                const wrapOffsetLine = wrapSign > 0 ? 0 : -(line.heightAboveBaseline + line.heightBelowBaseline);
                for (const { glyph, meta, advanceOffset, documentCharacterIndex, drawOffset, fontName, fontSize } of line.glyphs) {
                    this.letterMeshCache?.addLetter(
                        glyph,
                        fontName,
                        line.documentLineIndex,
                        documentCharacterIndex,
                        line.lineStartOffset + drawOffset.x + advanceOffset,
                        wrapOffsetStart + wrapOffsetLine + (line.wrapOffset * wrapSign) + drawOffset.y + line.heightAboveBaseline,
                        fontSize,
                        meta.fillColor?.style ?? textMetaDefaults.fillColor.style,
                    );
                }
            }
        } else {
            for (const line of lines) {
                const wrapOffsetLine = wrapSign > 0 ? 0 : -line.largestCharacterWidth;
                for (const { glyph, meta, advanceOffset, documentCharacterIndex, drawOffset, fontName, characterWidth, fontSize } of line.glyphs) {
                    this.letterMeshCache?.addLetter(
                        glyph,
                        fontName,
                        line.documentLineIndex,
                        documentCharacterIndex,
                        wrapOffsetStart + wrapOffsetLine + (line.wrapOffset * wrapSign) + drawOffset.x + (line.largestCharacterWidth / 2.0) - (characterWidth / 2.0),
                        line.lineStartOffset + drawOffset.y + advanceOffset,
                        fontSize,
                        meta.fillColor?.style ?? textMetaDefaults.fillColor.style,
                    );
                }
            }
        }

        this.letterMeshCache?.finalize();

        markRenderDirty();
    }

    async updateFilters(filters: WorkingFileLayerFilter[]) {
        this.filters = await createCanvasFiltersFromLayerConfig(filters);
        await this.scheduleMaterialUpdate('destroyAndCreate');
    }

    updateName(name: string) {
        if (this.textGroup) {
            this.textGroup.name = name;
        }
    }

    updateSize(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.regenerateFromData();
    }

    updateTransform(transform: Float64Array) {
        this.textGroup?.matrix.set(
            transform[0], transform[1], transform[2], transform[3],
            transform[4], transform[5], transform[6], transform[7],
            transform[8], transform[9], transform[10], transform[11], 
            transform[12], transform[13], transform[14], transform[15],
        );
        markRenderDirty();
    }

    updateVisible(visible: boolean) {
        this.visible = visible;
        let oldVisibility = this.textGroup?.visible;
        this.textGroup && (this.textGroup.visible = this.visibleOverride ?? this.visible);
        if (this.textGroup?.visible !== oldVisibility) {
            markRenderDirty();
        }
    }

    reorder(order: number) {
        this.order = order;
        if (this.textGroup) {
            this.textGroup.renderOrder = order + 0.1;
        }
        this.letterMeshCache?.reorder(order);
    }

    getTexture() {
        return Promise.resolve(this.sourceTexture ?? null);
    }

    getTransform() {
        return this.textGroup?.matrix ?? new Matrix4();
    }
    
    swapScene(scene: Scene) {
        if (!this.textGroup) return;
        this.scene?.remove(this.textGroup);
        scene.add(this.textGroup);
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

    async loadFontFamilies() {
        const hadUnloadedFont = await loadFontFamilies(this.waitingToLoadFontFamilies);
        if (hadUnloadedFont && this.data) {
            this.updateData(this.data);
        }
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

        for (const mesh of this.letterMeshes) {
            mesh.geometry?.dispose();
            (mesh.material as ShaderMaterial)?.dispose();
        }

        this.letterMeshCache?.dispose();
        this.letterMeshCache = undefined;

        this.textGroup && this.scene?.remove(this.textGroup);
        this.textGroup = undefined;

        if (this.material) {
            disposeTextMaterial(this.material);
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
