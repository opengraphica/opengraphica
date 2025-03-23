import mitt from 'mitt';
import { computed, ref } from 'vue';
import historyStore from '@/store/history';
import workingFileStore, { getSelectedLayers } from '@/store/working-file';
import { ApplyLayerTransformAction } from '@/actions/apply-layer-transform';
import { BundleAction } from '@/actions/bundle';
import { SetLayerBoundsToWorkingFileBoundsAction } from '@/actions/set-layer-bounds-to-working-file-bounds';
import { TrimLayerEmptySpaceAction } from '@/actions/trim-layer-empty-space';
import { isShiftKeyPressed } from '@/lib/keyboard';

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

export const transformOptions = computed(() => {
    let canTranslate: boolean = true;
    let canScale: boolean = true;
    let canRotate: boolean = true;
    let shouldShowUnevenScalingHandles = new Set<boolean>(); // Enables the edge handles with apply uneven scaling
    let shouldMaintainAspectRatio = new Set<boolean>(); // The scale must be applied evenly to layer's width/height
    let shouldScaleDuringResize = new Set<boolean>(); // The scale will be applied to the layer's DOMMatrix
    let shouldSnapRotationDegrees: boolean = useRotationSnapping.value;
    if (isShiftKeyPressed.value === true) {
        shouldMaintainAspectRatio.add(false);
        shouldSnapRotationDegrees = !useRotationSnapping.value;
    }
    if (selectedLayers.value.length === 1) {
        if (selectedLayers.value.find(layer => layer.type === 'text')) {
            shouldShowUnevenScalingHandles.add(false); // Can enable if coded to reuse these handles while maintaining aspect ratio
            shouldMaintainAspectRatio.add(true);
            shouldScaleDuringResize.add(false);
        }
        if (selectedLayers.value.find(layer => layer.type === 'gradient')) {
            shouldShowUnevenScalingHandles.add(false);
            shouldMaintainAspectRatio.add(true);
        }
    }
    if (shouldShowUnevenScalingHandles.size === 0) {
        shouldShowUnevenScalingHandles.add(true);
    }
    if (shouldMaintainAspectRatio.size === 0) {
        shouldMaintainAspectRatio.add(true);
    }
    if (shouldScaleDuringResize.size === 0) {
        shouldScaleDuringResize.add(true);
    }

    if (shouldShowUnevenScalingHandles.size > 1) {
        canScale = false;
    }
    if (shouldMaintainAspectRatio.size > 1) {
        canScale = false;
    }
    if (shouldScaleDuringResize.size > 1) {
        canScale = false;
    }
    return {
        canTranslate, canScale, canRotate,
        shouldShowUnevenScalingHandles: shouldShowUnevenScalingHandles.values().next().value ?? false,
        shouldMaintainAspectRatio: shouldMaintainAspectRatio.values().next().value ?? false,
        shouldScaleDuringResize: shouldScaleDuringResize.values().next().value ?? false,
        shouldSnapRotationDegrees,
    };
});

export const isResizeEnabled = computed<boolean>(() => {
    return transformOptions.value.canScale;
});

export const isUnevenScalingEnabled = computed<boolean>(() => {
    return transformOptions.value.shouldShowUnevenScalingHandles;
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
