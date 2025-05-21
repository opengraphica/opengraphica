import { LinearFilter, ClampToEdgeWrapping, RGBAFormat, LinearSRGBColorSpace, SRGBColorSpace, HalfFloatType, UnsignedByteType, NearestFilter } from 'three/src/constants';
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
import compositorVertexShader from './shader/compositor.vert';
import compositorFragmentShader from './shader/compositor.frag';
import copyTileVertexShader from './shader/copy-tile.vert';
import copyTileFragmentShader from './shader/copy-tile.frag';

import { markRenderDirty, getWebgl2RendererBackend } from '..';

import type { Camera, WebGLRenderer } from 'three';
import type { RendererBrushStrokeSettings } from '@/types';

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
    scene!: Scene;

    isHalfFloat!: boolean;
    tileSize!: number;
    xTileCount!: number;
    yTileCount!: number;

    brushSize!: number;
    brushColor!: Float16Array;

    dirtyTiles!: Uint8Array;

    // TODO - share this across multiple brush strokes?
    destinationTextureRenderTargets: Array<WebGLRenderTarget | undefined> = [];
    brushStrokeRenderTargets: Array<WebGLRenderTarget | undefined> = [];
    brushBlendRenderTargetStack: Array<WebGLRenderTarget> = [];
    outputRenderTargetStack: Array<WebGLRenderTarget> = [];

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
        this.dirtyTiles = new Uint8Array(tileCount);
        this.destinationTextureRenderTargets = new Array(tileCount);
        this.brushStrokeRenderTargets = new Array(tileCount);

        this.brushMaterial = new ShaderMaterial({
            uniforms: {
                brushStrokeMap: { value: undefined },
                tileOffsetAndSize: { value: new Vector4() },
                brushTransform: { value: new Matrix4() },
                brushColor: { value: new Vector4(this.brushColor[0], this.brushColor[1], this.brushColor[2], 1.0) },
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

        this.compositorMaterial = new ShaderMaterial({
            uniforms: {
                srcMap: { value: undefined },
                dstMap: { value: undefined },
                dstOffsetAndSize: { value: new Vector4() },
            },
            vertexShader: compositorVertexShader,
            fragmentShader: compositorFragmentShader,
            depthTest: false,
            depthWrite: false,
            transparent: true,
            premultipliedAlpha: true,
        });

        this.mesh = new Mesh(this.geometry, this.brushMaterial);
        this.scene.add(this.mesh);

        this.composite = this.composite.bind(this);
        getWebgl2RendererBackend().registerBeforeRenderCallback(this.composite);
    }

    move(
        x: number,
        y: number,
        size: number,
    ) {
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

                this.dirtyTiles[yi * this.xTileCount + xi] = 1;
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
        for (let i = 0; i < this.dirtyTiles.length; i++) {
            if (this.dirtyTiles[i] === 0) continue;
            this.dirtyTiles[i] = 0;

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
            });
            this.brushStrokeRenderTargets[tileIndex] = renderTarget;
        }
        return renderTarget;
    }

    dispose() {
        this.composite();
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
    }
}