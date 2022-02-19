import mitt from 'mitt';
import { ref, reactive } from 'vue';
import workingFileStore from '@/store/working-file';

export const selectionAddShape = ref<'rectangle' | 'ellipse' | 'free' | 'tonalArea'>('rectangle');
export const selectionCombineMode = ref<'add' | 'subtract' | 'intersect' | 'replace'>('add');
export const isDrawingSelection = ref<boolean>(false);
export const appliedSelectionMask = ref<InstanceType<typeof Image> | null>(null);
export const appliedSelectionMaskCanvasOffset = ref<DOMPoint>(new DOMPoint());
export const activeSelectionMask = ref<InstanceType<typeof Image> | null>(null);
export const activeSelectionMaskCanvasOffset = ref<DOMPoint>(new DOMPoint());
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

export const workingSelectionPath = ref<Array<SelectionPathPoint>>([]);

export const selectionEmitter = mitt();

export interface SelectionBounds { left: number; right: number; top: number; bottom: number; };

export function getActiveSelectionBounds(): SelectionBounds {
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (const point of workingSelectionPath.value) {
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

export async function applyActiveSelection() {
    let drawMargin: number = selectionMaskDrawMargin.value;
    const activeSelectionBounds = getActiveSelectionBounds();
    let newAppliedSelectionMask = null;
    if (workingSelectionPath.value.length > 0) {
        newAppliedSelectionMask = await createActiveSelectionMask(activeSelectionBounds);
    }
    if (appliedSelectionMask.value) {
        URL.revokeObjectURL(appliedSelectionMask.value.src);
    }
    if (newAppliedSelectionMask) {
        appliedSelectionMask.value = newAppliedSelectionMask;
        appliedSelectionMaskCanvasOffset.value.x = activeSelectionBounds.left - drawMargin;
        appliedSelectionMaskCanvasOffset.value.y = activeSelectionBounds.top - drawMargin;
    }
    workingSelectionPath.value = [];
}

export async function previewActiveSelectionMask() {
    let drawMargin: number = selectionMaskDrawMargin.value;
    const activeSelectionBounds = getActiveSelectionBounds();
    const newActiveSelectionMask = await createActiveSelectionMask(activeSelectionBounds);
    if (activeSelectionMask.value) {
        URL.revokeObjectURL(activeSelectionMask.value.src);
    }
    activeSelectionMask.value = newActiveSelectionMask;
    activeSelectionMaskCanvasOffset.value.x = activeSelectionBounds.left - drawMargin;
    activeSelectionMaskCanvasOffset.value.y = activeSelectionBounds.top - drawMargin;
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

export async function createActiveSelectionMask(activeSelectionBounds: SelectionBounds) {
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
    let workingCanvas = document.createElement('canvas');
    workingCanvas.width = (activeSelectionBounds.right - activeSelectionBounds.left) + (drawMargin * 2);
    workingCanvas.height = (activeSelectionBounds.bottom - activeSelectionBounds.top) + (drawMargin * 2);
    let ctx = workingCanvas.getContext('2d');
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
    for (const point of workingSelectionPath.value) {
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
    const newSelectionMask = await new Promise<InstanceType<typeof Image>>((resolve, reject) => {
        try {
            workingCanvas.toBlob((blob) => {
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

    (workingCanvas as any) = null;
    ctx = null;
    return newSelectionMask;
}
