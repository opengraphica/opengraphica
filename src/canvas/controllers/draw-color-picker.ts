import { nextTick } from 'vue';
import BaseCanvasMovementController from './base-movement';

import { drawWorkingFileToCanvas2d } from '@/lib/canvas';
import { generateColorStyle } from '@/lib/color';
import { DecomposedMatrix } from '@/lib/dom-matrix';

import canvasStore from '@/store/canvas';
import { getCanvasRenderingContext2DSettings } from '@/store/working-file';
import workingFileStore from '@/store/working-file';
import { drawColorPickerEmitter, pickedColor } from '@/canvas/store/draw-color-picker-state';

import { useRenderer } from '@/renderers';

import type { DrawWorkingFileOptions, RGBAColor, RendererFrontend } from '@/types';

const devicePixelRatio = window.devicePixelRatio || 1;

export default class CanvasDrawBrushController extends BaseCanvasMovementController {

    private isPickingColor = false;

    private renderer: RendererFrontend | undefined;

    onEnter(): void {
        super.onEnter();

        useRenderer().then((renderer) => {
            this.renderer = renderer;
        });
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

    private pickColor(viewTransformPoint: DOMPoint) {
        if (!this.renderer) return null;

        this.renderer.pickColor(-viewTransformPoint.x, -viewTransformPoint.y).then((color) => {
            pickedColor.value = color;
            nextTick(() => {
                drawColorPickerEmitter.emit('colorPicked');
            });
        });
    }

    protected handleCursorIcon() {
        canvasStore.set('cursor', 'eyedropper');
        return 'eyedropper';
    }
}
