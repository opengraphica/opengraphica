import mitt from 'mitt';
import { computed, ref } from 'vue';

import { PerformantStore } from '@/store/performant-store';
import historyStore from '@/store/history';
import workingFileStore, { getSelectedLayers, getLayerGlobalTransform } from '@/store/working-file';

import { ApplyLayerTransformAction } from '@/actions/apply-layer-transform';
import { BaseAction } from '@/actions/base';
import { BundleAction } from '@/actions/bundle';
import { SetLayerBoundsToWorkingFileBoundsAction } from '@/actions/set-layer-bounds-to-working-file-bounds';
import { TrimLayerEmptySpaceAction } from '@/actions/trim-layer-empty-space';
import { UpdateLayerAction } from '@/actions/update-layer';

import { decomposeMatrix } from '@/lib/dom-matrix';
import { isShiftKeyPressed } from '@/lib/keyboard';
import { isEqualApprox } from '@/lib/math';

import type { WorkingFileLayer, ColorModel } from '@/types';

interface PermanentStorageState {
    useSnapping: boolean;
    useRotationSnapping: boolean;
    rotationSnappingDegrees: number;
    useCanvasEdgeSnapping: boolean;
    useLayerEdgeSnapping: boolean;
    useLayerCenterSnapping: boolean;
}

const permanentStorage = new PerformantStore<{ dispatch: {}, state: PermanentStorageState }>({
    name: 'eraseBrushStateStore',
    state: {
        useSnapping: true,
        useRotationSnapping: false,
        rotationSnappingDegrees: 15,
        useCanvasEdgeSnapping: false,
        useLayerEdgeSnapping: false,
        useLayerCenterSnapping: false,
    },
    restore: [
        'useSnapping', 'useRotationSnapping', 'rotationSnappingDegrees', 'useCanvasEdgeSnapping',
        'useLayerEdgeSnapping', 'useLayerCenterSnapping',
    ],
});

export const useSnapping = permanentStorage.getWritableRef('useSnapping');
export const useRotationSnapping = permanentStorage.getWritableRef('useRotationSnapping');
export const rotationSnappingDegrees = permanentStorage.getWritableRef('rotationSnappingDegrees');
export const useCanvasEdgeSnapping = permanentStorage.getWritableRef('useCanvasEdgeSnapping');
export const useLayerEdgeSnapping = permanentStorage.getWritableRef('useLayerEdgeSnapping');
export const useLayerCenterSnapping = permanentStorage.getWritableRef('useLayerCenterSnapping');

export const isBoundsIndeterminate = ref<boolean>(false);
export const layerPickMode = ref<'current' | 'auto'>('auto');
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

export const snapLineX = ref<number[]>([]);
export const snapLineY = ref<number[]>([]);

export const freeTransformEmitter = mitt();

export const snappingDockTop = ref(0);
export const snappingDockLeft = ref(0);
export const snappingDockVisible = ref<boolean>(false);

export const metricsDockTop = ref(0);
export const metricsDockLeft = ref(0);
export const metricsDockVisible = ref<boolean>(false);

