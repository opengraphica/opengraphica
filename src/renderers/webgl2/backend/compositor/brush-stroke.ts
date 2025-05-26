import { LinearFilter, ClampToEdgeWrapping, RGBAFormat, LinearSRGBColorSpace, SRGBColorSpace, HalfFloatType, FloatType, UnsignedByteType, NearestFilter } from 'three/src/constants';
import { Box2 } from 'three/src/math/Box2';
import { Matrix4 } from 'three/src/math/Matrix4';
import { Mesh } from 'three/src/objects/Mesh';
import { OrthographicCamera } from 'three/src/cameras/OrthographicCamera';
import { PlaneGeometry } from 'three/src/geometries/PlaneGeometry';
import { Scene } from 'three/src/scenes/Scene';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import { Texture } from 'three/src/textures/Texture';
import { Vector2 } from 'three/src/math/Vector2';
import { Vector3 } from 'three/src/math/Vector3';
import { Vector4 } from 'three/src/math/Vector4';
import { WebGLRenderTarget } from 'three/src/renderers/WebGLRenderTarget';

import brushStrokeVertexShader from './shader/brush-stroke.vert';
import brushStrokeFragmentShader from './shader/brush-stroke.frag';
import brushCompositorVertexShader from './shader/brush-compositor.vert';
import brushCompositorFragmentShader from './shader/brush-compositor.frag';
import copyTileVertexShader from './shader/copy-tile.vert';
import copyTileFragmentShader from './shader/copy-tile.frag';
import sampleBrushColorVertexShader from './shader/sample-brush-color.vert';
import sampleBrushColorFragmentShader from './shader/sample-brush-color.frag';
import spectralFragmentShader from './shader/spectral.frag';

import { markRenderDirty, getWebgl2RendererBackend } from '..';

import type { Camera, WebGLRenderer } from 'three';
import type { RendererBrushStrokeSettings, RendererTextureTile } from '@/types';

export class BrushStroke {
    originalViewport!: Vector4;
    renderer!: WebGLRenderer;
    texture!: Texture;
    layerTransform!: Matrix4;
    layerTransformInverse!: Matrix4;

    brushMaterial!: ShaderMaterial;
    camera!: Camera;
    compositorMaterial!: ShaderMaterial;
    copyTileMaterial!: ShaderMaterial;
    geometry!: PlaneGeometry;
    mesh!: Mesh;
    sampleBrushColorMaterial!: ShaderMaterial;
    scene!: Scene;

    isHalfFloat!: boolean;
    tileSize!: number;
    xTileCount!: number;
    yTileCount!: number;

    x: number = 0;
    y: number = 0;

    brushSize!: number;
    brushColor!: Float16Array;
    brushHardness!: number;
    brushColorBlendingPersistence!: number;
    brushMinConcentration: number = 1;

    allDirtyTiles!: Uint8Array;
    compositeDirtyTiles!: Uint8Array;

    // TODO - share this across multiple brush strokes?
    destinationTextureRenderTargets: Array<WebGLRenderTarget | undefined> = [];
    brushStrokeRenderTargets: Array<WebGLRenderTarget | undefined> = [];
    brushBlendRenderTargetStack: Array<WebGLRenderTarget> = [];
    outputRenderTargetStack: Array<WebGLRenderTarget> = [];
    brushColorRenderTarget1!: WebGLRenderTarget;
    brushColorRenderTarget2!: WebGLRenderTarget;
    inactiveBrushColorRenderTarget!: WebGLRenderTarget;

    // Reuse matrix and vector objects to prevent memory pressure while drawing.
    aabb = new Box2();
    copyTextureRegion = new Box2();
    copyTextureDestination = new Vector2();
    _m0 = new Matrix4();
    _m1 = new Matrix4();
    _m2 = new Matrix4();
    _v30 = new Vector3();
    _v31 = new Vector3();
    _v32 = new Vector3();
    _v33 = new Vector3();

