import { toRefs, watch, type WatchStopHandle } from 'vue';
import { WorkingFileRasterLayer, ColorModel } from '@/types';
import canvasStore from '@/store/canvas';
import { getStoredImageCanvas, getStoredImageOrCanvas } from '@/store/image';
import { createThreejsTextureFromImage } from '@/lib/canvas';
import BaseLayerRenderer from './base';

import { ImagePlaneGeometry } from './geometries/image-plane-geometry';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import { DoubleSide, NearestFilter, LinearMipmapLinearFilter, LinearMipmapNearestFilter, sRGBEncoding } from 'three/src/constants';
import { Mesh } from 'three/src/objects/Mesh';
import { TextureLoader } from 'three/src/loaders/TextureLoader';
import { Texture } from 'three/src/textures/Texture';
import { CanvasTexture } from 'three/src/textures/CanvasTexture';
import { Vector2 } from 'three/src/math/Vector2';

import { createFiltersFromLayerConfig, combineShaders } from '@/canvas/filters';
import { createRasterShaderMaterial } from './shaders';

import type { DrawWorkingFileLayerOptions } from '@/types';
import { createEmptyCanvasWith2dContext } from '@/lib/image';

export default class RasterLayerRenderer extends BaseLayerRenderer {
    private stopWatchVisible: WatchStopHandle | undefined;
    private stopWatchSize: WatchStopHandle | undefined;
    private stopWatchTransform: WatchStopHandle | undefined;
    private stopWatchFilters: WatchStopHandle | undefined;
    private stopWatchData: WatchStopHandle | undefined;
    private planeGeometry: InstanceType<typeof ImagePlaneGeometry> | undefined;
    private material: InstanceType<typeof ShaderMaterial> | undefined;
    private plane: InstanceType<typeof Mesh> | undefined;
    private draftTexture: InstanceType<typeof Texture> | undefined;
    private bakedTexture: InstanceType<typeof Texture> | undefined;
    private sourceTexture: InstanceType<typeof Texture> | undefined;
    private lastChunkUpdateId: string | undefined = undefined;

    async onAttach(layer: WorkingFileRasterLayer<ColorModel>) {

        this.lastChunkUpdateId = layer.data?.chunkUpdateId;
        const combinedShaderResult = combineShaders(
            await createFiltersFromLayerConfig(layer.filters),
            layer
        );
        this.material = createRasterShaderMaterial(null, combinedShaderResult);
        this.plane = new Mesh(this.planeGeometry, this.material);
        this.plane.renderOrder = this.order + 0.1;
        this.plane.matrixAutoUpdate = false;
        this.plane.onBeforeRender = () => {
            this.draftTexture && (this.draftTexture.needsUpdate = true);
        };
        (this.threejsScene ?? canvasStore.get('threejsScene'))?.add(this.plane);

        const { visible, width, height, transform, filters, data } = toRefs(layer);
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

    update(updates: Partial<WorkingFileRasterLayer<ColorModel>>) {
        super.update(updates);
    }

    async onUpdate(updates: Partial<WorkingFileRasterLayer<ColorModel>>) {
        if (updates.visible != null) {
            this.plane && (this.plane.visible = updates.visible);
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
            const combinedShaderResult = combineShaders(
                await createFiltersFromLayerConfig(updates.filters),
                { width: this.sourceTexture?.image.width, height: this.sourceTexture?.image.height }
            );
            const map = this.material?.uniforms.map;
            delete this.material?.uniforms.map;
            this.material?.dispose();
            this.material = createRasterShaderMaterial(map?.value, combinedShaderResult);
            this.plane && (this.plane.material = this.material);
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
                        let { x: updateX, y: updateY, width: updateWidth, height: updateHeight, data: updateCanvas } = updateChunk;
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
                        const updateChunkTexture = await createThreejsTextureFromImage(updateCanvas);
                        renderer.copyTextureToTexture(new Vector2(updateX, sourceHeight - updateY - updateHeight), updateChunkTexture, this.sourceTexture);
                        updateChunkTexture.dispose();
                    }
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
                    // this.sourceTexture.encoding = sRGBEncoding;
                    // this.sourceTexture.magFilter = NearestFilter;
                    // TODO - maybe use a combination of LinearMipmapLinearFilter and LinearMipmapNearestFilter
                    // depending on the zoom level, one can appear sharper than the other.
                    // this.sourceTexture.minFilter = LinearMipmapLinearFilter;

                    this.sourceTexture.needsUpdate = true;
                    this.material && (this.material.uniforms.map.value = this.sourceTexture);
                    canvasStore.set('dirty', true);
                } else {
                    this.disposeSourceTexture();
                    this.material && (this.material.uniforms.map.value = null);
                }
            }
        }
    }
    
    onDetach(): void {
        this.planeGeometry?.dispose();
        this.planeGeometry = undefined;
        this.plane && (this.threejsScene ?? canvasStore.get('threejsScene'))?.remove(this.plane);
        this.plane = undefined;
        this.material?.dispose();
        this.material = undefined;
        this.draftTexture?.dispose();
        this.draftTexture = undefined;
        this.disposeSourceTexture();
        this.stopWatchVisible?.();
        this.stopWatchSize?.();
        this.stopWatchTransform?.();
        this.stopWatchFilters?.();
        this.stopWatchData?.();
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
