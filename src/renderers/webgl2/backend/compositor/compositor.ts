import { Matrix4 } from 'three/src/math/Matrix4';
import { Texture } from 'three/src/textures/Texture';
import { Vector4 } from 'three/src/math/Vector4';

import { BrushStroke } from './brush-stroke';

import type { WebGLRenderer } from 'three';

export class Compositor {
    renderer!: WebGLRenderer;
    originalViewport!: Vector4;

    brushStrokes = new Map<number, BrushStroke>();
    brushStrokeCounter: number = 0;

    constructor(renderer: WebGLRenderer) {
        this.renderer = renderer;
    }

    setOriginalViewport(originalViewport: Vector4) {
        this.originalViewport = originalViewport;
    }

    startBrushStroke(
        texture: Texture,
        layerTransform: Matrix4,
        brushSize: number,
    ): number {
        const brushStrokeIndex = this.brushStrokeCounter++;
        this.brushStrokes.set(brushStrokeIndex, new BrushStroke(
            this.renderer,
            this.originalViewport,
            texture,
            layerTransform,
            brushSize,
        ));
        return brushStrokeIndex;
    }

    moveBrushStroke(
        index: number,
        x: number,
        y: number,
        size: number,
    ) {
        const brushStroke = this.brushStrokes.get(index);
        if (!brushStroke) return;
        brushStroke.move(x, y, size);
    }

    stopBrushStroke(
        index: number,
    ) {
        const brushStroke = this.brushStrokes.get(index);
        if (!brushStroke) return;

        // Do stuff
        brushStroke.dispose();
        this.brushStrokes.delete(index);
    }

}