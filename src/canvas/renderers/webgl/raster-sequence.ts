import { toRefs, watch, type WatchStopHandle } from 'vue';

import canvasStore from '@/store/canvas';
import { getStoredImageOrCanvas } from '@/store/image';
import { getCanvasRenderingContext2DSettings } from '@/store/working-file';

import BaseLayerRenderer from './base';

import { ImagePlaneGeometry } from './geometries/image-plane-geometry';
import { NearestFilter, SRGBColorSpace } from 'three/src/constants';
import { Mesh } from 'three/src/objects/Mesh';
import { Texture } from 'three/src/textures/Texture';
import { CanvasTexture } from 'three/src/textures/CanvasTexture';
import appEmitter from '@/lib/emitter';

import { createFiltersFromLayerConfig } from '../../filters';
import { createMaterial, disposeMaterial, type MaterialWrapper, type MaterialWapperUpdates } from './materials';

import type { Scene } from 'three';
import type { DrawWorkingFileLayerOptions, WorkingFileLayerBlendingMode, WorkingFileRasterSequenceLayer, ColorModel } from '@/types';

export default class RasterSequenceLayerRenderer extends BaseLayerRenderer {

    private stopWatchBlendingMode: WatchStopHandle | undefined;
    private stopWatchVisible: WatchStopHandle | undefined;
    private stopWatchSize: WatchStopHandle | undefined;
    private stopWatchTransform: WatchStopHandle | undefined;
    private stopWatchFilters: WatchStopHandle | undefined;
    private stopWatchData: WatchStopHandle | undefined;

    private planeGeometry: InstanceType<typeof ImagePlaneGeometry> | undefined;
    private materialWrapper: MaterialWrapper<MaterialWapperUpdates['raster']> | undefined;
    private plane: InstanceType<typeof Mesh> | undefined;
    private lastUpdatedFrame: WorkingFileRasterSequenceLayer<ColorModel>['data']['currentFrame'] | undefined;
    private textureCanvas: InstanceType<typeof HTMLCanvasElement> | undefined;
    private textureCtx: CanvasRenderingContext2D | undefined;
    private texture: InstanceType<typeof CanvasTexture> | undefined;

    private lastBlendingMode: WorkingFileLayerBlendingMode = 'normal';

    async onAttach(layer: WorkingFileRasterSequenceLayer<ColorModel>) {
        this.materialWrapper = await createMaterial('raster', { srcTexture: undefined }, layer.filters, layer, layer.blendingMode);
        this.plane = new Mesh(this.planeGeometry, this.materialWrapper.material);
        this.plane.renderOrder = this.order;
        this.plane.matrixAutoUpdate = false;
        (this.threejsScene ?? canvasStore.get('threejsScene'))?.add(this.plane);

        this.textureCanvas = document.createElement('canvas');
        const sourceImage = getStoredImageOrCanvas(layer.data.currentFrame?.sourceUuid ?? '');
        this.textureCanvas.width = sourceImage?.width || 10;
        this.textureCanvas.height = sourceImage?.height || 10;
        this.textureCtx = this.textureCanvas.getContext('2d', getCanvasRenderingContext2DSettings()) || undefined;
        if (this.textureCtx) {
            this.textureCtx.imageSmoothingEnabled = false;
        }

        this.texture?.dispose();
        this.texture = new CanvasTexture(this.textureCanvas);
        this.texture.magFilter = NearestFilter;
        this.texture.colorSpace = SRGBColorSpace;
        this.materialWrapper && (this.materialWrapper.material.uniforms.srcTexture.value = this.texture);

        this.readBufferTextureUpdate = this.readBufferTextureUpdate.bind(this);
        appEmitter.on('renderer.pass.readBufferTextureUpdate', this.readBufferTextureUpdate);

        const { blendingMode, visible, width, height, transform, filters, data } = toRefs(layer);
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
            this.plane.renderOrder = order;
        }
    }

    onSwapScene(scene: Scene) {
        if (this.plane) {
            (this.threejsScene ?? canvasStore.get('threejsScene'))?.remove(this.plane);
            scene.add(this.plane);
        }
    }

    update(updates: Partial<WorkingFileRasterSequenceLayer<ColorModel>>) {
        super.update(updates);
    }

    async onUpdate(updates: Partial<WorkingFileRasterSequenceLayer<ColorModel>>) {
        if (updates.visible != null) {
            this.plane && (this.plane.visible = updates.visible);
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
            const srcTexture = this.materialWrapper?.material.uniforms.srcTexture.value;
            if (this.materialWrapper) {
                disposeMaterial(this.materialWrapper);
            }
            this.materialWrapper = await createMaterial('raster', { srcTexture }, updates.filters, 
                { width: this.texture?.image.width, height: this.texture?.image.height },
                this.lastBlendingMode
            );
            this.plane && (this.plane.material = this.materialWrapper.material);
        }
        if (updates.data) {
            if (!this.textureCtx) return;
            this.textureCtx.clearRect(0, 0, this.textureCtx.canvas.width, this.textureCtx.canvas.height);
            if (updates.data.currentFrame) {
                const sourceImage = getStoredImageOrCanvas(updates.data.currentFrame?.sourceUuid ?? '');
                if (sourceImage) {
                    this.textureCtx.drawImage(sourceImage, 0, 0);
                }
                if (this.materialWrapper?.material.uniforms.srcTexture.value) {
                    this.materialWrapper.material.uniforms.srcTexture.value.needsUpdate = true;
                }
            }
            this.lastUpdatedFrame = updates.data.currentFrame;
        }
    }

    onDraw(ctx: CanvasRenderingContext2D, layer: WorkingFileRasterSequenceLayer<ColorModel>, options: DrawWorkingFileLayerOptions = {}) {
        if (this.lastUpdatedFrame !== layer.data.currentFrame) {
            this.update({
                data: layer.data
            });
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
        this.textureCanvas = undefined;
        this.textureCtx = undefined;
        this.texture?.dispose();
        this.texture = undefined;
        this.lastUpdatedFrame = undefined;
        this.stopWatchBlendingMode?.();
        this.stopWatchVisible?.();
        this.stopWatchSize?.();
        this.stopWatchTransform?.();
        this.stopWatchFilters?.();
        this.stopWatchData?.();
    }

    private readBufferTextureUpdate(texture?: Texture) {
        if (!this.materialWrapper) return;
        this.materialWrapper.material.uniforms.dstTexture.value = texture;
        this.materialWrapper.material.uniformsNeedUpdate = true;
    }
}
