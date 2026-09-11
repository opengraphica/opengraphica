import { Matrix4 } from 'three/src/math/Matrix4';
import { Texture } from 'three/src/textures/Texture';
import { Vector2 } from 'three/src/math/Vector2';
import { Vector4 } from 'three/src/math/Vector4';

import { BrushPreview } from './brush-preview';
import { BrushStroke } from './brush-stroke';
import { BucketFill } from './bucket-fill';

import type { WebGLRenderer } from 'three';
import type { SelectionMask } from '../selection-mask';
import type { RendererBrushStrokeSettings, RendererBrushStrokePreviewSettings, RendererTextureTile, Webgl2RendererMeshController } from '@/types';

export class Compositor {
    renderer!: WebGLRenderer;
    selectionMask!: SelectionMask;
    originalViewport!: Vector4;

    brushPreview!: BrushPreview;
    brushStrokes = new Map<number, BrushStroke>();
    brushStrokeCounter: number = 0;

    bucketFills: BucketFill[] = [];

    constructor(renderer: WebGLRenderer, selectionMask: SelectionMask) {
        this.renderer = renderer;
        this.selectionMask = selectionMask;
        this.brushPreview = new BrushPreview(this.renderer);
    }

    setOriginalViewport(originalViewport: Vector4) {
        this.originalViewport = originalViewport;
    }

    startBrushStroke(
        texture: Texture<ImageBitmap>,
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
        angle: number,
        density: number,
        colorBlendingStrength: number,
        concentration: number,
    ) {
        const brushStroke = this.brushStrokes.get(index);
        if (!brushStroke) return;
        brushStroke.move(x, y, size, angle, density, colorBlendingStrength, concentration);
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
        settings: RendererBrushStrokePreviewSettings,
    ): Promise<ImageBitmap> {
        return await this.brushPreview.generate(
            this.originalViewport, settings,
        );
    }

    async createBucketFill(
        meshControllers: Webgl2RendererMeshController[],
        textures: Texture<ImageBitmap>[],
        positions: Vector2[],
        color: Vector4,
        feather: number,
        antialias: boolean,
    ) {
        for (const bucketFill of this.bucketFills) {
            bucketFill.dispose();
        }

        for (const [textureIndex, texture] of textures.entries()) {
            this.bucketFills.push(new BucketFill(
                this.renderer,
                this.selectionMask,
                this.originalViewport,
                meshControllers[textureIndex],
                texture,
                positions[textureIndex],
                color,
                feather,
                antialias,
            ));
        }
    }

    async previewBucketFill(strength: number) {
        for (const bucketFill of this.bucketFills) {
            bucketFill.preview(strength);
        }
    }

    async applyBucketFill(strength: number): Promise<RendererTextureTile[]> {
        const tiles: RendererTextureTile[] = [];

        for (const bucketFill of this.bucketFills) {
            tiles.push(await bucketFill.apply(strength));
        }

        for (const bucketFill of this.bucketFills) {
            bucketFill.dispose();
        }
        this.bucketFills = [];

        return tiles;
    }

}