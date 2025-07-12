/**
 * This file watches for changes in the layer definition in the main thread,
 * and passes it to the renderer.
 */

import { toRaw, toRefs, watch, type WatchStopHandle } from 'vue';

import type {
    Webgl2RendererBackendPublic, MeshControllerInterface,
} from '@/renderers/webgl2/backend';
import type { RendererLayerWatcher, WorkingFileRasterSequenceLayer } from '@/types';

export class RasterSequenceLayerWatcher implements RendererLayerWatcher<WorkingFileRasterSequenceLayer> {
    rendererBackend!: Webgl2RendererBackendPublic;
    meshController: MeshControllerInterface | undefined;
    stopWatchName: WatchStopHandle | undefined;
    stopWatchDrafts: WatchStopHandle | undefined;
    stopWatchBlendingMode: WatchStopHandle | undefined;
    stopWatchVisible: WatchStopHandle | undefined;
    stopWatchSize: WatchStopHandle | undefined;
    stopWatchTransform: WatchStopHandle | undefined;
    stopWatchFilters: WatchStopHandle | undefined;
    stopWatchData: WatchStopHandle | undefined;

    constructor(rendererBackend: Webgl2RendererBackendPublic) {
        this.rendererBackend = rendererBackend;
    }

    async attach(layer: WorkingFileRasterSequenceLayer) {
        const { blendingMode, data, drafts, filters, height, name, transform, visible, width } = toRefs(layer);

        this.meshController = await this.rendererBackend.createMeshController('rasterSequence');
        this.meshController.attach(layer.id);

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
            this.meshController?.updateTransform(
                new Float64Array([
                    transform.m11, transform.m21, transform.m31, transform.m41,
                    transform.m12, transform.m22, transform.m32, transform.m42,
                    transform.m13, transform.m23, transform.m33, transform.m43,
                    transform.m14, transform.m24, transform.m34, transform.m44,
                ])
            );
        }, { immediate: true });
    }

    async reorder(order: number) {
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
