import { toRefs, watch, type WatchStopHandle } from 'vue';
import { DrawWorkingFileLayerOptions, WorkingFileRasterSequenceLayer, ColorModel } from '@/types';
import canvasStore from '@/store/canvas';
import { getStoredImageOrCanvas } from '@/store/image';
import { getCanvasRenderingContext2DSettings } from '@/store/working-file';
import BaseLayerRenderer from './base';
import { ImagePlaneGeometry } from './geometries/image-plane-geometry';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import { DoubleSide, NearestFilter, sRGBEncoding } from 'three/src/constants';
import { Mesh } from 'three/src/objects/Mesh';
import { TextureLoader } from 'three/src/loaders/TextureLoader';
import { Texture } from 'three/src/textures/Texture';
import { CanvasTexture } from 'three/src/textures/CanvasTexture';
import { createFiltersFromLayerConfig, combineShaders } from '../../filters';
import { createRasterShaderMaterial } from './shaders';

export default class RasterSequenceLayerRenderer extends BaseLayerRenderer {
    private stopWatchVisible: WatchStopHandle | undefined;
    private stopWatchSize: WatchStopHandle | undefined;
    private stopWatchTransform: WatchStopHandle | undefined;
    private stopWatchFilters: WatchStopHandle | undefined;
    private stopWatchData: WatchStopHandle | undefined;
    private planeGeometry: InstanceType<typeof ImagePlaneGeometry> | undefined;
    private material: InstanceType<typeof ShaderMaterial> | undefined;
    private plane: InstanceType<typeof Mesh> | undefined;
    private lastUpdatedFrame: WorkingFileRasterSequenceLayer<ColorModel>['data']['currentFrame'] | undefined;
    private textureCanvas: InstanceType<typeof HTMLCanvasElement> | undefined;
    private textureCtx: CanvasRenderingContext2D | undefined;
    private texture: InstanceType<typeof CanvasTexture> | undefined;

    async onAttach(layer: WorkingFileRasterSequenceLayer<ColorModel>) {
        const combinedShaderResult = combineShaders(
            await createFiltersFromLayerConfig(layer.filters),
            layer
        );
        this.material = createRasterShaderMaterial(null, combinedShaderResult);
        this.plane = new Mesh(this.planeGeometry, this.material);
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
        this.texture.encoding = sRGBEncoding;
        this.material && (this.material.uniforms.map.value = this.texture);

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
            this.plane.renderOrder = order;
        }
    }

    update(updates: Partial<WorkingFileRasterSequenceLayer<ColorModel>>) {
        super.update(updates);
    }

    async onUpdate(updates: Partial<WorkingFileRasterSequenceLayer<ColorModel>>) {
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
                { width: this.texture?.image.width, height: this.texture?.image.height }
            );
            const map = this.material?.uniforms.map;
            delete this.material?.uniforms.map;
            this.material?.dispose();
            this.material = createRasterShaderMaterial(map?.value, combinedShaderResult);
            this.plane && (this.plane.material = this.material);
        }
        if (updates.data) {
            if (!this.textureCtx) return;
            this.textureCtx.clearRect(0, 0, this.textureCtx.canvas.width, this.textureCtx.canvas.height);
            if (updates.data.currentFrame) {
                const sourceImage = getStoredImageOrCanvas(updates.data.currentFrame?.sourceUuid ?? '');
                if (sourceImage) {
                    this.textureCtx.drawImage(sourceImage, 0, 0);
                }
                if (this.material?.uniforms.map.value) {
                    this.material.uniforms.map.value.needsUpdate = true;
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
        this.material?.dispose();
        this.material = undefined;
        this.textureCanvas = undefined;
        this.textureCtx = undefined;
        this.texture?.dispose();
        this.texture = undefined;
        this.lastUpdatedFrame = undefined;
        this.stopWatchVisible?.();
        this.stopWatchSize?.();
        this.stopWatchTransform?.();
        this.stopWatchFilters?.();
        this.stopWatchData?.();
    }
}
