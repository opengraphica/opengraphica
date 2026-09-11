import { ClampToEdgeWrapping, RGBAFormat, LinearSRGBColorSpace, SRGBColorSpace, HalfFloatType, FloatType, UnsignedByteType, NearestFilter } from 'three/src/constants';
import { Box2 } from 'three/src/math/Box2';
import { DataTexture } from 'three/src/textures/DataTexture';
import { Matrix4 } from 'three/src/math/Matrix4';
import { Mesh } from 'three/src/objects/Mesh';
import { OrthographicCamera } from 'three/src/cameras/OrthographicCamera';
import { PlaneGeometry } from 'three/src/geometries/PlaneGeometry';
import { Scene } from 'three/src/scenes/Scene';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import { Texture } from 'three/src/textures/Texture';
import { Vector2 } from 'three/src/math/Vector2';
import { Vector4 } from 'three/src/math/Vector4';
import { WebGLRenderTarget } from 'three/src/renderers/WebGLRenderTarget';

import { LayerBlendingMode } from '@/renderers/webgl2/layers/base/blending-mode';

import blendingModesSetupFragmentShader from '@/renderers/webgl2/layers/base/shader/blending-modes.setup.frag';
import bucketFillCompositorVertexShader from './shader/bucket-fill-compositor.vert';
import bucketFillCompositorFragmentShader from './shader/bucket-fill-compositor.frag';
import bucketFillInitVertexShader from './shader/bucket-fill-init.vert';
import bucketFillInitFragmentShader from './shader/bucket-fill-init.frag';
import bucketFillExpansionVertexShader from './shader/bucket-fill-expansion.vert';
import bucketFillExpansionFragmentShader from './shader/bucket-fill-expansion.frag';
import copyTileVertexShader from './shader/copy-tile.vert';
import copyTileFragmentShader from './shader/copy-tile.frag';

import { markRenderDirty } from '..';

import { limitMaxDimension } from '@/lib/math';

import type { Camera, WebGLRenderer } from 'three';
import type { SelectionMask } from '../selection-mask';
import type { RendererTextureTile, Webgl2RendererMeshController, WorkingFileLayerBlendingMode } from '@/types';

export class BucketFill {
    renderer!: WebGLRenderer;
    selectionMask: SelectionMask | undefined;
    originalViewport!: Vector4;
    meshController!: Webgl2RendererMeshController;
    texture!: Texture<ImageBitmap>;
    heightmapWidth: number;
    heightmapHeight: number;

    position!: Vector2;
    color!: Vector4;
    feather!: number;
    antialias!: boolean;
    blendingMode: WorkingFileLayerBlendingMode = 'normal';

    isHalfFloat!: boolean;

    camera!: Camera;
    mesh!: Mesh;
    geometry!: PlaneGeometry;
    scene!: Scene;
    previewTextureRenderTarget!: WebGLRenderTarget;
    renderTarget1!: WebGLRenderTarget;
    renderTarget2!: WebGLRenderTarget;

    copyTileMaterial!: ShaderMaterial;
    compositorMaterial!: ShaderMaterial;

    _m0 = new Matrix4();
    _m1 = new Matrix4();
    _m2 = new Matrix4();

