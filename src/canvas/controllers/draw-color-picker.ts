import { nextTick } from 'vue';
import BaseCanvasMovementController from './base-movement';

import { drawWorkingFileToCanvas2d } from '@/lib/canvas';
import { generateColorStyle } from '@/lib/color';
import { DecomposedMatrix } from '@/lib/dom-matrix';

import canvasStore from '@/store/canvas';
import { getCanvasRenderingContext2DSettings } from '@/store/working-file';
import workingFileStore from '@/store/working-file';
import { drawColorPickerEmitter, pickedColor } from '@/canvas/store/draw-color-picker-state';

import type { DrawWorkingFileOptions, RGBAColor } from '@/types';

const devicePixelRatio = window.devicePixelRatio || 1;

export default class CanvasDrawBrushController extends BaseCanvasMovementController {

    private isPickingColor = false;

    onEnter(): void {
        super.onEnter();
    }

    onLeave(): void {
        super.onLeave();
    }

    onPointerDown(e: PointerEvent) {
        super.onPointerDown(e);
        if (e.isPrimary && ['mouse', 'pen'].includes(e.pointerType) && e.button === 0) {
            this.colorPickStart();
        }
    }

    onMultiTouchDown() {
        super.onMultiTouchDown();
        if (this.touches.length === 1) {
            this.colorPickStart();
        }
    }

    async onPointerUp(e: PointerEvent): Promise<void> {
        super.onPointerUp(e);
        if (e.isPrimary) {
            this.colorPickEnd();    
        }
    }

    private colorPickStart() {
        this.isPickingColor = true;
    }

    private colorPickEnd() {
        if (!this.isPickingColor) return;

        let { viewTransformPoint } = this.getTransformedCursorInfo();
        this.pickColor(viewTransformPoint);
    }

    private getTransformedCursorInfo(): { viewTransformPoint: DOMPoint, viewDecomposedTransform: DecomposedMatrix } {
        const devicePixelRatio = window.devicePixelRatio || 1;
        const viewTransform = canvasStore.get('transform');
        const viewDecomposedTransform = canvasStore.get('decomposedTransform');
        const viewTransformPoint = new DOMPoint(this.lastCursorX * devicePixelRatio, this.lastCursorY * devicePixelRatio)
            .matrixTransform(viewTransform.inverse());
        
        return {
            viewTransformPoint,
            viewDecomposedTransform
        };
    }

    private pickColor(viewTransformPoint: DOMPoint): number | null {
        const workingCanvas = document.createElement('canvas');
        workingCanvas.width = 1;
        workingCanvas.height = 1;
        const ctx = workingCanvas.getContext('2d', getCanvasRenderingContext2DSettings());
        if (!ctx) return null;
        const initialTransform = new DOMMatrix().translateSelf(-viewTransformPoint.x, -viewTransformPoint.y);
        const selectionTest: DrawWorkingFileOptions['selectionTest'] = {
            point: new DOMPoint(),
            resultId: undefined,
            resultPixelTest: undefined
        };
        drawWorkingFileToCanvas2d(workingCanvas, ctx, { initialTransform, selectionTest });
        if (selectionTest.resultPixelTest) {
            const color: RGBAColor = {
                is: 'color',
                r: selectionTest.resultPixelTest[0] / 255,
                g: selectionTest.resultPixelTest[1] / 255,
                b: selectionTest.resultPixelTest[2] / 255,
                alpha: 1,
                style: ''
            };
            color.style = generateColorStyle(color, 'rgba', workingFileStore.state.colorSpace);
            pickedColor.value = color;
            nextTick(() => {
                drawColorPickerEmitter.emit('colorPicked');
            });
        }
        return selectionTest.resultId != null ? selectionTest.resultId : null;
    }

    protected handleCursorIcon() {
        canvasStore.set('cursor', 'eyedropper');
        return 'eyedropper';
    }
}
