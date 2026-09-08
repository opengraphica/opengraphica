import mitt from 'mitt';
import { ref, watch } from 'vue';

import { getLayerById } from '@/store/working-file';

import type { WorkingFileAnyLayer } from '@/types';

export const cursorHoverPosition = ref<DOMPoint>(new DOMPoint());

export const editingLayerIds = ref<number[]>([]);
export const editingLayers = ref<WorkingFileAnyLayer[]>([]);
export const editingLayersRestoreOpacity = ref<number[]>([]);
export const previewOpacity = ref<number>(1);

export const layerOpacityEmitter = mitt();

watch(() => editingLayerIds.value, () => {
    editingLayers.value = [];
    for (const layerId of editingLayerIds.value) {
        const layer = getLayerById(layerId);
        if (layer) {
            editingLayers.value.push(layer);
        }
    }
});