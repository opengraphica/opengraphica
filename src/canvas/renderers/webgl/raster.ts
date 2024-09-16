import { toRefs, watch, type WatchStopHandle } from 'vue';

import canvasStore from '@/store/canvas';
import { getStoredImageCanvas, getStoredImageOrCanvas } from '@/store/image';

import BaseLayerRenderer from './base';

import { ImagePlaneGeometry } from './geometries/image-plane-geometry';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import { Mesh } from 'three/src/objects/Mesh';
import { Texture } from 'three/src/textures/Texture';
import { Vector2 } from 'three/src/math/Vector2';

import { createFiltersFromLayerConfig, combineFiltersToShader } from '@/canvas/filters';
import { createMaterial, disposeMaterial, type MaterialWrapper } from './materials';
// import { createRasterShaderMaterial } from './shaders';
// import { assignMaterialBlendModes } from './blending';

import { createThreejsTextureFromImage } from '@/lib/canvas';
import { createEmptyCanvasWith2dContext } from '@/lib/image';
import appEmitter from '@/lib/emitter';

import type { Scene } from 'three';
import type { WorkingFileRasterLayer, WorkingFileLayerBlendingMode, ColorModel } from '@/types';

export default class RasterLayerRenderer extends BaseLayerRenderer {
    private stopWatchDrafts: WatchStopHandle | undefined;
    private stopWatchBlendingMode: WatchStopHandle | undefined;
    private stopWatchVisible: WatchStopHandle | undefined;
    private stopWatchSize: WatchStopHandle | undefined;
    private stopWatchTransform: WatchStopHandle | undefined;
    private stopWatchFilters: WatchStopHandle | undefined;
    private stopWatchData: WatchStopHandle | undefined;
    private planeGeometry: InstanceType<typeof ImagePlaneGeometry> | undefined;
    private materialWrapper: MaterialWrapper | undefined;
    private plane: InstanceType<typeof Mesh> | undefined;
    private draftTexture: InstanceType<typeof Texture> | undefined;
    private bakedTexture: InstanceType<typeof Texture> | undefined;
    private sourceTexture: InstanceType<typeof Texture> | undefined;
    private lastChunkUpdateId: string | undefined = undefined;

    private isVisible: boolean = true;
    private lastBlendingMode: WorkingFileLayerBlendingMode = 'normal';

    async onAttach(layer: WorkingFileRasterLayer<ColorModel>) {

        this.lastChunkUpdateId = layer.data?.chunkUpdateId;
        this.materialWrapper = await createMaterial('raster', { texture: undefined }, layer.filters, layer, layer.blendingMode);
        this.plane = new Mesh(this.planeGeometry, this.materialWrapper.material);
        this.plane.name = layer.name;
        this.plane.renderOrder = this.order + 0.1;
        this.plane.matrixAutoUpdate = false;
        this.plane.onBeforeRender = () => {
            this.draftTexture && (this.draftTexture.needsUpdate = true);
        };
        (this.threejsScene ?? canvasStore.get('threejsScene'))?.add(this.plane);
        this.isVisible = layer.visible;

        this.readBufferTextureUpdate = this.readBufferTextureUpdate.bind(this);
        appEmitter.on('renderer.pass.readBufferTextureUpdate', this.readBufferTextureUpdate);

        const { drafts, blendingMode, visible, width, height, transform, filters, data } = toRefs(layer);
        this.stopWatchDrafts = watch([drafts], ([drafts]) => {
            this.update({ drafts });
        }, { immediate: true });
        this.stopWatchBlendingMode = watch([blendingMode], ([blendingMode]) => {
            this.update({ blendingMode });
        }, { immediate: true });
        this.stopWatchVisible = watch([visible], ([visible]) => {
            this.update({ visible });
        }, { immediate: true });
        this.stopWatchSize = watch([width, height], ([width, height]) => {
            this.update({ width, height });
        }, { immediate: true });
        this.stopWatchTransform = watch([transform], ([transform]) => {
            this.update({ transform });
        }, { immediate: true });
        this.stopWatchFilters = watch([filters], async ([filters]) => {
            await createFiltersFromLayerConfig(filters);
            this.update({ filters });
        }, { deep: true, immediate: false });
        this.stopWatchData = watch([data], () => {
            this.update({ data: layer.data });
        }, { deep: true, immediate: true });
    }

