import { Matrix4 } from 'three/src/math/Matrix4';
import { Texture } from 'three/src/textures/Texture';
import { Vector4 } from 'three/src/math/Vector4';

import { BrushPreview } from './brush-preview';
import { BrushStroke } from './brush-stroke';

import type { WebGLRenderer } from 'three';
import type { SelectionMask } from '../selection-mask';
import type { RendererBrushStrokeSettings, RendererBrushStrokePreviewsettings, RendererTextureTile } from '@/types';

export class Compositor {
    renderer!: WebGLRenderer;
    selectionMask!: SelectionMask;
    originalViewport!: Vector4;

    brushPreview!: BrushPreview;
    brushStrokes = new Map<number, BrushStroke>();
    brushStrokeCounter: number = 0;

    constructor(renderer: WebGLRenderer, selectionMask: SelectionMask) {
        this.renderer = renderer;
        this.selectionMask = selectionMask;
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
            this.selectionMask,
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

    async stopBrushStroke(
        index: number,
    ): Promise<RendererTextureTile[]> {
        const brushStroke = this.brushStrokes.get(index);
        if (!brushStroke) return[];

        const tiles = brushStroke.collectTiles();
        brushStroke.dispose();
        this.brushStrokes.delete(index);

        return tiles;
    }

    async createBrushPreview(
        settings: RendererBrushStrokePreviewsettings,
    ): Promise<ImageBitmap> {
        return await this.brushPreview.generate(
            this.originalViewport, settings,
        );
    }

}