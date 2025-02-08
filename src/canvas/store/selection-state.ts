import mitt from 'mitt';
import { ref, reactive } from 'vue';

import { drawWorkingFileToCanvas2d } from '@/lib/canvas';
import { createImageFromCanvas, createEmptyCanvasWith2dContext } from '@/lib/image';

import canvasStore from '@/store/canvas';
import { getStoredImageOrCanvas } from '@/store/image';
import { PerformantStore } from '@/store/performant-store';
import workingFileStore, { getCanvasRenderingContext2DSettings, getLayerGlobalTransform } from '@/store/working-file';

import type { WorkingFileLayerBlendingMode, WorkingFileRasterLayer } from '@/types';

export type SelectionAddShape = 'rectangle' | 'ellipse' | 'freePolygon' | 'tonalArea';
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
    type: 'move' | 'line' | 'bezierCurve';
    x: number;
    y: number;
    editorShapeIntent?: 'rectangle' | 'ellipse' | 'freePolygon';
}

export interface SelectionPathPointMove extends SelectionPathPointBase {
    type: 'move';
}

export interface SelectionPathPointLine extends SelectionPathPointBase {
    type: 'line';
}

export interface SelectionPathPointBezierCurve extends SelectionPathPointBase {
    type: 'bezierCurve';
    shx: number; // Point for bezier curve starting handle, x axis
    shy: number; // Point for bezier curve starting handle, y axis
    ehx: number; // Point for bezier curve ending handle, x axis
    ehy: number; // Point for bezier curve ending handle, y axis
}

export type SelectionPathPoint = SelectionPathPointMove | SelectionPathPointLine | SelectionPathPointBezierCurve;

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
        if (point.type === 'bezierCurve') {
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
    ctx.globalCompositeOperation = 'source-over';
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
        } else if (point.type === 'bezierCurve') {
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
    ctx.globalCompositeOperation = 'source-over';
    return workingCanvas;
}

interface SourceImageCropOptions {
    sx: number;
    sy: number;
    sWidth: number;
    sHeight: number;
}

export async function blitActiveSelectionMask(
    sourceImage: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
    layerTransform: DOMMatrix,
    compositeOperation: CanvasRenderingContext2D['globalCompositeOperation'] = 'source-in',
    sourceCropOptions?: SourceImageCropOptions
): Promise<HTMLCanvasElement> {
    return blitSpecifiedSelectionMask(
        activeSelectionMask.value ?? appliedSelectionMask.value,
        activeSelectionMask.value ? activeSelectionMaskCanvasOffset.value : appliedSelectionMaskCanvasOffset.value,
        sourceImage,
        layerTransform,
        compositeOperation,
        sourceCropOptions
    );
}

/**
 * This modifies the alpha channel of the given sourceImage according to the contents of the selection mask.
 */
export async function blitSpecifiedSelectionMask(
    selectionMask: HTMLImageElement | null,
    selectionMaskCanvasOffset: DOMPoint,
    sourceImage: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
    layerTransform: DOMMatrix,
    compositeOperation: CanvasRenderingContext2D['globalCompositeOperation'] = 'source-in',
    sourceCropOptions?: SourceImageCropOptions
): Promise<HTMLCanvasElement> {
    if (selectionMask == null) throw new Error('Active selection mask does not exist.');
    const workingCanvas = document.createElement('canvas');
    workingCanvas.width = sourceCropOptions?.sWidth ?? sourceImage.width;
    workingCanvas.height = sourceCropOptions?.sHeight ?? sourceImage.height;
    const ctx = workingCanvas.getContext('2d', getCanvasRenderingContext2DSettings());
    if (!ctx) throw new Error('Couldn\'t draw to a new canvas when trying to blit selection mask.');
    const tranformInverse = layerTransform.inverse();
    ctx.save();
    ctx.translate(-(sourceCropOptions?.sx ?? 0), -(sourceCropOptions?.sy ?? 0));
    ctx.transform(tranformInverse.a, tranformInverse.b, tranformInverse.c, tranformInverse.d, tranformInverse.e, tranformInverse.f);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(selectionMask, selectionMaskCanvasOffset.x, selectionMaskCanvasOffset.y);
    ctx.restore();
    ctx.globalCompositeOperation = compositeOperation;
    const isFlipY = sourceImage instanceof ImageBitmap && canvasStore.get('renderer') === 'webgl';
    if (sourceCropOptions) {
        if (isFlipY) {
            ctx.save();
            ctx.scale(1, -1);
            ctx.translate(0, -sourceCropOptions.sHeight);
        }
        ctx.drawImage(
            sourceImage,
            sourceCropOptions.sx,
            isFlipY ? sourceImage.height - sourceCropOptions.sy - sourceCropOptions.sHeight : sourceCropOptions.sy,
            sourceCropOptions.sWidth,
            sourceCropOptions.sHeight,
            0, 0, sourceCropOptions.sWidth, sourceCropOptions.sHeight
        );
        if (isFlipY) {
            ctx.restore();
        }
    } else {
        if (isFlipY) {
            ctx.save();
            ctx.scale(1, -1);
            ctx.translate(0, -sourceImage.height);
        }
        ctx.drawImage(sourceImage, 0, 0);
        if (isFlipY) {
            ctx.restore();
        }
    }
    ctx.globalCompositeOperation = 'source-over';
    return workingCanvas;
}



