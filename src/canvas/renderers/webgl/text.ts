import { toRefs, watch, type WatchStopHandle } from 'vue';

import BaseLayerRenderer from './base';

import canvasStore from '@/store/canvas';
import { regenerateLayerThumbnail } from '@/store/working-file';

import DrawableCanvas from '@/canvas/renderers/drawable/canvas';
import { createThreejsTextureFromImage } from '@/lib/canvas';
import { notifyLoadingFontFamilies, notifyFontFamiliesLoaded } from '@/lib/font-notify';
import appEmitter from '@/lib/emitter';

import { ImagePlaneGeometry } from './geometries/image-plane-geometry';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import { Mesh } from 'three/src/objects/Mesh';
import { Texture } from 'three/src/textures/Texture';

import { createFiltersFromLayerConfig, combineFiltersToShader } from '@/canvas/filters';
import { createMaterial, disposeMaterial, type MaterialWrapper } from './materials';

import type { Scene } from 'three';
import type { TextData } from '@/canvas/drawables/text';
import type { WorkingFileLayerBlendingMode, WorkingFileTextLayer, ColorModel } from '@/types';

export default class TextLayerRenderer extends BaseLayerRenderer {

    private stopWatchBlendingMode: WatchStopHandle | undefined;
    private stopWatchData: WatchStopHandle | undefined;
    private stopWatchDimensions: WatchStopHandle | undefined;
    private stopWatchFilters: WatchStopHandle | undefined;
    private stopWatchTransform: WatchStopHandle | undefined;
    private stopWatchVisible: WatchStopHandle | undefined;

    private layer!: WorkingFileTextLayer<ColorModel>;

    private planeGeometry: InstanceType<typeof ImagePlaneGeometry> | undefined;
    private materialWrapper: MaterialWrapper | undefined;
    private plane: InstanceType<typeof Mesh> | undefined;
    private texture: InstanceType<typeof Texture> | undefined;

    private drawableCanvas: DrawableCanvas | undefined;
    private textDrawableUuid: string | undefined;
    private isDrawnAfterAttach: boolean = false;
    private waitingToLoadFontFamilies: string[] = [];
    private lastBlendingMode: WorkingFileLayerBlendingMode = 'normal';

