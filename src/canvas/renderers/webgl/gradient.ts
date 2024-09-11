import { toRefs, watch, type WatchStopHandle } from 'vue';

import canvasStore from '@/store/canvas';
import workingFileStore from '@/store/working-file';

import BaseLayerRenderer from './base';

import gradientMaterialVertexShaderSetup from '@/canvas/renderers/webgl/shaders/gradient-material.setup.vert';
import gradientMaterialVertexShaderMain from '@/canvas/renderers/webgl/shaders/gradient-material.main.vert';
import gradientMaterialFragmentShaderSetup from '@/canvas/renderers/webgl/shaders/gradient-material.setup.frag';
import gradientMaterialFragmentShaderMain from '@/canvas/renderers/webgl/shaders/gradient-material.main.frag';

import { ImagePlaneGeometry } from './geometries/image-plane-geometry';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import { Mesh } from 'three/src/objects/Mesh';
import { Texture } from 'three/src/textures/Texture';

import { createFiltersFromLayerConfig, combineShaders } from '@/canvas/filters';
import { createGradientShaderMaterial, updateGradientShaderMaterial } from './shaders';

import type { WorkingFileGradientLayer, ColorModel, RGBAColor } from '@/types';

// TODO - implement color model conversions
function convertGradientLayerToRgba(data: WorkingFileGradientLayer['data']): WorkingFileGradientLayer<RGBAColor>['data'] {
    const dataCopy = JSON.parse(JSON.stringify(data)) as WorkingFileGradientLayer<RGBAColor>['data'];
    return dataCopy;
}

export default class GradientLayerRenderer extends BaseLayerRenderer {
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
    private lastLayerData: WorkingFileGradientLayer<RGBAColor>['data'] | undefined;

    async onAttach(layer: WorkingFileGradientLayer<ColorModel>) {

        const { visible, transform, filters, data } = toRefs(layer);
        const { width, height } = toRefs(workingFileStore.state);

        const combinedShaderResult = combineShaders(
            await createFiltersFromLayerConfig(layer.filters),
            layer,
            {
                vertexShaderSetup: gradientMaterialVertexShaderSetup,
                vertexShaderMain: gradientMaterialVertexShaderMain,
                fragmentShaderSetup: gradientMaterialFragmentShaderSetup,
                fragmentShaderMain: gradientMaterialFragmentShaderMain,
            }
        );
        this.lastLayerData = convertGradientLayerToRgba(layer.data);
        this.material = createGradientShaderMaterial(this.lastLayerData, width.value, height.value, transform.value, combinedShaderResult);
        this.plane = new Mesh(this.planeGeometry, this.material);
        this.plane.renderOrder = this.order + 0.1;
        this.plane.matrixAutoUpdate = false;
        (this.threejsScene ?? canvasStore.get('threejsScene'))?.add(this.plane);
        this.isVisible = layer.visible;

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
            const combinedShaderResult = combineShaders(
                await createFiltersFromLayerConfig(updates.filters),
                { width: this.sourceTexture?.image.width, height: this.sourceTexture?.image.height },
                {
                    vertexShaderSetup: gradientMaterialVertexShaderSetup,
                    vertexShaderMain: gradientMaterialVertexShaderMain,
                    fragmentShaderSetup: gradientMaterialFragmentShaderSetup,
                    fragmentShaderMain: gradientMaterialFragmentShaderMain,
                }
            );
            this.material?.dispose();
            this.material = createGradientShaderMaterial(this.lastLayerData, this.lastWidth, this.lastHeight, this.lastTransform, combinedShaderResult);
            this.plane && (this.plane.material = this.material);
        }

        if (needsMaterialUpdate && this.material && this.lastLayerData) {
            updateGradientShaderMaterial(this.material, this.lastLayerData, this.lastWidth, this.lastHeight, this.lastTransform);
            canvasStore.set('dirty', true);
        }
    }
    
    onDetach(): void {
        this.planeGeometry?.dispose();
        this.planeGeometry = undefined;
        this.plane && (this.threejsScene ?? canvasStore.get('threejsScene'))?.remove(this.plane);
        this.plane = undefined;
        this.material?.dispose();
        this.material = undefined;
        this.lastLayerData = undefined;
        this.stopWatchVisible?.();
        this.stopWatchSize?.();
        this.stopWatchTransform?.();
        this.stopWatchFilters?.();
        this.stopWatchData?.();
    }

}