    constructor(
        renderer: WebGLRenderer,
        originalViewport: Vector4,
        texture: Texture,
        layerTransform: Matrix4,
        settings: RendererBrushStrokeSettings,
    ) {
        this.renderer = renderer;
        this.originalViewport = originalViewport;
        this.texture = texture;
        this.layerTransform = layerTransform;
        this.layerTransformInverse = layerTransform.clone().invert();
        this.brushSize = settings.size;
        this.brushColor = settings.color;
        this.brushHardness = settings.hardness;
        this.brushColorBlendingPersistence = settings.colorBlendingPersistence;

        const gl = renderer.getContext();
        this.isHalfFloat = !!(renderer.capabilities.isWebGL2 || gl.getExtension('OES_texture_half_float'));

        this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.scene = new Scene();
        this.geometry = new PlaneGeometry(2, 2);

        const maxTileSize = 8192;
        const minTileSize = Math.max(64, Math.max(this.texture.image.width, this.texture.image.height) / 8);
        const approxTileCount = Math.ceil(Math.sqrt(this.brushSize * this.brushSize) / 1024);
        const estimatedTileSize = Math.max(minTileSize, Math.min(maxTileSize, Math.floor(Math.sqrt((this.brushSize * this.brushSize) / approxTileCount))));
        this.tileSize = Math.pow(2, Math.round(Math.log2(estimatedTileSize)));

        this.xTileCount = Math.ceil(this.texture.image.width / this.tileSize);
        this.yTileCount = Math.ceil(this.texture.image.height / this.tileSize);
        const tileCount = this.xTileCount * this.yTileCount;
        this.allDirtyTiles = new Uint8Array(tileCount);
        this.compositeDirtyTiles = new Uint8Array(tileCount);
        this.destinationTextureRenderTargets = new Array(tileCount);
        this.brushStrokeRenderTargets = new Array(tileCount);

        this.createBrushColorRenderTargets();

        this.brushMaterial = new ShaderMaterial({
            uniforms: {
                brushStrokeMap: { value: undefined },
                brushColorMap: { value: this.brushColorRenderTarget1.texture },
                tileOffsetAndSize: { value: new Vector4() },
                brushTransform: { value: new Matrix4() },
                brushHardness: { value: this.brushHardness },
            },
            vertexShader: brushStrokeVertexShader,
            fragmentShader: brushStrokeFragmentShader,
            depthTest: false,
            depthWrite: false,
            transparent: true,
            premultipliedAlpha: true,
        });

        this.copyTileMaterial = new ShaderMaterial({
            uniforms: {
                map: { value: texture },
                tileOffsetAndSize: { value: new Vector4() },
            },
            vertexShader: copyTileVertexShader,
            fragmentShader: copyTileFragmentShader,
            depthTest: false,
            depthWrite: false,
            transparent: true,
            premultipliedAlpha: true,
        });

        this.sampleBrushColorMaterial = new ShaderMaterial({
            uniforms: {
                sampleMap: { value: texture },
                previousColorMap: { value: this.brushColorRenderTarget2.texture },
                tileOffsetAndSize: { value: new Vector4() },
                brushColor: { value: new Vector4(this.brushColor[0], this.brushColor[1], this.brushColor[2], 1.0) },
                brushBlendingPersistenceBearingConcentration: { value: new Vector4(0, 0, 0, 1) },
            },
            vertexShader: sampleBrushColorVertexShader,
            fragmentShader: sampleBrushColorFragmentShader,
            depthTest: false,
            depthWrite: false,
            transparent: true,
            premultipliedAlpha: true,
        });

        this.compositorMaterial = new ShaderMaterial({
            uniforms: {
                srcMap: { value: undefined },
                dstMap: { value: undefined },
                dstOffsetAndSize: { value: new Vector4() },
                brushAlphaConcentration: { value: new Vector2(this.brushColor[3], 0) },
            },
            vertexShader: brushCompositorVertexShader,
            fragmentShader: spectralFragmentShader + '\n' + brushCompositorFragmentShader,
            depthTest: false,
            depthWrite: false,
            transparent: true,
            premultipliedAlpha: true,
        });

        this.mesh = new Mesh(this.geometry, this.brushMaterial);
        this.scene.add(this.mesh);

        this.populateColor();

        this.composite = this.composite.bind(this);
        getWebgl2RendererBackend().registerBeforeRenderCallback(this.composite);
    }