    onReorder(order: number) {
        if (this.plane) {
            this.plane.renderOrder = order + 0.1;
        }
    }

    onSwapScene(scene: Scene) {
        if (this.plane) {
            (this.threejsScene ?? canvasStore.get('threejsScene'))?.remove(this.plane);
            scene.add(this.plane);
        }
    }

    update(updates: Partial<WorkingFileRasterLayer<ColorModel>>) {
        super.update(updates);
    }

    async onUpdate(updates: Partial<WorkingFileRasterLayer<ColorModel>>) {
        if (updates.visible != null) {
            this.isVisible = updates.visible;
        }
        if (updates.visible != null || updates.drafts != null) {
            let oldVisibility = this.plane?.visible;
            let shouldBeVisible = this.isVisible;
            if (updates.drafts?.[0]?.mode === 'replace') {
                shouldBeVisible = false;
            }
            this.plane && (this.plane.visible = shouldBeVisible);
            if (this.plane?.visible !== oldVisibility) {
                canvasStore.set('dirty', true);
            }
        }
        if (updates.blendingMode) {
            this.lastBlendingMode = updates.blendingMode;
            if (this.materialWrapper) {
                this.materialWrapper = this.materialWrapper.changeBlendingMode(updates.blendingMode);
                this.plane && (this.plane.material = this.materialWrapper.material);
            }
        }
        if (updates.width || updates.height) {
            const width = updates.width || this.planeGeometry?.parameters.width;
            const height = updates.height || this.planeGeometry?.parameters.height;
            this.planeGeometry?.dispose();
            this.planeGeometry = new ImagePlaneGeometry(width, height);
            if (this.plane) {
                this.plane.geometry = this.planeGeometry;
            }
        }
        if (updates.transform) {
            this.plane?.matrix.set(
                updates.transform.m11, updates.transform.m21, updates.transform.m31, updates.transform.m41,
                updates.transform.m12, updates.transform.m22, updates.transform.m32, updates.transform.m42,
                updates.transform.m13, updates.transform.m23, updates.transform.m33, updates.transform.m43, 
                updates.transform.m14, updates.transform.m24, updates.transform.m34, updates.transform.m44
            );
        }
        if (updates.filters) {
            const map = this.materialWrapper?.material.uniforms.map.value;
            if (this.materialWrapper) {
                disposeMaterial(this.materialWrapper);
            }
            this.materialWrapper = await createMaterial('raster', { texture: map }, updates.filters, 
                { width: this.sourceTexture?.image.width, height: this.sourceTexture?.image.height },
                this.lastBlendingMode
            );
            this.plane && (this.plane.material = this.materialWrapper.material);
        }
        if (updates.data) {
            if (this.draftTexture) {
                this.draftTexture.dispose();
                this.draftTexture = undefined;
            }

            // Only pieces of the image have updated - shortcut.
            if (this.sourceTexture && updates.data.chunkUpdateId !== this.lastChunkUpdateId && updates.data.updateChunks) {
                this.lastChunkUpdateId = updates.data.chunkUpdateId;
                const renderer = canvasStore.get('threejsRenderer');
                if (renderer) {
                    let sourceCanvas: HTMLCanvasElement | ImageBitmap | null = null;
                    const { width: sourceWidth, height: sourceHeight } = this.sourceTexture.image;
                    for (const updateChunk of updates.data.updateChunks) {
                        let { x: updateX, y: updateY, data: updateCanvas } = updateChunk;
                        let updateWidth = updateCanvas.width;
                        let updateHeight = updateCanvas.height;
                        // Clip update data to destination image bounds, or use original image if not replace mode.
                        if (updateX < 0 || updateY < 0 || updateX + updateWidth > sourceWidth || updateY + updateHeight > sourceHeight || updateChunk.mode !== 'replace') {
                            const shiftX = Math.min(0, updateX);
                            const shiftY = Math.min(0, updateY);
                            updateX = Math.max(0, updateX);
                            updateY = Math.max(0, updateY);
                            let newUpdateWidth = Math.min(updateWidth + shiftX, sourceWidth - updateX);
                            let newUpdateHeight = Math.min(updateHeight + shiftY, sourceHeight - updateY);
                            if (newUpdateWidth < 1 || newUpdateHeight < 1) continue;
                            const { canvas: newUpdateCanvas, ctx: newUpdateCanvasCtx } = createEmptyCanvasWith2dContext(newUpdateWidth, newUpdateHeight);
                            if (!newUpdateCanvasCtx) continue;
                            if (updateChunk.mode !== 'replace') {
                                if (!sourceCanvas) sourceCanvas = await getStoredImageOrCanvas(updates.data.sourceUuid);
                                if (!sourceCanvas) continue;
                                newUpdateCanvasCtx.drawImage(sourceCanvas, updateX + shiftX, updateY + shiftY, newUpdateWidth, newUpdateHeight, 0, 0, newUpdateWidth, newUpdateHeight);
                            } else {
                                newUpdateCanvasCtx.drawImage(updateCanvas, shiftX, shiftY);
                            }
                            updateWidth = newUpdateWidth;
                            updateHeight = newUpdateHeight;
                            updateCanvas = newUpdateCanvas;
                        }
                        // Copy update data to existing texture.
                        const updateChunkTexture = await createThreejsTextureFromImage(updateCanvas, { preferWorkerThread: true });
                        renderer.copyTextureToTexture(new Vector2(updateX, sourceHeight - updateY - updateHeight), updateChunkTexture, this.sourceTexture);
                        updateChunkTexture.dispose();
                    }
                    // Update the image source of the texture, needed for exporting. Don't mark as needsUpdate so not to trigger a re-upload.
                    if (this.sourceTexture.userData.shouldDisposeBitmap && this.sourceTexture.image instanceof ImageBitmap) {
                        this.sourceTexture.image.close();
                        this.sourceTexture.userData.shouldDisposeBitmap = false;
                    }
                    this.sourceTexture.image = sourceCanvas ?? await getStoredImageOrCanvas(updates.data.sourceUuid);
                    canvasStore.set('dirty', true);
                }
            }
            // Re-upload the full image texture to the GPU, discard the old texture.
            else {
                const sourceImage = await getStoredImageOrCanvas(updates.data.sourceUuid ?? '');
                if (sourceImage) {
                    let newSourceTexture: Texture = await createThreejsTextureFromImage(sourceImage);
                    this.disposeSourceTexture();
                    this.sourceTexture = newSourceTexture;

                    this.sourceTexture.needsUpdate = true;
                    this.materialWrapper = this.materialWrapper!.update({ texture: this.sourceTexture });
                    this.plane && (this.plane.material = this.materialWrapper.material);
                    canvasStore.set('dirty', true);
                } else {
                    this.disposeSourceTexture();
                    this.materialWrapper = this.materialWrapper!.update({ texture: undefined });
                    this.plane && (this.plane.material = this.materialWrapper.material);
                }
            }
        }
    }
    