    constructor(
        renderer: WebGLRenderer,
        selectionMask: SelectionMask | undefined,
        originalViewport: Vector4,
        meshController: Webgl2RendererMeshController,
        texture: Texture<ImageBitmap>,
        position: Vector2,
        color: Vector4,
        feather: number,
        antialias: boolean,
        blendingMode: WorkingFileLayerBlendingMode,
    ) {
        this.renderer = renderer;
        this.selectionMask = selectionMask;
        this.originalViewport = originalViewport;
        this.meshController = meshController;
        this.texture = texture;
        this.position = position;
        this.color = color;
        this.feather = feather;
        this.antialias = antialias;
        this.blendingMode = blendingMode;

        const { width: heightmapWidth, height: heightmapHeight } = limitMaxDimension(texture.width, texture.height, 2048);
        this.heightmapWidth = heightmapWidth;
        this.heightmapHeight = heightmapHeight;

        this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.scene = new Scene();
        this.geometry = new PlaneGeometry(2, 2);

        this.copyTileMaterial = new ShaderMaterial({
            uniforms: {
                map: { value: texture },
                tileOffsetAndSize: { value: new Vector4(0, 0, 1, 1) },
            },
            vertexShader: copyTileVertexShader,
            fragmentShader: copyTileFragmentShader,
            depthTest: false,
            depthWrite: false,
            transparent: true,
            premultipliedAlpha: true,
        });

        const selectionMaskTexture = this.selectionMask?.getTexture();
        this.compositorMaterial = new ShaderMaterial({
            defines: {
                cLayerBlendingMode: LayerBlendingMode[this.blendingMode],
                cSelectionMaskEnabled: selectionMaskTexture ? 1 : 0,
            },
            uniforms: {
                dstMap: { value: texture },
                fillMap: { value: undefined },
                selectionMaskMap: { value: selectionMaskTexture },
                fillColor: { value: color },
                strengthFeatherAntialias: { value: new Vector4(0.5, feather, antialias ? 1 : 0, 0) },
                selectionMaskTransform: { value: new Matrix4() },
            },
            vertexShader: bucketFillCompositorVertexShader,
            fragmentShader: blendingModesSetupFragmentShader + '\n' + bucketFillCompositorFragmentShader,
            depthTest: false,
            depthWrite: false,
            transparent: true,
            premultipliedAlpha: true,
        })

        this.previewTextureRenderTarget = new WebGLRenderTarget(texture.width, texture.height, {
            type: UnsignedByteType,
            minFilter: NearestFilter,
            magFilter: NearestFilter,
            wrapS: ClampToEdgeWrapping,
            wrapT: ClampToEdgeWrapping,
            format: RGBAFormat,
            internalFormat: this.texture.internalFormat,
            depthBuffer: false,
            colorSpace: SRGBColorSpace,
            stencilBuffer: false,
            generateMipmaps: false,
        });

        this.renderTarget1 = new WebGLRenderTarget(heightmapWidth, heightmapHeight, {
            type: UnsignedByteType,
            minFilter: NearestFilter,
            magFilter: NearestFilter,
            wrapS: ClampToEdgeWrapping,
            wrapT: ClampToEdgeWrapping,
            format: RGBAFormat,
            internalFormat: this.texture.internalFormat,
            depthBuffer: false,
            colorSpace: SRGBColorSpace,
            stencilBuffer: false,
            generateMipmaps: false,
        });

        this.renderTarget2 = new WebGLRenderTarget(heightmapWidth, heightmapHeight, {
            type: UnsignedByteType,
            minFilter: NearestFilter,
            magFilter: NearestFilter,
            wrapS: ClampToEdgeWrapping,
            wrapT: ClampToEdgeWrapping,
            format: RGBAFormat,
            internalFormat: this.texture.internalFormat,
            depthBuffer: false,
            colorSpace: SRGBColorSpace,
            stencilBuffer: false,
            generateMipmaps: false,
        });

        this.mesh = new Mesh(this.geometry, this.compositorMaterial);
        this.scene.add(this.mesh);

        this.mesh.material = this.copyTileMaterial;
        this.renderer.setRenderTarget(this.previewTextureRenderTarget);
        this.renderer.clearColor();
        this.renderer.render(this.scene, this.camera);

        this.generateHeightmapOnCpu();

        this.compositorMaterial.uniforms.fillMap.value = this.renderTarget1.texture;
        this.createSelectionMaskTransform(0, 0, texture.width, texture.height);

        this.meshController.setDraftTexture(this.previewTextureRenderTarget.texture);

        // Reset
        this.renderer.setRenderTarget(null);
        this.renderer.setViewport(this.originalViewport);
    }

    createSelectionMaskTransform(tileX: number, tileY: number, tileWidth: number, tileHeight: number) {
        if (!this.selectionMask) return;

        const selectionMaskTexture = this.selectionMask.getTexture();
        if (!selectionMaskTexture) return;

        const selectionMaskWidth = selectionMaskTexture.image.width;
        const selectionMaskHeight = selectionMaskTexture.image.height;
        const selectionMaskOffset = this.selectionMask.getOffset();

        const selectionMaskTileOffsetX = (tileX - selectionMaskOffset[0]) / selectionMaskWidth;
        const selectionMaskTileOffsetY = (tileY - selectionMaskOffset[1]) / selectionMaskHeight;
        const selectionMaskTileScaleX = (tileWidth / selectionMaskWidth);
        const selectionMaskTileScaleY = (tileHeight / selectionMaskHeight);

        const tileTransformReset = this._m0.identity()
            .multiply(
                this._m1.makeTranslation(
                    -selectionMaskOffset[0] / selectionMaskWidth,
                    1.0 + (selectionMaskOffset[1] / selectionMaskHeight),
                    0.0
                )
            )
            .multiply(
                this._m1.makeScale(
                    1.0 / selectionMaskWidth,
                    -1.0 / selectionMaskHeight,
                    1.0,
                )
            );
        const tileTransformResetInverse = this._m1.copy(tileTransformReset).invert();

        (this.compositorMaterial.uniforms.selectionMaskTransform.value as Matrix4)
            .identity()
            .multiply(tileTransformReset)
            .multiply(
                this.meshController.getTransform()
            )
            .multiply(tileTransformResetInverse)
            .multiply(
                this._m2.makeTranslation(
                    selectionMaskTileOffsetX,
                    1.0 - selectionMaskTileOffsetY - selectionMaskTileScaleY,
                    1.0,
                )
            )
            .multiply(
                this._m2.makeScale(
                    selectionMaskTileScaleX,
                    selectionMaskTileScaleY,
                    1.0,
                )
            );
    }