    populateColor() {
        this.mesh.material = this.sampleBrushColorMaterial;
        this.sampleBrushColorMaterial.uniforms.previousColorMap.value = this.brushColorRenderTarget1.texture;
        this.sampleBrushColorMaterial.uniforms.tileOffsetAndSize.value.x = 0;
        this.sampleBrushColorMaterial.uniforms.tileOffsetAndSize.value.y = 0;
        this.sampleBrushColorMaterial.uniforms.tileOffsetAndSize.value.z = 1;
        this.sampleBrushColorMaterial.uniforms.tileOffsetAndSize.value.w = 1;
        this.sampleBrushColorMaterial.uniforms.brushColor.value.setW(1);
        this.sampleBrushColorMaterial.uniforms.brushBlendingPersistenceBearingConcentration.value.x = 0;
        this.sampleBrushColorMaterial.uniforms.brushBlendingPersistenceBearingConcentration.value.y = 1;
        this.sampleBrushColorMaterial.uniforms.brushBlendingPersistenceBearingConcentration.value.z = 0;
        this.sampleBrushColorMaterial.uniformsNeedUpdate = true;
        this.renderer.setViewport(0, 0, 1, 1);
        this.renderer.setRenderTarget(this.brushColorRenderTarget2);
        this.renderer.clearColor();
        // this.renderer.render(this.scene, this.camera);
        this.renderer.setRenderTarget(null);
        this.renderer.setViewport(this.originalViewport);

        this.sampleBrushColorMaterial.uniforms.brushBlendingPersistenceBearingConcentration.value.y = Math.max(0.001, (1.0 - this.brushColorBlendingPersistence) * 0.01);
        this.sampleBrushColorMaterial.uniformsNeedUpdate = true;
    }

