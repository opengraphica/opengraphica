import mitt from 'mitt';
import { ref, reactive } from 'vue';
import workingFileStore, { getCanvasRenderingContext2DSettings } from '@/store/working-file';
import { drawWorkingFileToCanvas2d } from '@/lib/canvas';
import { createImageFromCanvas, getImageDataEmptyBounds } from '@/lib/image';
import { PerformantStore } from '@/store/performant-store';

import type { WorkingFileLayerBlendingMode } from '@/types';

export type SelectionAddShape = 'rectangle' | 'ellipse' | 'free' | 'tonalArea';
export type SelectionCombineMode = 'add' | 'subtract' | 'intersect' | 'replace';

interface PermanentStorageState {
    selectionAddShape: SelectionAddShape;
    selectionCombineMode: SelectionCombineMode;
}

const permanentStorage = new PerformantStore<{ dispatch: {}, state: PermanentStorageState }>({
    name: 'selectionStateStore',
    state: {
        selectionAddShape: 'rectangle',
        selectionCombineMode: 'add',
    },
    restore: ['selectionAddShape', 'selectionCombineMode']
});

export const selectionAddShape = permanentStorage.getWritableRef('selectionAddShape');
export const selectionCombineMode = permanentStorage.getWritableRef('selectionCombineMode');
export const isDrawingSelection = ref<boolean>(false);
// Applied selection mask is the selection that has already been applied by the user. It does not include the path the user is currently working on selecting.
export const appliedSelectionMask = ref<InstanceType<typeof Image> | null>(null);
export const appliedSelectionMaskCanvasOffset = ref<DOMPoint>(new DOMPoint());
// Active selection mask is a preview of what appliedSelectionMask will look like when the selection shape is applied. It is not tracked in history.
export const activeSelectionMask = ref<InstanceType<typeof Image> | null>(null);
export const activeSelectionMaskCanvasOffset = ref<DOMPoint>(new DOMPoint());
// Selected layers selection mask is a preview of the selection mask including all the currently selected layers when the user enters the selection tool, for clarity. It is not tracked in history.
export const selectedLayersSelectionMaskPreview = ref<InstanceType<typeof Image> | null>(null);
export const selectedLayersSelectionMaskPreviewCanvasOffset = ref<DOMPoint>(new DOMPoint());
export const selectionMaskDrawMargin = ref<number>(1);

export interface SelectionPathPointBase {
    type: 'move' | 'line' | 'quadraticBezierCurve';
    x: number;
    y: number;
}

export interface SelectionPathPointMove extends SelectionPathPointBase {
    type: 'move';
}

export interface SelectionPathPointLine extends SelectionPathPointBase {
    type: 'line';
}

export interface SelectionPathPointQuadraticBezierCurve extends SelectionPathPointBase {
    type: 'quadraticBezierCurve';
    shx: number; // Point for bezier curve starting handle, x axis
    shy: number; // Point for bezier curve starting handle, y axis
    ehx: number; // Point for bezier curve ending handle, x axis
    ehy: number; // Point for bezier curve ending handle, y axis
}

export type SelectionPathPoint = SelectionPathPointMove | SelectionPathPointLine | SelectionPathPointQuadraticBezierCurve;

export const activeSelectionPath = ref<Array<SelectionPathPoint>>([]);

export const selectionEmitter = mitt();

export interface SelectionBounds { left: number; right: number; top: number; bottom: number; };

export function getActiveSelectionBounds(activeSelectionPathOverride: Array<SelectionPathPoint> = activeSelectionPath.value): SelectionBounds {
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (const point of activeSelectionPathOverride) {
        if (point.x < left) {
            left = point.x;
        }
        if (point.x > right) {
            right = point.x;
        }
        if (point.y < top) {
            top = point.y;
        }
        if (point.y > bottom) {
            bottom = point.y;
        }
        if (point.type === 'quadraticBezierCurve') {
            if (point.shx < left) {
                left = point.shx;
            }
            if (point.shx > right) {
                right = point.shx;
            }
            if (point.shy < top) {
                top = point.shy;
            }
            if (point.shy > bottom) {
                bottom = point.shy;
            }
            if (point.ehx < left) {
                left = point.ehx;
            }
            if (point.ehx > right) {
                right = point.ehx;
            }
            if (point.ehy < top) {
                top = point.ehy;
            }
            if (point.ehy > bottom) {
                bottom = point.ehy;
            }
        }
    }
    return { left, right, top, bottom };
}

