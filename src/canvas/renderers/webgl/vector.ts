import { toRefs, watch, type WatchStopHandle } from 'vue';
import canvasStore from '@/store/canvas';
import { getStoredSvgImage } from '@/store/svg';

import BaseLayerRenderer from './base';

import { ImagePlaneGeometry } from './geometries/image-plane-geometry';
import { Mesh } from 'three/src/objects/Mesh';
import { Texture } from 'three/src/textures/Texture';

import { createFiltersFromLayerConfig } from '@/canvas/filters';
import { createMaterial, disposeMaterial, type MaterialWrapper, type MaterialWapperUpdates } from './materials';

import { createThreejsTextureFromImage } from '@/lib/canvas';
import { decomposeMatrix } from '@/lib/dom-matrix';
import { throttle } from '@/lib/timing';
import { createCanvasFromImage } from '@/lib/image';
import appEmitter from '@/lib/emitter';

import type { Scene } from 'three';
import type { WorkingFileVectorLayer, WorkingFileLayerBlendingMode, ColorModel } from '@/types';

const epsilon = 0.000001;

export default class VectorLayerRenderer extends BaseLayerRenderer {

    private stopWatchBlendingMode: WatchStopHandle | undefined;
    private stopWatchVisible: WatchStopHandle | undefined;
    private stopWatchSize: WatchStopHandle | undefined;
    private stopWatchTransform: WatchStopHandle | undefined;
    private stopWatchFilters: WatchStopHandle | undefined;
    private stopWatchData: WatchStopHandle | undefined;

    private planeGeometry: InstanceType<typeof ImagePlaneGeometry> | undefined;
    private materialWrapper: MaterialWrapper<MaterialWapperUpdates['raster']> | undefined;
    private plane: InstanceType<typeof Mesh> | undefined;
    private sourceTexture: InstanceType<typeof Texture> | undefined;
    private isVisible: boolean = true;

    private lastTransform: DOMMatrix = new DOMMatrix();
    private lastWidth: number = 0;
    private lastHeight: number = 0;
    private lastCalculatedWidth: number = 0;
    private lastCalculatedHeight: number = 0;
    private lastSvgSourceUuid: string | undefined;
    private lastBlendingMode: WorkingFileLayerBlendingMode = 'normal';

    private handleResize: (() => void) | undefined;

    async onAttach(layer: WorkingFileVectorLayer<ColorModel>) {

        this.materialWrapper = await createMaterial('raster', { srcTexture: undefined }, layer.filters, layer, layer.blendingMode);
        this.plane = new Mesh(this.planeGeometry, this.materialWrapper.material);
        this.plane.renderOrder = this.order + 0.1;
        this.plane.matrixAutoUpdate = false;
        (this.threejsScene ?? canvasStore.get('threejsScene'))?.add(this.plane);
        this.isVisible = layer.visible;

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

        this.handleResize = throttle(() => {
            this.updateSourceTexture();
        }, 500);
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

    update(updates: Partial<WorkingFileVectorLayer<ColorModel>>) {
        super.update(updates);
    }

    async onUpdate(updates: Partial<WorkingFileVectorLayer<ColorModel>>) {
        if (updates.visible != null) {
            this.isVisible = updates.visible;
        }
        if (updates.blendingMode != null) {
            this.lastBlendingMode = updates.blendingMode;
            if (this.materialWrapper) {
                this.materialWrapper = this.materialWrapper.changeBlendingMode(updates.blendingMode);
                this.plane && (this.plane.material = this.materialWrapper.material);
            }
        }
        if (updates.visible != null) {
            let oldVisibility = this.plane?.visible;
            let shouldBeVisible = this.isVisible;
            this.plane && (this.plane.visible = shouldBeVisible);
            if (this.plane?.visible !== oldVisibility) {
                canvasStore.set('dirty', true);
            }
        }
        if (updates.width || updates.height) {
            const width = (updates.width || this.planeGeometry?.parameters.width) ?? 1;
            const height = (updates.height || this.planeGeometry?.parameters.height) ?? 1;
            this.planeGeometry?.dispose();
            this.planeGeometry = new ImagePlaneGeometry(width, height);
            if (this.plane) {
                this.plane.geometry = this.planeGeometry;
            }
            this.lastWidth = width;
            this.lastHeight = height;
        }
        if (updates.transform) {
            this.plane?.matrix.set(
                updates.transform.m11, updates.transform.m21, updates.transform.m31, updates.transform.m41,
                updates.transform.m12, updates.transform.m22, updates.transform.m32, updates.transform.m42,
                updates.transform.m13, updates.transform.m23, updates.transform.m33, updates.transform.m43, 
                updates.transform.m14, updates.transform.m24, updates.transform.m34, updates.transform.m44
            );
            this.lastTransform = updates.transform;
        }
        if (updates.filters) {
            const srcTexture = this.materialWrapper?.material.uniforms.srcTexture.value;
            if (this.materialWrapper) {
                disposeMaterial(this.materialWrapper);
            }
            this.materialWrapper = await createMaterial('raster', { srcTexture }, updates.filters, 
                { width: this.sourceTexture?.image.width, height: this.sourceTexture?.image.height },
                this.lastBlendingMode
            );
            this.plane && (this.plane.material = this.materialWrapper.material);
        }
        if (updates.data) {
            this.lastSvgSourceUuid = updates.data.sourceUuid;
            this.updateSourceTexture();
        }

        // Handle resizing the texture to match the applied SVG size
        if (updates.width || updates.height || updates.transform) {
            const decomposedTransform = decomposeMatrix(this.lastTransform);
            const newWidth = decomposedTransform.scaleX * this.lastWidth;
            const newHeight = decomposedTransform.scaleY * this.lastHeight;
            if (Math.abs(newWidth - this.lastCalculatedWidth) > epsilon || Math.abs(newHeight - this.lastCalculatedHeight) > epsilon) {
                this.lastCalculatedWidth = newWidth;
                this.lastCalculatedHeight = newHeight;
                this.handleResize?.();
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
        this.disposeSourceTexture();
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

    private async updateSourceTexture() {
        const sourceImage = getStoredSvgImage(this.lastSvgSourceUuid ?? '');
        if (sourceImage && this.plane) {
            let newSourceTexture: Texture = await createThreejsTextureFromImage(
                createCanvasFromImage(sourceImage, {
                    width: this.lastCalculatedWidth,
                    height: this.lastCalculatedHeight
                })
            );
            this.disposeSourceTexture();
            if (this.plane) {
                this.sourceTexture = newSourceTexture;

                this.sourceTexture.needsUpdate = true;
                if (this.materialWrapper) {
                    this.materialWrapper = this.materialWrapper.update({ srcTexture: this.sourceTexture });
                    this.plane.material = this.materialWrapper.material;
                }
                canvasStore.set('dirty', true);
            } else {
                newSourceTexture.dispose();
            }
        } else {
            this.disposeSourceTexture();
            if (this.materialWrapper) {
                this.materialWrapper = this.materialWrapper.update({ srcTexture: undefined });
                if (this.plane) {
                    this.plane.material = this.materialWrapper!.material;
                }
            }
        }
    }

    private disposeSourceTexture() {
        if (this.sourceTexture) {
            this.sourceTexture.dispose();
            this.sourceTexture = undefined;
        }
    }
}