    generateHeightmapOnCpu() {
        // This code is expanded out for maximum performance.
        // You will see many repeated statements. Converting them to functions
        // significantly increases the amount of time it takes to generate
        // this heightmap image.

        const width = this.heightmapWidth;
        const height = this.heightmapHeight;
        const pixelCount = width * height;

        const fullWidth = this.previewTextureRenderTarget.width;
        const fullHeight = this.previewTextureRenderTarget.height;

        const buffer = new Uint8Array(width * height * 4);

        if (width != fullWidth) {
            const sourceBuffer = new Uint8Array(fullWidth * fullHeight * 4);
            this.renderer.readRenderTargetPixels(
                this.previewTextureRenderTarget, 0, 0,
                fullWidth, fullHeight,
                sourceBuffer,
            );
            for (let y = 0; y < height; y++) {
                const sourceY = Math.min(fullHeight - 1, Math.floor((y / height) * fullHeight));

                for (let x = 0; x < width; x++) {
                    const sourceX = Math.min(fullWidth - 1, Math.floor((x / width) * fullWidth));

                    const sourceIndex = (sourceY * fullWidth + sourceX) * 4;
                    const targetIndex = (y * width + x) * 4;

                    buffer[targetIndex] = sourceBuffer[sourceIndex];
                    buffer[targetIndex + 1] = sourceBuffer[sourceIndex + 1];
                    buffer[targetIndex + 2] = sourceBuffer[sourceIndex + 2];
                    buffer[targetIndex + 3] = sourceBuffer[sourceIndex + 3];
                }
            }
        } else {
            this.renderer.readRenderTargetPixels(
                this.previewTextureRenderTarget, 0, 0,
                width, height,
                buffer,
            );
        }

        const seedX = Math.round(this.position.x * (width - 1));
        const seedY = Math.round((1.0 - this.position.y) * (height - 1));
        const seedIndex = seedY * width + seedX;

        const tolerance = 10.0;

        const BUCKET_COUNT = 4096;
        const EMPTY = -1;

        const bucketHeads = new Int32Array(BUCKET_COUNT);
        bucketHeads.fill(EMPTY);

        const nextInBucket = new Int32Array(pixelCount);
        nextInBucket.fill(EMPTY);

        let highestBucket = 0;

        const heights = new Float32Array(pixelCount);
        heights.fill(-1);
        heights[seedIndex] = 1;

        {
            const bucket = BUCKET_COUNT - 1;
            nextInBucket[seedIndex] = bucketHeads[bucket];
            bucketHeads[bucket] = seedIndex;
            if (bucket > highestBucket) {
                highestBucket = bucket;
            }
        }

        const inv255 = 1 / 255;
        const a = seedIndex * 4;
        const aAlpha = buffer[a + 3] * inv255;
        const ar = (buffer[a] * inv255) * aAlpha;
        const ag = (buffer[a + 1] * inv255) * aAlpha;
        const ab = (buffer[a + 2] * inv255) * aAlpha;

        const SIMILARITY_EXPONENTIAL_STRENGTH = 6.0;

        while (highestBucket >= 0) {
             while (
                highestBucket >= 0 &&
                bucketHeads[highestBucket] === EMPTY
            ) {
                highestBucket--;
            }

            if (highestBucket < 0) {
                break;
            }

            const pixelIndex = bucketHeads[highestBucket];
            bucketHeads[highestBucket] = nextInBucket[pixelIndex];

            const x = pixelIndex % width;
            const y = (pixelIndex / width) | 0;
            const currentHeight = heights[pixelIndex];

            xgt0Check:
            if (x > 0) {
                const neighborIndex = pixelIndex - 1;
                if (heights[neighborIndex] !== -1) {
                    break xgt0Check;
                }
                
                const b = neighborIndex * 4;
                const bAlpha = buffer[b + 3] * inv255;
                const br = (buffer[b] * inv255) * bAlpha;
                const bg = (buffer[b + 1] * inv255) * bAlpha;
                const bb = (buffer[b + 2] * inv255) * bAlpha;

                const dr = ar - br;
                const dg = ag - bg;
                const db = ab - bb;
                const da = aAlpha - bAlpha;

                const rgbDistance = Math.sqrt(
                    dr * dr +
                    dg * dg +
                    db * db +
                    da * da
                );

                const t = Math.max(0, Math.min(1, (rgbDistance - 0.0) / (tolerance - 0.0)));
                // const smoothStepResult = t * t * (3 - 2 * t);

                // const similarity = Math.max(
                //     0.0001,
                //     1.0 - smoothStepResult,
                // );
                const SIMILARITY_EXPONENTIAL_STRENGTH = 6.0;
                const similarity = Math.max(
                    0.0001,
                    Math.exp(-SIMILARITY_EXPONENTIAL_STRENGTH * t),
                );

                const newHeight = currentHeight * similarity;
                heights[neighborIndex] = newHeight;
                {
                    let bucket;
                    if (newHeight >= 1) {
                        bucket = BUCKET_COUNT - 1;
                    } else if (newHeight <= 0) {
                        bucket = 0;
                    } else {
                        bucket = Math.floor(newHeight * (BUCKET_COUNT - 1));
                    }
                    nextInBucket[neighborIndex] = bucketHeads[bucket];
                    bucketHeads[bucket] = neighborIndex;
                    if (bucket > highestBucket) {
                        highestBucket = bucket;
                    }
                }
            }
            ltwCheck:
            if (x + 1 < width) {
                const neighborIndex = pixelIndex + 1;
                if (heights[neighborIndex] !== -1) {
                    break ltwCheck;
                }
                const b = neighborIndex * 4;
                const bAlpha = buffer[b + 3] * inv255;
                const br = (buffer[b] * inv255) * bAlpha;
                const bg = (buffer[b + 1] * inv255) * bAlpha;
                const bb = (buffer[b + 2] * inv255) * bAlpha;

                const dr = ar - br;
                const dg = ag - bg;
                const db = ab - bb;
                const da = aAlpha - bAlpha;

                const rgbDistance = Math.sqrt(
                    dr * dr +
                    dg * dg +
                    db * db +
                    da * da
                );

                const t = Math.max(0, Math.min(1, (rgbDistance - 0.0) / (tolerance - 0.0)));
                // const smoothStepResult = t * t * (3 - 2 * t);

                // const similarity = Math.max(
                //     0.0001,
                //     1.0 - smoothStepResult,
                // );
                const SIMILARITY_EXPONENTIAL_STRENGTH = 6.0;
                const similarity = Math.max(
                    0.0001,
                    Math.exp(-SIMILARITY_EXPONENTIAL_STRENGTH * t),
                );

                const newHeight = currentHeight * similarity;
                heights[neighborIndex] = newHeight;
                {
                    let bucket;
                    if (newHeight >= 1) {
                        bucket = BUCKET_COUNT - 1;
                    } else if (newHeight <= 0) {
                        bucket = 0;
                    } else {
                        bucket = Math.floor(newHeight * (BUCKET_COUNT - 1));
                    }
                    nextInBucket[neighborIndex] = bucketHeads[bucket];
                    bucketHeads[bucket] = neighborIndex;
                    if (bucket > highestBucket) {
                        highestBucket = bucket;
                    }
                }
            }
            ygt0check:
            if (y > 0) {
                const neighborIndex = pixelIndex - width;
                if (heights[neighborIndex] !== -1) {
                    break ygt0check;
                }
                const b = neighborIndex * 4;
                const bAlpha = buffer[b + 3] * inv255;
                const br = (buffer[b] * inv255) * bAlpha;
                const bg = (buffer[b + 1] * inv255) * bAlpha;
                const bb = (buffer[b + 2] * inv255) * bAlpha;

                const dr = ar - br;
                const dg = ag - bg;
                const db = ab - bb;
                const da = aAlpha - bAlpha;

                const rgbDistance = Math.sqrt(
                    dr * dr +
                    dg * dg +
                    db * db +
                    da * da
                );

                const t = Math.max(0, Math.min(1, (rgbDistance - 0.0) / (tolerance - 0.0)));
                // const smoothStepResult = t * t * (3 - 2 * t);

                // const similarity = Math.max(
                //     0.0001,
                //     1.0 - smoothStepResult,
                // );

                const SIMILARITY_EXPONENTIAL_STRENGTH = 6.0;
                const similarity = Math.max(
                    0.0001,
                    Math.exp(-SIMILARITY_EXPONENTIAL_STRENGTH * t),
                );

                const newHeight = currentHeight * similarity;
                heights[neighborIndex] = newHeight;
                {
                    let bucket;
                    if (newHeight >= 1) {
                        bucket = BUCKET_COUNT - 1;
                    } else if (newHeight <= 0) {
                        bucket = 0;
                    } else {
                        bucket = Math.floor(newHeight * (BUCKET_COUNT - 1));
                    }
                    nextInBucket[neighborIndex] = bucketHeads[bucket];
                    bucketHeads[bucket] = neighborIndex;
                    if (bucket > highestBucket) {
                        highestBucket = bucket;
                    }
                }
            }
            lthCheck:
            if (y + 1 < height) {
                const neighborIndex = pixelIndex + width;
                if (heights[neighborIndex] !== -1) {
                    break lthCheck;
                }
                const b = neighborIndex * 4;
                const bAlpha = buffer[b + 3] * inv255;
                const br = (buffer[b] * inv255) * bAlpha;
                const bg = (buffer[b + 1] * inv255) * bAlpha;
                const bb = (buffer[b + 2] * inv255) * bAlpha;

                const dr = ar - br;
                const dg = ag - bg;
                const db = ab - bb;
                const da = aAlpha - bAlpha;

                const rgbDistance = Math.sqrt(
                    dr * dr +
                    dg * dg +
                    db * db +
                    da * da
                );

                const t = Math.max(0, Math.min(1, (rgbDistance - 0.0) / (tolerance - 0.0)));
                // const smoothStepResult = t * t * (3 - 2 * t);

                // const similarity = Math.max(
                //     0.0001,
                //     1.0 - smoothStepResult,
                // );

                const SIMILARITY_EXPONENTIAL_STRENGTH = 6.0;
                const similarity = Math.max(
                    0.0001,
                    Math.exp(-SIMILARITY_EXPONENTIAL_STRENGTH * t),
                );

                const newHeight = currentHeight * similarity;
                heights[neighborIndex] = newHeight;
                {
                    let bucket;
                    if (newHeight >= 1) {
                        bucket = BUCKET_COUNT - 1;
                    } else if (newHeight <= 0) {
                        bucket = 0;
                    } else {
                        bucket = Math.floor(newHeight * (BUCKET_COUNT - 1));
                    }
                    nextInBucket[neighborIndex] = bucketHeads[bucket];
                    bucketHeads[bucket] = neighborIndex;
                    if (bucket > highestBucket) {
                        highestBucket = bucket;
                    }
                }
            }
        }

        const output = new Uint8Array(pixelCount * 4);

        for (let y = 0; y < height; y++) {
            const flippedY = height - 1 - y;
            const rowStart = y * width;
            const outputRowStart = flippedY * width * 4;

            for (let x = 0; x < width; x++) {
                const value = heights[rowStart + x] > 0
                    ? heights[rowStart + x] * 255
                    : 0;
                const outputIndex = outputRowStart + x * 4;

                output[outputIndex] = value;
                output[outputIndex + 1] = value;
                output[outputIndex + 2] = value;
                output[outputIndex + 3] = 255;
            }
        }

        const texture = new DataTexture(
            output,
            width,
            height,
            RGBAFormat,
            UnsignedByteType
        );
        texture.minFilter = NearestFilter;
        texture.magFilter = NearestFilter;
        texture.wrapS = ClampToEdgeWrapping;
        texture.wrapT = ClampToEdgeWrapping;
        texture.generateMipmaps = false;
        texture.flipY = false;
        texture.unpackAlignment = 1;
        texture.needsUpdate = true;

        this.mesh.material = this.copyTileMaterial;
        this.copyTileMaterial.uniforms.map.value = texture;
        this.renderer.setRenderTarget(this.renderTarget1);
        this.renderer.clearColor();
        this.renderer.render(this.scene, this.camera);
    }