    move(
        x: number,
        y: number,
        size: number,
        density: number,
        colorBlendingStrength: number,
        concentration: number,
    ) {
        let bearing = Math.atan2(this.y - y, (x - this.x));
        if (bearing < 0) bearing += 2 * Math.PI;
        this.x = x;
        this.y = y;
        this.brushMinConcentration = Math.min(this.brushMinConcentration, concentration);

        const brushSize = size;
        const brushLeft = x - brushSize / 2;
        const brushTop = y - brushSize / 2;

        const p0 = this._v30.set(brushLeft, brushTop, 0.0).applyMatrix4(this.layerTransformInverse);
        const p1 = this._v31.set(brushLeft + brushSize, brushTop, 0.0).applyMatrix4(this.layerTransformInverse);
        const p2 = this._v32.set(brushLeft, brushTop + brushSize, 0.0).applyMatrix4(this.layerTransformInverse);
        const p3 = this._v33.set(brushLeft + brushSize, brushTop + brushSize, 0.0).applyMatrix4(this.layerTransformInverse);
        const aabb = this.aabb;
        aabb.min.x = Math.min(p0.x, p1.x, p2.x, p3.x);
        aabb.min.y = Math.min(p0.y, p1.y, p2.y, p3.y);
        aabb.max.x = Math.max(p0.x, p1.x, p2.x, p3.x);
        aabb.max.y = Math.max(p0.y, p1.y, p2.y, p3.y);

        let xi = 0;
        let yi = 0;
        let tileX = 0;
        let tileY = 0;
        let tileWidth = 0;
        let tileHeight = 0;
        let brushRenderTarget: WebGLRenderTarget;

        // Find the average color under the brush stamp
        const activeBrushColorRenderTarget = this.inactiveBrushColorRenderTarget == this.brushColorRenderTarget1 ? this.brushColorRenderTarget2 : this.brushColorRenderTarget1;
        this.mesh.material = this.sampleBrushColorMaterial;
        this.sampleBrushColorMaterial.uniforms.previousColorMap.value = this.inactiveBrushColorRenderTarget.texture;
        this.sampleBrushColorMaterial.uniforms.tileOffsetAndSize.value.x = aabb.min.x / this.texture.image.width;
        this.sampleBrushColorMaterial.uniforms.tileOffsetAndSize.value.y = aabb.min.y / this.texture.image.height;
        this.sampleBrushColorMaterial.uniforms.tileOffsetAndSize.value.z = (aabb.max.x - aabb.min.x) / this.texture.image.width;
        this.sampleBrushColorMaterial.uniforms.tileOffsetAndSize.value.w = (aabb.max.y - aabb.min.y) / this.texture.image.height;
        this.sampleBrushColorMaterial.uniforms.brushColor.value.setW(density);
        this.sampleBrushColorMaterial.uniforms.brushBlendingPersistenceBearingConcentration.value.x = colorBlendingStrength;
        this.sampleBrushColorMaterial.uniforms.brushBlendingPersistenceBearingConcentration.value.z = bearing;
        this.sampleBrushColorMaterial.uniforms.brushBlendingPersistenceBearingConcentration.value.w = concentration;
        this.sampleBrushColorMaterial.uniformsNeedUpdate = true;
        this.renderer.setViewport(0, 0, this.brushSize, this.brushSize);
        this.renderer.setRenderTarget(activeBrushColorRenderTarget);
        this.renderer.clearColor();
        this.renderer.render(this.scene, this.camera);
        this.inactiveBrushColorRenderTarget = (this.inactiveBrushColorRenderTarget == this.brushColorRenderTarget1) ? this.brushColorRenderTarget2 : this.brushColorRenderTarget1;

        // Loop through each tile and render tiles affected by the brush stamp
        let count = 0;
        for (xi = 0; xi < this.xTileCount; xi++) {
            tileX = xi * this.tileSize;
            tileWidth = Math.min(this.tileSize, this.texture.image.width - tileX);

            if (tileX + tileWidth < aabb.min.x || tileX > aabb.max.x) continue;

            for (yi = 0; yi < this.yTileCount; yi++) {
                tileY = yi * this.tileSize;
                tileHeight = Math.min(this.tileSize, this.texture.image.height - tileY);

                if (tileY + tileHeight < aabb.min.y || tileY > aabb.max.y) continue;

                count++;

                brushRenderTarget = this.createBrushTextureRenderTarget(
                    xi,
                    yi,
                    tileWidth,
                    tileHeight,
                );

                // Set up brush material
                this.mesh.material = this.brushMaterial;

                const brushTileOffsetX = (tileX - brushLeft) / brushSize;
                const brushTileOffsetY = (tileY - brushTop) / brushSize;
                const brushTileScaleX = (tileWidth / brushSize);
                const brushTileScaleY = (tileHeight / brushSize);

                this.brushMaterial.uniforms.brushStrokeMap.value = brushRenderTarget.texture;
                this.brushMaterial.uniforms.brushColorMap.value = activeBrushColorRenderTarget.texture;
                this.brushMaterial.uniforms.tileOffsetAndSize.value.x = 0;
                this.brushMaterial.uniforms.tileOffsetAndSize.value.y = 0;
                this.brushMaterial.uniforms.tileOffsetAndSize.value.z = 1;
                this.brushMaterial.uniforms.tileOffsetAndSize.value.w = 1;

                this._v30.x = -brushLeft / brushSize;
                this._v30.y = 1.0 + (brushTop / brushSize);
                this._v30.z = 0.0;
                const tileTransformReset = this._m0.identity()
                    .multiply(
                        this._m1.makeTranslation(this._v30)
                    )
                    .multiply(
                        this._m1.makeScale(
                            1.0 / brushSize,
                            -1.0 / brushSize,
                            1.0,
                        )
                    );
                const tileTransformResetInverse = this._m1.copy(tileTransformReset).invert();

                this._v30.x = brushTileOffsetX;
                this._v30.y = 1.0 - brushTileOffsetY - brushTileScaleY;
                this._v30.z = 1.0;
                (this.brushMaterial.uniforms.brushTransform.value as Matrix4)
                    .identity()
                    .multiply(tileTransformReset)
                    .multiply(
                        this.layerTransform
                    )
                    .multiply(tileTransformResetInverse)
                    .multiply(
                        this._m2.makeTranslation(this._v30)
                    )
                    .multiply(
                        this._m2.makeScale(
                            brushTileScaleX,
                            brushTileScaleY,
                            1.0,
                        )
                    );

                this.brushMaterial.uniformsNeedUpdate = true;
                
                // Render brush tile
                const brushBlendRenderTarget = this.createBrushBlendRenderTarget(tileWidth, tileHeight);
                this.renderer.setViewport(0, 0, tileWidth, tileHeight);
                this.renderer.setRenderTarget(brushBlendRenderTarget);
                this.renderer.clearColor();
                this.renderer.render(this.scene, this.camera);
                
                // Copy brush render result back to the brush render target
                this.mesh.material = this.copyTileMaterial;
                this.copyTileMaterial.uniforms.map.value = brushBlendRenderTarget.texture;
                this.copyTileMaterial.uniforms.tileOffsetAndSize.value.x = 0;
                this.copyTileMaterial.uniforms.tileOffsetAndSize.value.y = 0;
                this.copyTileMaterial.uniforms.tileOffsetAndSize.value.z = 1;
                this.copyTileMaterial.uniforms.tileOffsetAndSize.value.w = 1;
                this.copyTileMaterial.uniformsNeedUpdate = true;
                this.renderer.setRenderTarget(brushRenderTarget);
                this.renderer.clearColor();
                this.renderer.render(this.scene, this.camera);

                this.allDirtyTiles[yi * this.xTileCount + xi] = 1;
                this.compositeDirtyTiles[yi * this.xTileCount + xi] = 1;
            }
        }

        this.renderer.setRenderTarget(null);
        this.renderer.setViewport(this.originalViewport);
        markRenderDirty();
    }