export async function previewActiveSelectionMask(activeSelectionPathOverride: Array<SelectionPathPoint> = activeSelectionPath.value) {
    let drawMargin: number = selectionMaskDrawMargin.value;
    if (activeSelectionPathOverride.length > 0) {
        const activeSelectionBounds = getActiveSelectionBounds(activeSelectionPathOverride);
        const newActiveSelectionMaskCanvas = await createActiveSelectionMask(activeSelectionBounds, activeSelectionPathOverride);
        const newActiveSelectionMask = await new Promise<InstanceType<typeof Image>>((resolve, reject) => {
            try {
                newActiveSelectionMaskCanvas.toBlob((blob) => {
                    if (blob) {
                        let image = new Image();
                        image.onload = () => {
                            resolve(image);
                            (image as any) = null;
                        };
                        image.onerror = (error) => {
                            reject(error);
                            (image as any) = null;
                        };
                        image.src = URL.createObjectURL(blob);
                    } else {
                        reject(new Error('Canvas blob not created when drawing new selection shape.'));
                    }
                }, 'image/png', 1);
            } catch (error) {
                reject(error);
            }
        });
        if (activeSelectionMask.value) {
            URL.revokeObjectURL(activeSelectionMask.value.src);
        }
        activeSelectionMask.value = newActiveSelectionMask;
        activeSelectionMaskCanvasOffset.value.x = activeSelectionBounds.left - drawMargin;
        activeSelectionMaskCanvasOffset.value.y = activeSelectionBounds.top - drawMargin;
    } else {
        if (activeSelectionMask.value) {
            URL.revokeObjectURL(activeSelectionMask.value.src);
        }
        activeSelectionMask.value = null;
        activeSelectionMaskCanvasOffset.value.x = 0;
        activeSelectionMaskCanvasOffset.value.y = 0;
    }
}

export async function previewSelectedLayersSelectionMask() {
    let drawMargin: number = selectionMaskDrawMargin.value;

    let workingCanvas = document.createElement('canvas');
    workingCanvas.width = workingFileStore.get('width');
    workingCanvas.height = workingFileStore.get('height');
    let ctx = workingCanvas.getContext('2d', getCanvasRenderingContext2DSettings());
    if (!ctx) throw new Error('Couldn\'t draw to a new canvas when trying to apply selection mask.');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, workingCanvas.width, workingCanvas.height);
    ctx.globalCompositeOperation = 'destination-in';
    drawWorkingFileToCanvas2d(workingCanvas, ctx, { disableViewportTransform: true, selectedLayersOnly: true });
    // TODO - perhaps trim mask image before storing to save memory, if not too much CPU cost.

    if (selectedLayersSelectionMaskPreview.value) {
        URL.revokeObjectURL(selectedLayersSelectionMaskPreview.value.src);
    }
    selectedLayersSelectionMaskPreview.value = await createImageFromCanvas(workingCanvas);
    selectedLayersSelectionMaskPreviewCanvasOffset.value.x = 0;
    selectedLayersSelectionMaskPreviewCanvasOffset.value.y = 0;
}

export function discardSelectedLayersSelectionMask() {
    if (selectedLayersSelectionMaskPreview.value) {
        URL.revokeObjectURL(selectedLayersSelectionMaskPreview.value.src);
    }
    selectedLayersSelectionMaskPreview.value = null;
    selectedLayersSelectionMaskPreviewCanvasOffset.value.x = 0;
    selectedLayersSelectionMaskPreviewCanvasOffset.value.y = 0;
}

export function discardAppliedSelectionMask() {
    if (appliedSelectionMask.value) {
        URL.revokeObjectURL(appliedSelectionMask.value.src);
    }
    appliedSelectionMask.value = null;
    appliedSelectionMaskCanvasOffset.value.x = 0;
    appliedSelectionMaskCanvasOffset.value.y = 0;
}

export function discardActiveSelectionMask() {
    if (activeSelectionMask.value) {
        URL.revokeObjectURL(activeSelectionMask.value.src);
    }
    activeSelectionMask.value = null;
    activeSelectionMaskCanvasOffset.value.x = 0;
    activeSelectionMaskCanvasOffset.value.y = 0;
}

