import { toRefs, watch, type WatchStopHandle } from 'vue';

import BaseLayerRenderer from './base';

import canvasStore from '@/store/canvas';
import DrawableCanvas from '@/canvas/renderers/drawable/canvas';
import { createThreejsTextureFromImage } from '@/lib/canvas';

import { ImagePlaneGeometry } from './geometries/image-plane-geometry';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import { Mesh } from 'three/src/objects/Mesh';
import { Texture } from 'three/src/textures/Texture';

import { createFiltersFromLayerConfig, combineShaders } from '@/canvas/filters';
import { createRasterShaderMaterial } from './shaders';

import type { TextData } from '@/canvas/drawables/text';
import type { DrawWorkingFileLayerOptions, WorkingFileTextLayer, ColorModel } from '@/types';

export default class TextLayerRenderer extends BaseLayerRenderer {

    private stopWatchData: WatchStopHandle | undefined;
    private stopWatchFilters: WatchStopHandle | undefined;
    private stopWatchSize: WatchStopHandle | undefined;
    private stopWatchTransform: WatchStopHandle | undefined;

    private planeGeometry: InstanceType<typeof ImagePlaneGeometry> | undefined;
    private material: InstanceType<typeof ShaderMaterial> | undefined;
    private plane: InstanceType<typeof Mesh> | undefined;
    private texture: InstanceType<typeof Texture> | undefined;

    private drawableCanvas: DrawableCanvas | undefined;
    private textDrawableUuid: string | undefined;
    private isDrawnAfterAttach: boolean = false;

    async onAttach(layer: WorkingFileTextLayer<ColorModel>) {

        const combinedShaderResult = combineShaders(
            await createFiltersFromLayerConfig(layer.filters),
            layer
        );
        this.material = createRasterShaderMaterial(null, combinedShaderResult);
        this.plane = new Mesh(this.planeGeometry, this.material);
        this.plane.renderOrder = this.order + 0.1;
        this.plane.matrixAutoUpdate = false;
        (this.threejsScene ?? canvasStore.get('threejsScene'))?.add(this.plane);

        this.drawableCanvas = new DrawableCanvas({
            scale: 1,
            forceDrawOnMainThread: true,
        });
        this.drawableCanvas.initialized().then(() => {
            this.drawableCanvas?.add<TextData>('text', {
                wrapSize: layer.width,
                document: layer.data
            }).then((uuid) => {
                this.textDrawableUuid = uuid;
                if (!this.isDrawnAfterAttach) {
                    this.update({ data: layer.data });
                }
            });
        });
        this.drawableCanvas.onDrawn(async ({ canvas }) => {
            this.isDrawnAfterAttach = true;
            let newTexture: Texture = await createThreejsTextureFromImage(canvas);

            if (this.planeGeometry?.parameters.width !== canvas.width || this.planeGeometry.parameters.height !== canvas.height) {
                this.planeGeometry?.dispose();
                this.planeGeometry = new ImagePlaneGeometry(canvas.width, canvas.height);
                if (this.plane) {
                    this.plane.geometry = this.planeGeometry;
                }
            }

            this.texture?.dispose();
            this.texture = newTexture;
            this.texture.needsUpdate = true;
            this.material && (this.material.uniforms.map.value = this.texture);

            canvasStore.set('dirty', true);
        });

        const { width, height, filters, transform, data } = toRefs(layer);
        this.stopWatchData = watch([data], () => {
            this.update({ data: layer.data });
        }, { deep: true, immediate: true });
        this.stopWatchFilters = watch([filters], async ([filters]) => {
            await createFiltersFromLayerConfig(filters);
            this.update({ filters });
        }, { deep: true, immediate: false });
        this.stopWatchSize = watch([width, height], ([width, height]) => {
            this.update({ width, height });
        }, { immediate: true });
        this.stopWatchTransform = watch([transform], ([transform]) => {
            this.update({ transform });
        }, { immediate: true });
    }

    onReorder(order: number) {
        if (this.plane) {
            this.plane.renderOrder = order + 0.1;
        }
    }

    update(updates: Partial<WorkingFileTextLayer<ColorModel>>) {
        super.update(updates);
    }

    async onUpdate(updates: Partial<WorkingFileTextLayer<ColorModel>>) {
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
                { width: this.planeGeometry?.parameters.width, height: this.planeGeometry?.parameters.height }
            );
            const map = this.material?.uniforms.map;
            delete this.material?.uniforms.map;
            this.material?.dispose();
            this.material = createRasterShaderMaterial(map?.value, combinedShaderResult);
            this.plane && (this.plane.material = this.material);
        }
        if (updates.data) {
            if (this.drawableCanvas && this.textDrawableUuid) {
                this.drawableCanvas.draw({
                    updates: [
                        {
                            uuid: this.textDrawableUuid,
                            data: {
                                document: updates.data
                            }
                        }
                    ]
                });  
            }
        }
    }

    onDetach(): void {
        this.drawableCanvas?.dispose();
        this.planeGeometry?.dispose();
        this.planeGeometry = undefined;
        this.plane && (this.threejsScene ?? canvasStore.get('threejsScene'))?.remove(this.plane);
        this.plane = undefined;
        this.material?.dispose();
        this.material = undefined;
        this.stopWatchData?.();
        this.isDrawnAfterAttach = false;
    }

}
