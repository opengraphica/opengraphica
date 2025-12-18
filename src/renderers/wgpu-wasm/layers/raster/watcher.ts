/**
 * This file watches for changes in the layer definition in the main thread,
 * and passes it to the renderer.
 */

import { toRaw, toRefs, watch, type WatchStopHandle } from 'vue';

import type {
    WgpuWasmRendererBackendPublic, MeshControllerInterface,
} from '@/renderers/wgpu-wasm/backend';
import type { RendererLayerWatcher, WorkingFileRasterLayer } from '@/types';

export class RasterLayerWatcher implements RendererLayerWatcher<WorkingFileRasterLayer> {
    rendererBackend!: WgpuWasmRendererBackendPublic;
    meshController: MeshControllerInterface | undefined;
    order: number | undefined = undefined;
    transform: Float32Array;
    stopWatchName: WatchStopHandle | undefined;
    stopWatchDrafts: WatchStopHandle | undefined;
    stopWatchBlendingMode: WatchStopHandle | undefined;
    stopWatchVisible: WatchStopHandle | undefined;
    stopWatchSize: WatchStopHandle | undefined;
    stopWatchTransform: WatchStopHandle | undefined;
    stopWatchFilters: WatchStopHandle | undefined;
    stopWatchData: WatchStopHandle | undefined;

    constructor(rendererBackend: WgpuWasmRendererBackendPublic) {
        this.rendererBackend = rendererBackend;
        this.transform = new Float32Array([
            1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            0.0, 0.0, 0.0, 1.0,
        ]);
    }

    async attach(layer: WorkingFileRasterLayer) {
        const { blendingMode, data, drafts, filters, height, name, transform, visible, width } = toRefs(layer);

        this.meshController = await this.rendererBackend.createMeshController('raster');
        this.meshController.attach(layer.id);
        if (this.order != undefined) {
            this.meshController.reorder(this.order);
        }

        this.stopWatchBlendingMode = watch([blendingMode], ([blendingMode]) => {
            this.meshController?.updateBlendingMode(blendingMode);
        }, { immediate: true });
        this.stopWatchData = watch([data], () => {
            this.meshController?.updateData(toRaw(layer.data));
        }, { deep: true, immediate: true });
        this.stopWatchFilters = watch([filters], async ([filters]) => {
            this.meshController?.updateFilters(toRaw(filters));
        }, { deep: true, immediate: true });
        this.stopWatchName = watch([name], ([name]) => {
            this.meshController?.updateName(name);
        }, { immediate: true });
        this.stopWatchSize = watch([width, height], ([width, height]) => {
            this.meshController?.updateSize(width, height);
        }, { immediate: true });
        this.stopWatchVisible = watch([visible], ([visible]) => {
            this.meshController?.updateVisible(visible);
        }, { immediate: true });
        this.stopWatchTransform = watch([transform], ([transform]) => {
            this.transform[0] = transform.m11; this.transform[1] = transform.m12;
            this.transform[2] = transform.m13; this.transform[3] = transform.m14;
            this.transform[4] = transform.m21; this.transform[5] = transform.m22;
            this.transform[6] = transform.m23; this.transform[7] = transform.m24;
            this.transform[8] = transform.m31; this.transform[9] = transform.m32;
            this.transform[10] = transform.m33; this.transform[11] = transform.m34;
            this.transform[12] = transform.m41; this.transform[13] = transform.m42;
            this.transform[14] = transform.m43; this.transform[15] = transform.m44;
            this.meshController?.updateTransform(this.transform);
        }, { immediate: true });
    }

    async reorder(order: number) {
        this.order = order;
        this.meshController?.reorder(order);
    }

    async detach() {
        this.meshController?.detach();
        this.stopWatchBlendingMode?.();
        this.stopWatchData?.();
        this.stopWatchDrafts?.();
        this.stopWatchFilters?.();
        this.stopWatchName?.();
        this.stopWatchSize?.();
        this.stopWatchTransform?.();
        this.stopWatchVisible?.();

        this.meshController = undefined;
        this.order = undefined;
        this.stopWatchBlendingMode = undefined;
        this.stopWatchData = undefined;
        this.stopWatchDrafts = undefined;
        this.stopWatchFilters = undefined;
        this.stopWatchName = undefined;
        this.stopWatchSize = undefined;
        this.stopWatchTransform = undefined;
        this.stopWatchVisible = undefined;
    }
}
