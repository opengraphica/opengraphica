import mitt from 'mitt';
import { ref } from 'vue';

export const layerPickMode = ref<'current' | 'auto'>('current');
export const enableSnapping = ref<boolean>(true);
export const top = ref<number>(0);
export const left = ref<number>(0);
export const width = ref<number>(200);
export const height = ref<number>(200);
export const rotation = ref<number>(0);
export const transformOriginX = ref<number>(0.5);
export const transformOriginY = ref<number>(0.5);
export const previewXSnap = ref<number[]>([]);
export const previewYSnap = ref<number[]>([]);
export const dragHandleHighlight = ref<number | null>(null);
export const rotateHandleHighlight = ref<boolean>(false);
export const dimensionLockRatio = ref<number | null>(null);

export const freeTransformEmitter = mitt();

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