    onDetach(): void {
        this.planeGeometry?.dispose();
        this.planeGeometry = undefined;
        this.plane && (this.threejsScene ?? canvasStore.get('threejsScene'))?.remove(this.plane);
        this.plane = undefined;

        appEmitter.off('renderer.pass.readBufferTextureUpdate', this.readBufferTextureUpdate);

        if (this.materialWrapper) {
            disposeMaterial(this.materialWrapper);
        }
        this.materialWrapper = undefined;
        this.draftTexture?.dispose();
        this.draftTexture = undefined;
        this.disposeSourceTexture();
        this.stopWatchDrafts?.();
        this.stopWatchBlendingMode?.();
        this.stopWatchVisible?.();
        this.stopWatchSize?.();
        this.stopWatchTransform?.();
        this.stopWatchFilters?.();
        this.stopWatchData?.();
    }

    private readBufferTextureUpdate(texture?: Texture) {
        if (!this.materialWrapper) return;
        this.materialWrapper.material.uniforms.destinationMap.value = texture;
        this.materialWrapper.material.uniformsNeedUpdate = true;
    }

    private disposeSourceTexture() {
        if (this.sourceTexture) {
            if (this.sourceTexture.userData.shouldDisposeBitmap) {
                this.sourceTexture.image?.close();
            }
            this.sourceTexture.dispose();
            this.sourceTexture = undefined;
        }
    }
}
