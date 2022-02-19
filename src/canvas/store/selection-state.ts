import mitt from 'mitt';
import { ref, reactive } from 'vue';

export const selectionAddShape = ref<'rectangle' | 'ellipse' | 'free' | 'tonalArea'>('rectangle');
export const selectionCombineMode = ref<'add' | 'subtract' | 'intersect' | 'replace'>('add');
export const isDrawingSelection = ref<boolean>(false);
export const appliedSelectionMask = ref<InstanceType<typeof Image> | null>(null);
export const appliedSelectionMaskCanvasOffset = ref<DOMPoint>(new DOMPoint());
export const activeSelectionMask = ref<InstanceType<typeof Image> | null>(null);

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
