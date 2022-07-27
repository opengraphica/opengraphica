import { toRefs, watch, type WatchStopHandle } from 'vue';
import { DrawWorkingFileLayerOptions, WorkingFileRasterSequenceLayer, ColorModel } from '@/types';
import canvasStore from '@/store/canvas';
import BaseLayerRenderer from './base';
import { ImagePlaneGeometry } from './geometries/image-plane-geometry';
import { MeshBasicMaterial } from 'three/src/materials/MeshBasicMaterial';
import { DoubleSide, NearestFilter } from 'three/src/constants';
import { Mesh } from 'three/src/objects/Mesh';
import { TextureLoader } from 'three/src/loaders/TextureLoader';
import { Texture } from 'three/src/textures/Texture';
import { CanvasTexture } from 'three/src/textures/CanvasTexture';

export default class RasterSequenceLayerRenderer extends BaseLayerRenderer {
    private stopWatchVisible: WatchStopHandle | undefined;
    private stopWatchSize: WatchStopHandle | undefined;
    private stopWatchTransform: WatchStopHandle | undefined;
    private stopWatchData: WatchStopHandle | undefined;
    private planeGeometry: InstanceType<typeof ImagePlaneGeometry> | undefined;
    private material: InstanceType<typeof MeshBasicMaterial> | undefined;
    private plane: InstanceType<typeof Mesh> | undefined;
    private lastUpdatedFrame: WorkingFileRasterSequenceLayer<ColorModel>['data']['currentFrame'] | undefined;
    private textureCanvas: InstanceType<typeof HTMLCanvasElement> | undefined;
    private textureCtx: CanvasRenderingContext2D | undefined;
    private texture: InstanceType<typeof CanvasTexture> | undefined;

    onAttach(layer: WorkingFileRasterSequenceLayer<ColorModel>): void {
        this.material = new MeshBasicMaterial({
            transparent: true,
            side: DoubleSide
        });
        this.plane = new Mesh(this.planeGeometry, this.material);
        this.plane.matrixAutoUpdate = false;
        canvasStore.get('threejsScene')?.add(this.plane);

        this.textureCanvas = document.createElement('canvas');
        this.textureCanvas.width = layer.data.currentFrame?.sourceImage?.width || 10;
        this.textureCanvas.height = layer.data.currentFrame?.sourceImage?.height || 10;
        this.textureCtx = this.textureCanvas.getContext('2d') || undefined;
        if (this.textureCtx) {
            this.textureCtx.imageSmoothingEnabled = false;
        }

        this.texture?.dispose();
        this.texture = new CanvasTexture(this.textureCanvas);
        this.texture.magFilter = NearestFilter;
        this.material && (this.material.map = this.texture);

        const { visible, width, height, transform, data } = toRefs(layer);
        this.stopWatchVisible = watch([visible], ([visible]) => {
            this.update({ visible });
        }, { immediate: true });
        this.stopWatchSize = watch([width, height], ([width, height]) => {
            this.update({ width, height });
        }, { immediate: true });
        this.stopWatchTransform = watch([transform], ([transform]) => {
            this.update({ transform });
        }, { immediate: true });
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

    onUpdate(updates: Partial<WorkingFileRasterSequenceLayer<ColorModel>>) {
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
        if (updates.data) {
            if (!this.textureCtx) return;
            this.textureCtx.clearRect(0, 0, this.textureCtx.canvas.width, this.textureCtx.canvas.height);
            if (updates.data.currentFrame) {
                if (updates.data.currentFrame.draftImage) {
                    this.textureCtx.drawImage(updates.data.currentFrame.draftImage, 0, 0);
                } else if (updates.data.currentFrame.sourceImage) {
                    this.textureCtx.drawImage(updates.data.currentFrame.sourceImage, 0, 0);
                }
                if (this.material?.map) {
                    this.material.map.needsUpdate = true;
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
        this.plane && canvasStore.get('threejsScene')?.remove(this.plane);
        this.plane = undefined;
        this.material = undefined;
        this.textureCanvas = undefined;
        this.textureCtx = undefined;
        this.texture?.dispose();
        this.texture = undefined;
        this.lastUpdatedFrame = undefined;
        this.stopWatchVisible?.();
        this.stopWatchSize?.();
        this.stopWatchTransform?.();
        this.stopWatchData?.();
    }
}
