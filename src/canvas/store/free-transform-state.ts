import mitt from 'mitt';
import { computed, ref } from 'vue';
import historyStore from '@/store/history';
import workingFileStore, { getSelectedLayers } from '@/store/working-file';
import { ApplyLayerTransformAction } from '@/actions/apply-layer-transform';
import { BundleAction } from '@/actions/bundle';
import { SetLayerBoundsToWorkingFileBoundsAction } from '@/actions/set-layer-bounds-to-working-file-bounds';
import { TrimLayerEmptySpaceAction } from '@/actions/trim-layer-empty-space';

import type { WorkingFileLayer, ColorModel } from '@/types';

export const isBoundsIndeterminate = ref<boolean>(false);
export const layerPickMode = ref<'current' | 'auto'>('auto');
export const useRotationSnapping = ref<boolean>(false);
export const top = ref<number>(0);
export const left = ref<number>(0);
export const width = ref<number>(200);
export const height = ref<number>(200);
export const rotation = ref<number>(0); // Radians
export const transformOriginX = ref<number>(0.5);
export const transformOriginY = ref<number>(0.5);
export const previewXSnap = ref<number[]>([]);
export const previewYSnap = ref<number[]>([]);
export const dragHandleHighlight = ref<number | null>(null);
export const rotateHandleHighlight = ref<boolean>(false);
export const dimensionLockRatio = ref<number | null>(null);
export const selectedLayers = ref<WorkingFileLayer<ColorModel>[]>([]);

export const freeTransformEmitter = mitt();

export const isResizeEnabled = computed<boolean>(() => {
    const selectedLayers = getSelectedLayers(workingFileStore.state.selectedLayerIds);
    let isEnabled = true;
    for (const layer of selectedLayers) {
        if (layer.type === 'text') {
            isEnabled = false;
            break;
        }
    }
    return isEnabled;
});

freeTransformEmitter.on('setDimensions', (event?: { top?: number, left?: number, width?: number, height?: number, rotation?: number, transformOriginX?: number, transformOriginY?: number }) => {
    if (event) {
        if (event.transformOriginX != null) {
            transformOriginX.value = event.transformOriginX;
        }
        if (event.transformOriginY != null) {
            transformOriginY.value = event.transformOriginY;
        }
        if (event.rotation != null) {
            rotation.value = event.rotation;
        }
        if (event.left != null) {
            left.value = event.left;
        }
        if (event.top != null) {
            top.value = event.top;
        }
        if (event.width != null) {
            width.value = event.width;
        }
        if (event.height != null) {
            height.value = event.height;
        }
    }
});

export async function applyTransform() {
    try {
        const actions: ApplyLayerTransformAction[] = [];
        for (const layerId of workingFileStore.state.selectedLayerIds) {
            actions.push(new ApplyLayerTransformAction(layerId));
        }
        await historyStore.dispatch('runAction', {
            action: new BundleAction('applyLayerTransform', 'action.applyLayerTransform', actions),
            blockInteraction: true,
        });
    } catch (error) {
        console.error('[src/canvas/store/free-transform-state.ts] Error occurred during apply transform.', error);
    }
}

export async function trimEmptySpace() {
    try {
        const actions: TrimLayerEmptySpaceAction[] = [];
        for (const layerId of workingFileStore.state.selectedLayerIds) {
            actions.push(new TrimLayerEmptySpaceAction(layerId));
        }
        await historyStore.dispatch('runAction', {
            action: new BundleAction('trimLayerEmptySpace', 'action.trimLayerEmptySpace', actions),
            blockInteraction: true,
        });
    } catch (error) {
        console.error('[src/canvas/store/free-transform-state.ts] Error occurred during trim empty space.', error);
    }
}

export async function layerToImageBounds() {
    try {
        const actions: SetLayerBoundsToWorkingFileBoundsAction[] = [];
        for (const layerId of workingFileStore.state.selectedLayerIds) {
            actions.push(new SetLayerBoundsToWorkingFileBoundsAction(layerId));
        }
        await historyStore.dispatch('runAction', {
            action: new BundleAction('setLayerBoundsToWorkingFileBounds', 'action.setLayerBoundsToWorkingFileBounds', actions),
            blockInteraction: true,
        });
    } catch (error) {
        console.error('[src/canvas/store/free-transform-state.ts] Error occurred during trim empty space.', error);
    }
}
