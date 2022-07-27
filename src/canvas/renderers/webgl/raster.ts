import { toRefs, watch, type WatchStopHandle } from 'vue';
import { WorkingFileRasterLayer, ColorModel } from '@/types';
import canvasStore from '@/store/canvas';
import BaseLayerRenderer from './base';
import { ImagePlaneGeometry } from './geometries/image-plane-geometry';
import { MeshBasicMaterial } from 'three/src/materials/MeshBasicMaterial';
import { DoubleSide, NearestFilter } from 'three/src/constants';
import { Mesh } from 'three/src/objects/Mesh';
import { TextureLoader } from 'three/src/loaders/TextureLoader';
import { Texture } from 'three/src/textures/Texture';
import { CanvasTexture } from 'three/src/textures/CanvasTexture';

export default class RasterLayerRenderer extends BaseLayerRenderer {
    private stopWatchVisible: WatchStopHandle | undefined;
    private stopWatchSize: WatchStopHandle | undefined;
    private stopWatchTransform: WatchStopHandle | undefined;
    private stopWatchData: WatchStopHandle | undefined;
    private planeGeometry: InstanceType<typeof ImagePlaneGeometry> | undefined;
    private material: InstanceType<typeof MeshBasicMaterial> | undefined;
    private plane: InstanceType<typeof Mesh> | undefined;
    private draftTexture: InstanceType<typeof Texture> | undefined;
    private bakedTexture: InstanceType<typeof Texture> | undefined;
    private sourceTexture: InstanceType<typeof Texture> | undefined;

    onAttach(layer: WorkingFileRasterLayer<ColorModel>): void {
        this.material = new MeshBasicMaterial({
            transparent: true,
            side: DoubleSide
        });
        this.plane = new Mesh(this.planeGeometry, this.material);
        this.plane.matrixAutoUpdate = false;
        canvasStore.get('threejsScene')?.add(this.plane);

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

    update(updates: Partial<WorkingFileRasterLayer<ColorModel>>) {
        super.update(updates);
    }

    onUpdate(updates: Partial<WorkingFileRasterLayer<ColorModel>>) {
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
            if (updates.data.draftImage) {
                this.draftTexture?.dispose();
                this.draftTexture = new CanvasTexture(updates.data.draftImage);
                this.draftTexture.magFilter = NearestFilter;
                this.material && (this.material.map = this.draftTexture);
            } else {
                if (this.draftTexture) {
                    this.draftTexture.dispose();
                    this.draftTexture = undefined;
                }
                if (updates.data.sourceImage) {
                    this.sourceTexture?.dispose();
                    this.sourceTexture = new TextureLoader().load(
                        updates.data.sourceImage.src,
                        () => {
                            canvasStore.set('dirty', true);
                        }
                    );
                    this.sourceTexture.magFilter = NearestFilter;
                    this.material && (this.material.map = this.sourceTexture);
                } else {
                    if (this.sourceTexture) {
                        this.sourceTexture.dispose();
                        this.sourceTexture = undefined;
                    }
                    this.material && (this.material.map = null);
                }
            }
        }
    }
    
    onDetach(): void {
        this.planeGeometry?.dispose();
        this.planeGeometry = undefined;
        this.plane && canvasStore.get('threejsScene')?.remove(this.plane);
        this.plane = undefined;
        this.material = undefined;
        this.draftTexture?.dispose();
        this.draftTexture = undefined;
        this.sourceTexture?.dispose();
        this.sourceTexture = undefined;
        this.stopWatchVisible?.();
        this.stopWatchSize?.();
        this.stopWatchTransform?.();
        this.stopWatchData?.();
    }
}