export const transformOptions = computed(() => {
    let canTranslate: boolean = true;
    let canScale: boolean = true;
    let canRotate: boolean = true;
    let shouldShowUnevenScalingHandles = new Set<boolean>(); // Enables the edge handles with apply uneven scaling
    let shouldMaintainAspectRatio = new Set<boolean>(); // The scale must be applied evenly to layer's width/height
    let shouldScaleDuringResize = new Set<boolean>(); // The scale will be applied to the layer's DOMMatrix, otherwise width/height are changed
    let shouldSnapRotationDegrees: boolean = useSnapping.value && useRotationSnapping.value;
    if (isShiftKeyPressed.value === true) {
        shouldMaintainAspectRatio.add(false);
        shouldSnapRotationDegrees = !(useSnapping.value && useRotationSnapping.value);
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

/*----------------------*\
| Layer Canvas Alignment |
\*----------------------*/

function getLayerCornerBounds(layer: WorkingFileLayer) {
    const globalTransform = getLayerGlobalTransform(layer);
    const topLeft = new DOMPoint(0, 0).matrixTransform(globalTransform);
    const topRight = new DOMPoint(layer.width, 0).matrixTransform(globalTransform);
    const bottomLeft = new DOMPoint(0, layer.height).matrixTransform(globalTransform);
    const bottomRight = new DOMPoint(layer.width, layer.height).matrixTransform(globalTransform);
    return {
        globalTransform,
        left: Math.min(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x),
        right: Math.max(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x),
        top: Math.min(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y),
        bottom: Math.max(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y),
    }
}

function createLayerTransformAction(layer: WorkingFileLayer, globalTransform, x: number, y: number): UpdateLayerAction<any> {
    const decomposedTransform = decomposeMatrix(globalTransform);
    return new UpdateLayerAction({
        id: layer.id,
        transform: layer.transform
            .rotate(-decomposedTransform.rotation * Math.RADIANS_TO_DEGREES)
            .scale(1 / decomposedTransform.scaleX, 1 / decomposedTransform.scaleY)
            .translate(x, y)
            .scale(decomposedTransform.scaleX, decomposedTransform.scaleY)
            .rotate(decomposedTransform.rotation * Math.RADIANS_TO_DEGREES),
    });
}

export async function alignSelectedLayersToCanvas(position: 'left' | 'right' | 'horizontalCenter' | 'top' | 'bottom' | 'verticalCenter') {
    const actions: UpdateLayerAction<any>[] = [];
    for (const layer of selectedLayers.value) {
        const bounds = getLayerCornerBounds(layer);
        let isRunAction = false;
        let x = 0;
        let y = 0;
        if (position === 'left') {
            isRunAction = !isEqualApprox(bounds.left, 0);
            x = -bounds.left;
        } else if (position === 'right') {
            isRunAction = !isEqualApprox(bounds.right, workingFileStore.get('width'));
            x = workingFileStore.get('width') - bounds.right;
        } else if (position === 'horizontalCenter') {
            isRunAction = !isEqualApprox((bounds.left + bounds.right) / 2, workingFileStore.get('width') / 2);
            x = ((workingFileStore.get('width') - (bounds.right - bounds.left)) / 2) - bounds.left;
        } else if (position === 'top') {
            isRunAction = !isEqualApprox(bounds.top, 0);
            y = -bounds.top;
        } else if (position === 'bottom') {
            isRunAction = !isEqualApprox(bounds.bottom, workingFileStore.get('height'));
            y = workingFileStore.get('height') - bounds.bottom;
        } else if (position === 'verticalCenter') {
            isRunAction = !isEqualApprox((bounds.top + bounds.bottom) / 2, workingFileStore.get('height') / 2);
            y = ((workingFileStore.get('height') - (bounds.bottom - bounds.top)) / 2) - bounds.top;
        }
        if (isRunAction) {
            actions.push(
                createLayerTransformAction(layer, bounds.globalTransform, x, y)
            );
        }
    }
    if (actions.length > 0) {
        await historyStore.dispatch('runAction', {
            action: new BundleAction('alignLayers', 'action.freeTransformTranslate', actions),
        });
    }
}

/*----------------------*\
| Reset Layer Dimensions |
\*----------------------*/

export async function resetSelectedLayerWidths() {
    if (!isResizeEnabled.value) return;

    const actions: UpdateLayerAction<any>[] = [];
    for (const layer of selectedLayers.value) {
        const decomposedTransform = decomposeMatrix(layer.transform);
        const scaleX = 1;
        const scaleY = (isUnevenScalingEnabled.value) ? decomposedTransform.scaleY : 1;

        if (decomposedTransform.scaleX !== scaleX) {
            actions.push(new UpdateLayerAction({
                id: layer.id,
                transform: new DOMMatrix()
                    .translateSelf(decomposedTransform.translateX, decomposedTransform.translateY)
                    .rotateSelf(decomposedTransform.rotation * Math.RADIANS_TO_DEGREES)
                    .scaleSelf(scaleX, scaleY)
            }));
        }
    }
    if (actions.length > 0) {
        await historyStore.dispatch('runAction', {
            action: new BundleAction('resetLayerWidths', 'action.freeTransformScale', actions),
        });
    }
}

export async function resetSelectedLayerHeights() {
    if (!isResizeEnabled.value) return;

    const actions: UpdateLayerAction<any>[] = [];
    for (const layer of selectedLayers.value) {
        const decomposedTransform = decomposeMatrix(layer.transform);
        const scaleX = (isUnevenScalingEnabled.value) ? decomposedTransform.scaleX : 1;
        const scaleY = 1;

        if (decomposedTransform.scaleY !== scaleY) {
            actions.push(new UpdateLayerAction({
                id: layer.id,
                transform: new DOMMatrix()
                    .translateSelf(decomposedTransform.translateX, decomposedTransform.translateY)
                    .rotateSelf(decomposedTransform.rotation * Math.RADIANS_TO_DEGREES)
                    .scaleSelf(scaleX, scaleY)
            }));
        }
    }
    if (actions.length > 0) {
        await historyStore.dispatch('runAction', {
            action: new BundleAction('resetLayerHeights', 'action.freeTransformScale', actions),
        });
    }
}

/*-------*\
| Actions |
\*-------*/

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
        console.error('[src/canvas/store/free-transform-state.ts] Error occurred during expand empty space.', error);
    }
}

export async function stretchToImageBounds() {
    try {
        const actions: BaseAction[] = [];
        for (const layer of selectedLayers.value) {
            const globalTransform = getLayerGlobalTransform(layer, { excludeSelf: true });
            actions.push(new UpdateLayerAction({
                id: layer.id,
                transform: new DOMMatrix()
                    .scaleSelf(layer.width / workingFileStore.get('width'), layer.height / workingFileStore.get('height'))
                    .multiplySelf(globalTransform.inverse())
            }));
        }
        await historyStore.dispatch('runAction', {
            action: new BundleAction('stretchLayerToWorkingFileBounds', 'action.stretchLayerToWorkingFileBounds', actions),
            blockInteraction: true,
        });
    } catch (error) {
        console.error('[src/canvas/store/free-transform-state.ts] Error occurred during stretch to image bounds.', error);
    }
}