    composite() {
        let destinationRenderTarget: WebGLRenderTarget;
        let brushRenderTarget: WebGLRenderTarget;

        let xi: number;
        let yi: number;
        let tileX: number;
        let tileY: number;
        let tileWidth: number;
        let tileHeight: number;
        for (let i = 0; i < this.compositeDirtyTiles.length; i++) {
            if (this.compositeDirtyTiles[i] === 0) continue;
            this.compositeDirtyTiles[i] = 0;

            yi = Math.floor(i / this.xTileCount);
            xi = i - yi * this.xTileCount;
            tileX = xi * this.tileSize;
            tileY = yi * this.tileSize;
            tileWidth = Math.min(this.tileSize, this.texture.image.width - tileX);
            tileHeight = Math.min(this.tileSize, this.texture.image.height - tileY);

            destinationRenderTarget = this.createDestinationTextureRenderTarget(
                xi,
                yi,
                tileWidth,
                tileHeight,
            );

            brushRenderTarget = this.createBrushTextureRenderTarget(
                xi,
                yi,
                tileWidth,
                tileHeight,
            );

            // Set up composite material
            this.mesh.material = this.compositorMaterial;

            this.compositorMaterial.uniforms.dstMap.value = destinationRenderTarget.texture;
            this.compositorMaterial.uniforms.dstOffsetAndSize.value.x = 0;
            this.compositorMaterial.uniforms.dstOffsetAndSize.value.y = 0;
            this.compositorMaterial.uniforms.dstOffsetAndSize.value.z = 1;
            this.compositorMaterial.uniforms.dstOffsetAndSize.value.w = 1;
            this.compositorMaterial.uniforms.srcMap.value = brushRenderTarget.texture;
            this.compositorMaterial.uniforms.brushAlphaConcentration.value.y = this.brushMinConcentration;
            this.compositorMaterial.uniformsNeedUpdate = true;

            // Render composite tile
            const outputRenderTarget = this.createOutputTileRenderTarget(tileWidth, tileHeight);
            this.renderer.setViewport(0, 0, tileWidth, tileHeight);
            this.renderer.setRenderTarget(outputRenderTarget);
            this.renderer.clearColor();
            this.renderer.render(this.scene, this.camera);
            this.renderer.setRenderTarget(null);

            // Copy render result back to original texture in GPU
            this.copyTextureRegion.min.x = 0;
            this.copyTextureRegion.min.y = 0;
            this.copyTextureRegion.max.x = tileWidth;
            this.copyTextureRegion.max.y = tileHeight;
            this.copyTextureDestination.x = tileX;
            this.copyTextureDestination.y = this.texture.image.height - tileHeight - tileY;
            this.renderer.copyTextureToTexture(
                outputRenderTarget.texture,
                this.texture,
                this.copyTextureRegion,
                this.copyTextureDestination,
            );
        }

        this.renderer.setRenderTarget(null);
        this.renderer.setViewport(this.originalViewport);
    }

