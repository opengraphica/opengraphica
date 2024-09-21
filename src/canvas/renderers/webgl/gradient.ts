import { toRefs, watch, type WatchStopHandle } from 'vue';

import canvasStore from '@/store/canvas';
import workingFileStore from '@/store/working-file';

import appEmitter from '@/lib/emitter';

import BaseLayerRenderer from './base';

import { ImagePlaneGeometry } from './geometries/image-plane-geometry';
import { Mesh } from 'three/src/objects/Mesh';
import { Texture } from 'three/src/textures/Texture';

import { createFiltersFromLayerConfig, combineFiltersToShader } from '@/canvas/filters';
import { needsBufferTextureUpdate } from './postprocessing/create-layer-passes';
import { createMaterial, disposeMaterial, type MaterialWrapper, type MaterialWapperUpdates } from './materials';

import type { Scene } from 'three';
import type { WorkingFileGradientLayer, WorkingFileLayerBlendingMode, ColorModel, RGBAColor } from '@/types';

// TODO - implement color model conversions
function convertGradientLayerToRgba(data: WorkingFileGradientLayer['data']): WorkingFileGradientLayer<RGBAColor>['data'] {
    const dataCopy = JSON.parse(JSON.stringify(data)) as WorkingFileGradientLayer<RGBAColor>['data'];
    return dataCopy;
}

export default class GradientLayerRenderer extends BaseLayerRenderer {

    private stopWatchBlendingMode: WatchStopHandle | undefined;
    private stopWatchVisible: WatchStopHandle | undefined;
    private stopWatchSize: WatchStopHandle | undefined;
    private stopWatchTransform: WatchStopHandle | undefined;
    private stopWatchFilters: WatchStopHandle | undefined;
    private stopWatchData: WatchStopHandle | undefined;

    private planeGeometry: InstanceType<typeof ImagePlaneGeometry> | undefined;
    private materialWrapper: MaterialWrapper<MaterialWapperUpdates['gradient']> | undefined;
    private plane: InstanceType<typeof Mesh> | undefined;
    private sourceTexture: InstanceType<typeof Texture> | undefined;
    private isVisible: boolean = true;

    private lastTransform: DOMMatrix = new DOMMatrix();
    private lastWidth: number = 0;
    private lastHeight: number = 0;
    private lastLayerData: WorkingFileGradientLayer<RGBAColor>['data'] | undefined;
    private lastBlendingMode: WorkingFileLayerBlendingMode = 'normal';

    async onAttach(layer: WorkingFileGradientLayer<ColorModel>) {

        const { blendingMode, visible, transform, filters, data } = toRefs(layer);
        const { width, height } = toRefs(workingFileStore.state);

        this.lastLayerData = convertGradientLayerToRgba(layer.data);
        this.materialWrapper = await createMaterial('gradient', {
            gradientData: this.lastLayerData,
            canvasWidth: width.value,
            canvasHeight: height.value,
            transform: transform.value,
        }, layer.filters, layer, layer.blendingMode);
        this.plane = new Mesh(this.planeGeometry, this.materialWrapper.material);
        this.plane.renderOrder = this.order + 0.1;
        this.plane.matrixAutoUpdate = false;
        (this.threejsScene ?? canvasStore.get('threejsScene'))?.add(this.plane);
        this.isVisible = layer.visible;

        this.readBufferTextureUpdate = this.readBufferTextureUpdate.bind(this);
        if (needsBufferTextureUpdate(layer.blendingMode)) {
            appEmitter.on('renderer.pass.readBufferTextureUpdate', this.readBufferTextureUpdate);
        }

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

    update(updates: Partial<WorkingFileGradientLayer<ColorModel>>) {
        super.update(updates);
    }

    async onUpdate(updates: Partial<WorkingFileGradientLayer<ColorModel>>) {
        let needsMaterialUpdate = false;
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
        if (updates.blendingMode) {
            if (updates.blendingMode !== this.lastBlendingMode) {
                this.lastBlendingMode = updates.blendingMode;
                if (this.materialWrapper) {
                    this.materialWrapper = this.materialWrapper.changeBlendingMode(updates.blendingMode);
                    this.plane && (this.plane.material = this.materialWrapper.material);
                }
                appEmitter.off('renderer.pass.readBufferTextureUpdate', this.readBufferTextureUpdate);
                if (needsBufferTextureUpdate(updates.blendingMode)) {
                    appEmitter.on('renderer.pass.readBufferTextureUpdate', this.readBufferTextureUpdate);
                }
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
            needsMaterialUpdate = true;
        }
        if (updates.transform) {
            this.lastTransform = updates.transform;
            needsMaterialUpdate = true;
        }
        if (updates.data) {
            this.lastLayerData = convertGradientLayerToRgba(updates.data);
            needsMaterialUpdate = true;
        }
        if (updates.filters && this.lastLayerData) {
            if (this.materialWrapper) {
                disposeMaterial(this.materialWrapper);
            }
            this.materialWrapper = await createMaterial('gradient',
                {
                    gradientData: this.lastLayerData,
                    canvasWidth: this.lastWidth,
                    canvasHeight: this.lastHeight,
                    transform: this.lastTransform,
                },
                updates.filters, 
                { width: this.sourceTexture?.image.width, height: this.sourceTexture?.image.height },
                this.lastBlendingMode
            );
            this.plane && (this.plane.material = this.materialWrapper.material);
        }

        if (needsMaterialUpdate && this.materialWrapper && this.lastLayerData) {
            this.materialWrapper = this.materialWrapper.update({
                gradientData: this.lastLayerData,
                canvasWidth: this.lastWidth,
                canvasHeight: this.lastHeight,
                transform: this.lastTransform,
            });
            this.plane && (this.plane.material = this.materialWrapper.material);
            canvasStore.set('dirty', true);
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
        this.lastLayerData = undefined;
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