    async onAttach(layer: WorkingFileTextLayer<ColorModel>) {
        this.layer = layer;

        this.materialWrapper = await createMaterial('raster', { srcTexture: undefined }, layer.filters, layer, layer.blendingMode);
        this.plane = new Mesh(this.planeGeometry, this.materialWrapper.material);
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
        this.drawableCanvas.onDrawn(async ({ canvas, updateInfo }) => {

            if (this.waitingToLoadFontFamilies.length > 0) {
                notifyFontFamiliesLoaded(this.waitingToLoadFontFamilies);
            }
            const waitingToLoadFontFamilies = updateInfo?.[this.textDrawableUuid ?? '']?.waitingToLoadFontFamilies ?? [];
            if (waitingToLoadFontFamilies.length > 0) {
                this.waitingToLoadFontFamilies = waitingToLoadFontFamilies;
                notifyLoadingFontFamilies(waitingToLoadFontFamilies);
            }

            if (canvas.width <= 1 || canvas.height <= 1) return;

            const { lineDirectionSize, wrapDirectionSize } = updateInfo?.[this.textDrawableUuid ?? ''] ?? {};
            const isHorizontal = ['ltr', 'rtl'].includes(layer.data.lineDirection);

            // TODO - add history event & merge with text update history? The renderer seems like a weird place to be updating history.
            if (waitingToLoadFontFamilies.length === 0) {
                if (isHorizontal) {
                    if (layer.data.boundary === 'dynamic') {
                        layer.width = lineDirectionSize;
                    }
                    layer.height = wrapDirectionSize;
                } else {
                    layer.width = wrapDirectionSize;
                    if (layer.data.boundary === 'dynamic') {
                        layer.height = lineDirectionSize;
                    }
                }
            }

            this.isDrawnAfterAttach = true;
            let newTexture: Texture = await createThreejsTextureFromImage(canvas);

            if (this.planeGeometry?.parameters.width !== canvas.width || this.planeGeometry?.parameters.height !== canvas.height) {
                this.planeGeometry?.dispose();
                this.planeGeometry = new ImagePlaneGeometry(canvas.width, canvas.height);
                if (this.plane) {
                    this.plane.geometry = this.planeGeometry;
                }
            }

            this.texture?.dispose();
            this.texture = newTexture;
            this.texture.needsUpdate = true;
            this.materialWrapper && (this.materialWrapper.material.uniforms.srcTexture.value = this.texture);

            regenerateLayerThumbnail(layer);

            canvasStore.set('dirty', true);
        });

        this.readBufferTextureUpdate = this.readBufferTextureUpdate.bind(this);
        appEmitter.on('renderer.pass.readBufferTextureUpdate', this.readBufferTextureUpdate);

        const { blendingMode, width, height, filters, transform, data, visible } = toRefs(layer);

        this.stopWatchBlendingMode = watch([blendingMode], ([blendingMode]) => {
            this.update({ blendingMode });
        }, { immediate: true });
        this.stopWatchData = watch([data], () => {
            this.update({ data: layer.data });
        }, { deep: true, immediate: true });
        this.stopWatchDimensions = watch([width, height], ([newWidth, newHeight], [oldWidth, oldHeight]) => {
            const isHorizontal = ['ltr', 'rtl'].includes(layer.data.lineDirection);
            if (layer.data.boundary === 'box') {
                if (newWidth !== oldWidth && isHorizontal) {
                    this.update({ width: newWidth });
                } else if (newHeight !== oldHeight && !isHorizontal) {
                    this.update({ height: newHeight });
                }
            }
        }, { deep: true, immediate: true });
        this.stopWatchFilters = watch([filters], async ([filters]) => {
            await createFiltersFromLayerConfig(filters);
            this.update({ filters });
        }, { deep: true, immediate: false });
        this.stopWatchTransform = watch([transform], ([transform]) => {
            this.update({ transform });
        }, { immediate: true });
        this.stopWatchVisible = watch([visible], ([visible]) => {
            this.update({ visible });
        }, { immediate: true });
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

    update(updates: Partial<WorkingFileTextLayer<ColorModel>>) {
        super.update(updates);
    }

    async onUpdate(updates: Partial<WorkingFileTextLayer<ColorModel>>) {
        if (updates.visible != null) {
            this.plane && (this.plane.visible = updates.visible);
        }
        if (updates.blendingMode) {
            this.lastBlendingMode = updates.blendingMode;
            if (this.materialWrapper) {
                this.materialWrapper = this.materialWrapper.changeBlendingMode(updates.blendingMode);
                this.plane && (this.plane.material = this.materialWrapper.material);
                this.materialWrapper && (this.materialWrapper.material.uniforms.srcTexture.value = this.texture);
            }
        }
        if (updates.transform) {
            this.plane?.matrix.set(
                updates.transform.m11, updates.transform.m21, updates.transform.m31, updates.transform.m41,
                updates.transform.m12, updates.transform.m22, updates.transform.m32, updates.transform.m42,
                updates.transform.m13, updates.transform.m23, updates.transform.m33, updates.transform.m43, 
                updates.transform.m14, updates.transform.m24, updates.transform.m34, updates.transform.m44
            );
            canvasStore.set('dirty', true);
        }
        if (updates.filters) {
            const srcTexture = this.materialWrapper?.material.uniforms.srcTexture.value;
            if (this.materialWrapper) {
                disposeMaterial(this.materialWrapper);
            }
            this.materialWrapper = await createMaterial('raster', { srcTexture }, updates.filters, 
            { width: this.planeGeometry?.parameters.width ?? 1, height: this.planeGeometry?.parameters.height ?? 1 },
                this.lastBlendingMode
            );
            this.plane && (this.plane.material = this.materialWrapper.material);
        }
        if (updates.data || updates.width != null || updates.height != null) {
            const isHorizontal = ['ltr', 'rtl'].includes(this.layer.data.lineDirection);
            if (this.drawableCanvas && this.textDrawableUuid) {
                this.drawableCanvas.draw({
                    updates: [
                        {
                            uuid: this.textDrawableUuid,
                            data: {
                                document: updates.data ?? this.layer.data,
                                wrapSize: this.layer.data.boundary === 'box'
                                    ? (isHorizontal ? (updates.width ?? this.layer.width) : (updates.height ?? this.layer.height))
                                    : undefined,
                            }
                        }
                    ]
                });  
            }
        }
    }

    onDetach(): void {
        (this.layer as unknown) = undefined;
        this.drawableCanvas?.dispose();
        this.planeGeometry?.dispose();
        this.planeGeometry = undefined;
        this.plane && (this.threejsScene ?? canvasStore.get('threejsScene'))?.remove(this.plane);
        this.plane = undefined;

        appEmitter.off('renderer.pass.readBufferTextureUpdate', this.readBufferTextureUpdate);

        if (this.materialWrapper) {
            disposeMaterial(this.materialWrapper);
        }
        this.materialWrapper = undefined;
        this.stopWatchBlendingMode?.();
        this.stopWatchData?.();
        this.stopWatchDimensions?.();
        this.stopWatchFilters?.();
        this.stopWatchTransform?.();
        this.stopWatchVisible?.();
        this.isDrawnAfterAttach = false;
    }

    private readBufferTextureUpdate(texture?: Texture) {
        if (!this.materialWrapper) return;
        this.materialWrapper.material.uniforms.dstTexture.value = texture;
        this.materialWrapper.material.uniformsNeedUpdate = true;
    }

}
