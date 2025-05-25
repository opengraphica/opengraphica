import { Matrix4 } from 'three/src/math/Matrix4';
import { Texture } from 'three/src/textures/Texture';
import { Vector4 } from 'three/src/math/Vector4';

import { BrushPreview } from './brush-preview';
import { BrushStroke } from './brush-stroke';

import type { WebGLRenderer } from 'three';
import type { RendererBrushStrokeSettings, RendererBrushStrokePreviewsettings } from '@/types';

export class Compositor {
    renderer!: WebGLRenderer;
    originalViewport!: Vector4;

    brushPreview!: BrushPreview;
    brushStrokes = new Map<number, BrushStroke>();
    brushStrokeCounter: number = 0;

    constructor(renderer: WebGLRenderer) {
        this.renderer = renderer;
        this.brushPreview = new BrushPreview(this.renderer);
    }

    setOriginalViewport(originalViewport: Vector4) {
        this.originalViewport = originalViewport;
    }

    startBrushStroke(
        texture: Texture,
        layerTransform: Matrix4,
        settings: RendererBrushStrokeSettings,
    ): number {
        const brushStrokeIndex = this.brushStrokeCounter++;
        this.brushStrokes.set(brushStrokeIndex, new BrushStroke(
            this.renderer,
            this.originalViewport,
            texture,
            layerTransform,
            settings,
        ));
        return brushStrokeIndex;
    }

    moveBrushStroke(
        index: number,
        x: number,
        y: number,
        size: number,
        density: number,
        colorBlendingStrength: number,
        concentration: number,
    ) {
        const brushStroke = this.brushStrokes.get(index);
        if (!brushStroke) return;
        brushStroke.move(x, y, size, density, colorBlendingStrength, concentration);
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

    async createBrushPreview(
        settings: RendererBrushStrokePreviewsettings,
    ): Promise<ImageBitmap> {
        return await this.brushPreview.generate(
            this.originalViewport, settings,
        );
    }

}