    generateHeightmapOnGpu() {
        const initMaterial = new ShaderMaterial({
            uniforms: {
                seed: { value: this.position },
                resolution: { value: new Vector2(this.texture.width, this.texture.height) },
            },
            vertexShader: bucketFillInitVertexShader,
            fragmentShader: bucketFillInitFragmentShader,
            depthTest: false,
            depthWrite: false,
            transparent: true,
            premultipliedAlpha: false,
        });

        const expansionMaterial = new ShaderMaterial({
            uniforms: {
                reference: { value: this.texture },
                previousHeight: { value: undefined },
                seed: { value: this.position },
                resolution: { value: new Vector2(this.texture.width, this.texture.height) },
                tolerance: { value: 0.5 },
            },
            vertexShader: bucketFillExpansionVertexShader,
            fragmentShader: bucketFillExpansionFragmentShader,
            depthTest: false,
            depthWrite: false,
            transparent: false,
            premultipliedAlpha: false,
        });

        // Initial render
        this.mesh.material = initMaterial;
        this.renderer.setViewport(0, 0, this.texture.width, this.texture.height);
        this.renderer.setRenderTarget(this.renderTarget1);
        this.renderer.clearColor();
        this.renderer.render(this.scene, this.camera);

        this.mesh.material = expansionMaterial;
        expansionMaterial.uniforms.previousHeight.value = this.renderTarget1.texture;
        expansionMaterial.uniformsNeedUpdate = true;
        this.renderer.setRenderTarget(this.renderTarget2);
        this.renderer.clearColor();
        this.renderer.render(this.scene, this.camera);

        const iterations = this.texture.width + this.texture.height;
        let activeRenderTarget = this.renderTarget1;
        let inactiveRenderTarget = this.renderTarget2;
        for (let i = 0; i < iterations; i++) {
            this.renderer.setRenderTarget(activeRenderTarget);
            expansionMaterial.uniforms.previousHeight.value = inactiveRenderTarget.texture;
            expansionMaterial.uniformsNeedUpdate = true;
            this.renderer.clearColor();
            this.renderer.render(this.scene, this.camera);
            if (activeRenderTarget === this.renderTarget1) {
                activeRenderTarget = this.renderTarget2;
                inactiveRenderTarget = this.renderTarget1;
            } else {
                activeRenderTarget = this.renderTarget1;
                inactiveRenderTarget = this.renderTarget2;
            }
        }
        this.renderTarget2?.dispose();

        initMaterial.dispose();
        expansionMaterial.dispose();
    }