export async function createActiveSelectionMask(activeSelectionBounds: SelectionBounds, activeSelectionPathOverride: Array<SelectionPathPoint> = activeSelectionPath.value): Promise<HTMLCanvasElement> {
    let drawMargin: number = selectionMaskDrawMargin.value;

    if (appliedSelectionMask.value != null) {
        if (appliedSelectionMaskCanvasOffset.value.x < activeSelectionBounds.left) {
            activeSelectionBounds.left = appliedSelectionMaskCanvasOffset.value.x;
        }
        if (appliedSelectionMaskCanvasOffset.value.y < activeSelectionBounds.top) {
            activeSelectionBounds.top = appliedSelectionMaskCanvasOffset.value.y;
        }
        if (appliedSelectionMaskCanvasOffset.value.x + appliedSelectionMask.value.width > activeSelectionBounds.right) {
            activeSelectionBounds.right = appliedSelectionMaskCanvasOffset.value.x + appliedSelectionMask.value.width;
        }
        if (appliedSelectionMaskCanvasOffset.value.y + appliedSelectionMask.value.height > activeSelectionBounds.bottom) {
            activeSelectionBounds.bottom = appliedSelectionMaskCanvasOffset.value.y + appliedSelectionMask.value.height;
        }
    } else if (selectionCombineMode.value === 'subtract') {
        activeSelectionBounds.left = 0;
        activeSelectionBounds.top = 0;
        activeSelectionBounds.right = workingFileStore.get('width');
        activeSelectionBounds.bottom = workingFileStore.get('height');
    }
    const workingCanvas = document.createElement('canvas');
    workingCanvas.width = (activeSelectionBounds.right - activeSelectionBounds.left) + (drawMargin * 2);
    workingCanvas.height = (activeSelectionBounds.bottom - activeSelectionBounds.top) + (drawMargin * 2);
    const ctx = workingCanvas.getContext('2d', getCanvasRenderingContext2DSettings());
    if (!ctx) throw new Error('Couldn\'t draw to a new canvas when trying to apply selection mask.');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, workingCanvas.width, workingCanvas.height);
    ctx.fillStyle = '#000000';
    if (appliedSelectionMask.value != null) {
        ctx.drawImage(appliedSelectionMask.value, appliedSelectionMaskCanvasOffset.value.x - activeSelectionBounds.left + drawMargin, appliedSelectionMaskCanvasOffset.value.y - activeSelectionBounds.top + drawMargin);
    }
    if (selectionCombineMode.value === 'subtract') {
        if (!appliedSelectionMask.value) {
            ctx.fillRect(0, 0, workingCanvas.width, workingCanvas.height);
        }
        ctx.globalCompositeOperation = 'destination-out';
    } else if (selectionCombineMode.value === 'intersect') {
        if (!appliedSelectionMask.value) {
            ctx.fillRect(0, 0, workingCanvas.width, workingCanvas.height);
        }
        ctx.globalCompositeOperation = 'destination-in';
    }
    ctx.beginPath();
    for (const point of activeSelectionPathOverride) {
        if (point.type === 'move') {
            ctx.moveTo(point.x - activeSelectionBounds.left + drawMargin, point.y - activeSelectionBounds.top + drawMargin);
        } else if (point.type === 'line') {
            ctx.lineTo(point.x - activeSelectionBounds.left + drawMargin, point.y - activeSelectionBounds.top + drawMargin);
        } else if (point.type === 'quadraticBezierCurve') {
            ctx.bezierCurveTo(
                point.shx - activeSelectionBounds.left + drawMargin,
                point.shy - activeSelectionBounds.top + drawMargin,
                point.ehx - activeSelectionBounds.left + drawMargin,
                point.ehy - activeSelectionBounds.top + drawMargin,
                point.x - activeSelectionBounds.left + drawMargin,
                point.y - activeSelectionBounds.top + drawMargin
            );
        }
    }
    ctx.closePath();
    ctx.fill();
    return workingCanvas;
}

export async function blitActiveSelectionMask(toImage: HTMLImageElement | HTMLCanvasElement, layerTransform: DOMMatrix, compositeOperation: WorkingFileLayerBlendingMode = 'source-in'): Promise<HTMLCanvasElement> {
    return blitSpecifiedSelectionMask(
        activeSelectionMask.value,
        activeSelectionMaskCanvasOffset.value,
        toImage,
        layerTransform,
        compositeOperation
    );
}

export async function blitSpecifiedSelectionMask(selectionMask: HTMLImageElement | null, selectionMaskCanvasOffset: DOMPoint, toImage: HTMLImageElement | HTMLCanvasElement, layerTransform: DOMMatrix, compositeOperation: WorkingFileLayerBlendingMode = 'source-in'): Promise<HTMLCanvasElement> {
    if (selectionMask == null) throw new Error('Active selection mask does not exist.');
    const workingCanvas = document.createElement('canvas');
    workingCanvas.width = toImage.width;
    workingCanvas.height = toImage.height;
    const ctx = workingCanvas.getContext('2d', getCanvasRenderingContext2DSettings());
    if (!ctx) throw new Error('Couldn\'t draw to a new canvas when trying to blit selection mask.');
    const tranformInverse = layerTransform.inverse();
    ctx.transform(tranformInverse.a, tranformInverse.b, tranformInverse.c, tranformInverse.d, tranformInverse.e, tranformInverse.f);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(selectionMask, selectionMaskCanvasOffset.x, selectionMaskCanvasOffset.y);
    ctx.transform(layerTransform.a, layerTransform.b, layerTransform.c, layerTransform.d, layerTransform.e, layerTransform.f);
    ctx.globalCompositeOperation = compositeOperation;
    ctx.drawImage(toImage, 0, 0);
    return workingCanvas;
}