/**
 * The selection mask image and offset is defined from the point of view of the canvas itself.
 * Layers can be transformed in many ways. This generates a new selection mask image that
 * can be drawn in the context of the layer's transform.
 * 
 * Example:
 * ```
 * resampleSelectionMaskInLayerBounds(
 *     activeSelectionMask.value ?? appliedSelectionMask.value,
 *     activeSelectionMask.value ? activeSelectionMaskCanvasOffset.value : appliedSelectionMaskCanvasOffset.value,
 *     new DOMPoint(layer.width, layer.height),
 *     getLayerGlobalTransform(layer.id)
 * )
 * ```
 */
export async function resampleSelectionMaskInLayerBounds(
    selectionMask: HTMLImageElement,
    selectionMaskCanvasOffset: DOMPoint,
    layerDimensions: DOMPoint,
    layerTransform: DOMMatrix,
): Promise<HTMLCanvasElement> {
    const p0 = selectionMaskCanvasOffset.matrixTransform(layerTransform.inverse());
    const p1 = new DOMPoint(selectionMaskCanvasOffset.x + selectionMask.width, selectionMaskCanvasOffset.y).matrixTransform(layerTransform.inverse());
    const p2 = new DOMPoint(selectionMaskCanvasOffset.x, selectionMaskCanvasOffset.y + selectionMask.height).matrixTransform(layerTransform.inverse());
    const p3 = new DOMPoint(selectionMaskCanvasOffset.x + selectionMask.width, selectionMaskCanvasOffset.y + selectionMask.height).matrixTransform(layerTransform.inverse());
    const topLeft = new DOMPoint(Math.min(p0.x, p1.x, p2.x, p3.x), Math.min(p0.y, p1.y, p2.y, p3.y));
    topLeft.x = Math.max(0, Math.floor(topLeft.x - 1));
    topLeft.y = Math.max(0, Math.floor(topLeft.y - 1));
    const bottomRight = new DOMPoint(Math.max(p0.x, p1.x, p2.x, p3.x), Math.max(p0.y, p1.y, p2.y, p3.y));
    bottomRight.x = Math.min(layerDimensions.x, Math.ceil(bottomRight.x + 1));
    bottomRight.y = Math.min(layerDimensions.y, Math.ceil(bottomRight.y + 1));
    const { canvas: blackCanvas, ctx: blackCtx } = createEmptyCanvasWith2dContext(layerDimensions.x, layerDimensions.y);
    if (blackCtx) {
        blackCtx.fillStyle = '#000000';
        blackCtx.fillRect(0, 0, layerDimensions.x, layerDimensions.y);
    }
    const updateChunkImage = await blitSpecifiedSelectionMask(
        selectionMask,
        selectionMaskCanvasOffset,
        blackCanvas,
        layerTransform,
        'source-in',
        // {
        //     sx: topLeft.x,
        //     sy: topLeft.y,
        //     sWidth: bottomRight.x - topLeft.x,
        //     sHeight: bottomRight.y - topLeft.y,
        // }
    );
    return updateChunkImage;
}