    preview(strength: number) {
        this.mesh.material = this.compositorMaterial;
        this.compositorMaterial.uniforms.strengthFeatherAntialias.value.x = strength;
        this.compositorMaterial.uniformsNeedUpdate = true;
        this.renderer.setViewport(0, 0, this.texture.width, this.texture.height);
        this.renderer.setRenderTarget(this.previewTextureRenderTarget);
        this.renderer.clearColor();
        this.renderer.render(this.scene, this.camera);
        this.renderer.setRenderTarget(null);
        this.renderer.setViewport(this.originalViewport);
        markRenderDirty();
    }

    async apply(strength: number): Promise<RendererTextureTile> {
        this.preview(strength);

        const copyTextureRegion = new Box2(new Vector2(0, 0), new Vector2(this.texture.width, this.texture.height));
        const copyTextureDestination = new Vector2();
        this.renderer.copyTextureToTexture(
            this.previewTextureRenderTarget.texture,
            this.texture,
            copyTextureRegion,
            copyTextureDestination,
        );
        this.meshController.setDraftTexture();

        const renderWidth = this.previewTextureRenderTarget.texture.width;
        const renderHeight = this.previewTextureRenderTarget.texture.height;

        const buffer = await this.renderer.readRenderTargetPixelsAsync(
            this.previewTextureRenderTarget, 0, 0,
            renderWidth, renderHeight,
            new Uint8Array(renderWidth * renderHeight * 4),
        );

        return {
            x: 0,
            y: 0,
            width: renderWidth,
            height: renderHeight,
            oldImage: undefined,
            image: await createImageBitmap(
                new ImageData(new Uint8ClampedArray(buffer), renderWidth, renderHeight),
                { imageOrientation: 'flipY' },
            )
        };
    }

    dispose() {
        this.meshController.setDraftTexture();
        this.previewTextureRenderTarget.dispose();
        this.renderTarget1.dispose();
        this.renderTarget2.dispose();
        this.geometry.dispose();
    }

}