    async collectTiles(): Promise<RendererTextureTile[]> {
        this.composite();

        const newImageBufferReads: Array<Promise<Uint8Array>> = [];
        const oldImageBufferReads: Array<Promise<Uint8Array>> = [];
        const tiles: Array<RendererTextureTile> = [];

        let xi: number;
        let yi: number;
        let tileX: number;
        let tileY: number;
        let tileWidth: number;
        let tileHeight: number;

        for (let i = 0; i < this.allDirtyTiles.length; i++) {
            if (this.allDirtyTiles[i] === 0) continue;
            this.allDirtyTiles[i] = 0;

            yi = Math.floor(i / this.xTileCount);
            xi = i - yi * this.xTileCount;
            tileX = xi * this.tileSize;
            tileY = yi * this.tileSize;
            tileWidth = Math.min(this.tileSize, this.texture.image.width - tileX);
            tileHeight = Math.min(this.tileSize, this.texture.image.height - tileY);

            this.mesh.material = this.copyTileMaterial;

            // Read the pixels from this tile on the old texture, already stored during the brush stroke.
            const oldTextureTile = this.createDestinationTextureRenderTarget(xi, yi, tileWidth, tileHeight);
            const oldBuffer = new Uint8Array(tileWidth * tileHeight * 4);
            oldImageBufferReads.push(
                this.renderer.readRenderTargetPixelsAsync(oldTextureTile, 0, 0, tileWidth, tileHeight, oldBuffer) as Promise<Uint8Array>
            );

            // Render a crop of the current texture a tile render target & read its pixels.
            this.copyTileMaterial.uniforms.map.value = this.texture;
            this.copyTileMaterial.uniforms.tileOffsetAndSize.value.x = tileX / this.texture.image.width;
            this.copyTileMaterial.uniforms.tileOffsetAndSize.value.y = tileY / this.texture.image.height;
            this.copyTileMaterial.uniforms.tileOffsetAndSize.value.z = tileWidth / this.texture.image.width;
            this.copyTileMaterial.uniforms.tileOffsetAndSize.value.w = tileHeight / this.texture.image.height;
            this.copyTileMaterial.uniformsNeedUpdate = true;

            const outputRenderTarget = this.createOutputTileRenderTarget(tileWidth, tileHeight);
            this.renderer.setViewport(0, 0, tileWidth, tileHeight);
            this.renderer.setRenderTarget(outputRenderTarget);
            this.renderer.clearColor();
            this.renderer.render(this.scene, this.camera);
            
            const newBuffer = new Uint8Array(tileWidth * tileHeight * 4);
            newImageBufferReads.push(
                this.renderer.readRenderTargetPixelsAsync(outputRenderTarget, 0, 0, tileWidth, tileHeight, newBuffer) as Promise<Uint8Array>
            );
            tiles.push({
                x: tileX,
                y: tileY,
                width: tileWidth,
                height: tileHeight,
                oldImage: undefined,
                image: undefined as never,
            });
        }
        this.renderer.setRenderTarget(null);
        this.renderer.setViewport(this.originalViewport);

        const [settledNewBufferReads, settledOldBufferReads] = await Promise.all([
            Promise.allSettled(newImageBufferReads),
            Promise.allSettled(oldImageBufferReads),
        ]);
        const createdNewBitmaps: Array<Promise<ImageBitmap>> = [];
        const createdOldBitmaps: Array<Promise<ImageBitmap>> = [];
        for (let i = 0; i < settledNewBufferReads.length; i++) {
            const newSettleResult = settledNewBufferReads[i];
            const oldSettleResult = settledOldBufferReads[i];
            if (newSettleResult.status === 'fulfilled' && oldSettleResult.status === 'fulfilled') {
                createdNewBitmaps.push(
                    createImageBitmap(
                        new ImageData(new Uint8ClampedArray(newSettleResult.value), tiles[i].width, tiles[i].height),
                        { imageOrientation: 'flipY' },
                    )
                );
                createdOldBitmaps.push(
                    createImageBitmap(
                        new ImageData(new Uint8ClampedArray(oldSettleResult.value), tiles[i].width, tiles[i].height),
                        { imageOrientation: 'flipY' },
                    )
                );
            }
        }

        const [settledNewBitmaps, settledOldBitmaps] = await Promise.all([
            Promise.allSettled(createdNewBitmaps),
            Promise.allSettled(createdOldBitmaps),
        ]);
        for (let i = 0; i < settledNewBitmaps.length; i++) {
            const newSettleResult = settledNewBitmaps[i];
            const oldSettleResult = settledOldBitmaps[i];
            if (newSettleResult.status === 'fulfilled' && oldSettleResult.status === 'fulfilled') {
                tiles[i].image = newSettleResult.value;
                tiles[i].oldImage = oldSettleResult.value;
            }
        }

        return tiles.filter((tile) => tile.image) as RendererTextureTile[];
    }

