import { toRefs, watch, type WatchStopHandle } from 'vue';
import { WorkingFileRasterLayer, ColorModel } from '@/types';
import canvasStore from '@/store/canvas';
import { getStoredSvgImage } from '@/store/svg';

import { createThreejsTextureFromImage } from '@/lib/canvas';
import { decomposeMatrix } from '@/lib/dom-matrix';
import { throttle } from '@/lib/timing';

import BaseLayerRenderer from './base';

import { ImagePlaneGeometry } from './geometries/image-plane-geometry';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import { Mesh } from 'three/src/objects/Mesh';
import { Texture } from 'three/src/textures/Texture';
import { Vector2 } from 'three/src/math/Vector2';

import { createFiltersFromLayerConfig, combineShaders } from '@/canvas/filters';
import { createRasterShaderMaterial } from './shaders';

import { createCanvasFromImage } from '@/lib/image';

const epsilon = 0.000001;

export default class VectorLayerRenderer extends BaseLayerRenderer {
    private stopWatchVisible: WatchStopHandle | undefined;
    private stopWatchSize: WatchStopHandle | undefined;
    private stopWatchTransform: WatchStopHandle | undefined;
    private stopWatchFilters: WatchStopHandle | undefined;
    private stopWatchData: WatchStopHandle | undefined;
    private planeGeometry: InstanceType<typeof ImagePlaneGeometry> | undefined;
    private material: InstanceType<typeof ShaderMaterial> | undefined;
    private plane: InstanceType<typeof Mesh> | undefined;
    private sourceTexture: InstanceType<typeof Texture> | undefined;
    private isVisible: boolean = true;

    private lastTransform: DOMMatrix = new DOMMatrix();
    private lastWidth: number = 0;
    private lastHeight: number = 0;
    private lastCalculatedWidth: number = 0;
    private lastCalculatedHeight: number = 0;
    private lastSvgSourceUuid: string | undefined;

    private handleResize: (() => void) | undefined;

    async onAttach(layer: WorkingFileRasterLayer<ColorModel>) {

        const combinedShaderResult = combineShaders(
            await createFiltersFromLayerConfig(layer.filters),
            layer
        );
        this.material = createRasterShaderMaterial(null, combinedShaderResult);
        this.plane = new Mesh(this.planeGeometry, this.material);
        this.plane.renderOrder = this.order + 0.1;
        this.plane.matrixAutoUpdate = false;
        (this.threejsScene ?? canvasStore.get('threejsScene'))?.add(this.plane);
        this.isVisible = layer.visible;

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

        this.handleResize = throttle(() => {
            this.updateSourceTexture();
        }, 500);
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
            this.isVisible = updates.visible;
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
        this.material?.dispose();
        this.material = undefined;
        this.disposeSourceTexture();
        this.stopWatchVisible?.();
        this.stopWatchSize?.();
        this.stopWatchTransform?.();
        this.stopWatchFilters?.();
        this.stopWatchData?.();
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
                this.material && (this.material.uniforms.map.value = this.sourceTexture);
                canvasStore.set('dirty', true);
            } else {
                newSourceTexture.dispose();
            }
        } else {
            this.disposeSourceTexture();
            this.material && (this.material.uniforms.map.value = null);
        }
    }

    private disposeSourceTexture() {
        if (this.sourceTexture) {
            this.sourceTexture.dispose();
            this.sourceTexture = undefined;
        }
    }
}