    createOutputTileRenderTarget(
        tileWidth: number,
        tileHeight: number,
    ): WebGLRenderTarget {
        for (const renderTarget of this.outputRenderTargetStack) {
            if (renderTarget.width === tileWidth && renderTarget.height === tileHeight) {
                return renderTarget;
            }
        }
        const renderTarget = new WebGLRenderTarget(tileWidth, tileHeight, {
            type: this.texture.type,
            minFilter: NearestFilter,
            magFilter: NearestFilter,
            wrapS: ClampToEdgeWrapping,
            wrapT: ClampToEdgeWrapping,
            format: RGBAFormat,
            internalFormat: this.texture.internalFormat,
            depthBuffer: false,
            colorSpace: this.texture.colorSpace,
            stencilBuffer: false,
        });
        this.outputRenderTargetStack.push(renderTarget);
        return renderTarget;
    }

    createBrushColorRenderTargets() {
        if (!this.brushColorRenderTarget1) {
            this.brushColorRenderTarget1 = new WebGLRenderTarget(8, 8, {
                type: FloatType,
                minFilter: NearestFilter,
                magFilter: NearestFilter,
                wrapS: ClampToEdgeWrapping,
                wrapT: ClampToEdgeWrapping,
                format: RGBAFormat,
                internalFormat: this.texture.internalFormat,
                depthBuffer: false,
                colorSpace: LinearSRGBColorSpace,
                stencilBuffer: false,
                generateMipmaps: false,
            });
        }
        if (!this.brushColorRenderTarget2) {
            this.brushColorRenderTarget2 = new WebGLRenderTarget(8, 8, {
                type: FloatType,
                minFilter: NearestFilter,
                magFilter: NearestFilter,
                wrapS: ClampToEdgeWrapping,
                wrapT: ClampToEdgeWrapping,
                format: RGBAFormat,
                internalFormat: this.texture.internalFormat,
                depthBuffer: false,
                colorSpace: LinearSRGBColorSpace,
                stencilBuffer: false,
                generateMipmaps: false,
            });
            this.inactiveBrushColorRenderTarget = this.brushColorRenderTarget2;
        }
    }

    createBrushBlendRenderTarget(
        tileWidth: number,
        tileHeight: number,
    ): WebGLRenderTarget {
        for (const renderTarget of this.brushBlendRenderTargetStack) {
            if (renderTarget.width === tileWidth && renderTarget.height === tileHeight) {
                return renderTarget;
            }
        }
        const renderTarget = new WebGLRenderTarget(tileWidth, tileHeight, {
            type: this.isHalfFloat ? HalfFloatType : UnsignedByteType,
            minFilter: NearestFilter,
            magFilter: NearestFilter,
            wrapS: ClampToEdgeWrapping,
            wrapT: ClampToEdgeWrapping,
            format: RGBAFormat,
            internalFormat: this.texture.internalFormat,
            depthBuffer: false,
            colorSpace: LinearSRGBColorSpace,
            stencilBuffer: false,
            generateMipmaps: false,
        });
        this.brushBlendRenderTargetStack.push(renderTarget);
        return renderTarget;
    }

    createDestinationTextureRenderTarget(
        xi: number,
        yi: number,
        tileWidth: number,
        tileHeight: number,
    ): WebGLRenderTarget {
        const tileIndex = yi * this.xTileCount + xi;
        let renderTarget = this.destinationTextureRenderTargets[tileIndex];
        if (!renderTarget) {
            renderTarget = new WebGLRenderTarget(tileWidth, tileHeight, {
                type: UnsignedByteType, // Required for readRenderTargetPixelsAsync read.
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
            this.destinationTextureRenderTargets[tileIndex] = renderTarget;

            this.mesh.material = this.copyTileMaterial;
            this.copyTileMaterial.uniforms.map.value = this.texture;
            this.copyTileMaterial.uniforms.tileOffsetAndSize.value.x = (xi * this.tileSize) / this.texture.image.width;
            this.copyTileMaterial.uniforms.tileOffsetAndSize.value.y = (yi * this.tileSize) / this.texture.image.height;
            this.copyTileMaterial.uniforms.tileOffsetAndSize.value.z = tileWidth / this.texture.image.width;
            this.copyTileMaterial.uniforms.tileOffsetAndSize.value.w = tileHeight / this.texture.image.height;
            this.copyTileMaterial.uniformsNeedUpdate = true;

            this.renderer.setViewport(0, 0, tileWidth, tileHeight);
            this.renderer.setRenderTarget(renderTarget);
            this.renderer.render(this.scene, this.camera);
        }
        return renderTarget;
    }

    createBrushTextureRenderTarget(
        xi: number,
        yi: number,
        tileWidth: number,
        tileHeight: number,
    ): WebGLRenderTarget {
        const tileIndex = yi * this.xTileCount + xi;
        let renderTarget = this.brushStrokeRenderTargets[tileIndex];
        if (!renderTarget) {
            renderTarget = new WebGLRenderTarget(tileWidth, tileHeight, {
                type: this.isHalfFloat ? HalfFloatType : UnsignedByteType,
                minFilter: NearestFilter,
                magFilter: NearestFilter,
                wrapS: ClampToEdgeWrapping,
                wrapT: ClampToEdgeWrapping,
                format: RGBAFormat,
                internalFormat: this.texture.internalFormat,
                depthBuffer: false,
                colorSpace: LinearSRGBColorSpace,
                stencilBuffer: false,
                generateMipmaps: false,
            });
            this.brushStrokeRenderTargets[tileIndex] = renderTarget;
        }
        return renderTarget;
    }

    dispose() {
        getWebgl2RendererBackend().unregisterBeforeRenderCallback(this.composite);

        this.geometry?.dispose();
        this.brushMaterial?.dispose();
        this.copyTileMaterial?.dispose();

        for (const renderTarget of this.destinationTextureRenderTargets) {
            renderTarget?.dispose();
        }

        for (const renderTarget of this.brushStrokeRenderTargets) {
            renderTarget?.dispose();
        }

        for (const renderTarget of this.brushBlendRenderTargetStack) {
            renderTarget.dispose();
        }

        for (const renderTarget of this.outputRenderTargetStack) {
            renderTarget.dispose();
        }

        this.brushColorRenderTarget1.dispose();
        this.brushColorRenderTarget2.dispose();
    }
}