import {
    ClampToEdgeWrapping, CustomBlending, DoubleSide, LinearFilter, LinearSRGBColorSpace, NearestFilter,
    NormalBlending, OneFactor, OneMinusSrcAlphaFactor, SrcAlphaFactor, SRGBColorSpace, RepeatWrapping,
    RGBAFormat, UnsignedByteType, ZeroFactor,
} from 'three/src/constants';
import { Box2 } from 'three/src/math/Box2';
import { Matrix4 } from 'three/src/math/Matrix4';
import { Mesh } from 'three/src/objects/Mesh';
import { OrthographicCamera } from 'three/src/cameras/OrthographicCamera';
import { PlaneGeometry } from 'three/src/geometries/PlaneGeometry';
import { Scene } from 'three/src/scenes/Scene';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import { Texture } from 'three/src/textures/Texture';
import { TextureLoader } from 'three/src/loaders/TextureLoader';
import { Vector2 } from 'three/src/math/Vector2';
import { Vector3 } from 'three/src/math/Vector3';
import { Vector4 } from 'three/src/math/Vector4';
import { WebGLRenderTarget } from 'three/src/renderers/WebGLRenderTarget';

import selectionMaskVertexShader from './shader/selection-mask.vert';
import selectionMaskFragmentShader from './shader/selection-mask.frag';
import applySelectionMaskToAlphaChannelVertexShader from './shader/apply-selection-mask-to-alpha-channel.vert';
import applySelectionMaskToAlphaChannelFragmentShader from './shader/apply-selection-mask-to-alpha-channel.frag';

import type { Camera, PixelFormatGPU, TextureDataType, WebGLRenderer } from 'three';
import type { RendererTextureTile } from '@/types';

const selectionMaskPatternSrc = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAABg2lDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV/TiiIVh3YQcchQnVoQFXHUKhShQqgVWnUwufQLmjQkKS6OgmvBwY/FqoOLs64OroIg+AHi6OSk6CIl/i8ptIjx4Lgf7+497t4BQrPKNCs0Dmi6bWZSSTGXXxV7XyEgghDiCMjMMuYkKQ3f8XWPAF/vEjzL/9yfY0AtWAwIiMSzzDBt4g3i6U3b4LxPHGVlWSU+J46bdEHiR64rHr9xLrks8Myomc3ME0eJxVIXK13MyqZGPEUcUzWd8oWcxyrnLc5atc7a9+QvDBf0lWWu0xxBCotYggQRCuqooAobCVp1UixkaD/p4x92/RK5FHJVwMixgBo0yK4f/A9+d2sVJye8pHAS6HlxnI9RoHcXaDUc5/vYcVonQPAZuNI7/loTmPkkvdHRYkfA4DZwcd3RlD3gcgcYejJkU3alIE2hWATez+ib8kDkFuhf83pr7+P0AchSV+kb4OAQGCtR9rrPu/u6e/v3TLu/Hx5FcoXj45C+AAAABmJLR0QATgBOAE714JEKAAAACXBIWXMAAC4jAAAuIwF4pT92AAAAB3RJTUUH5gITBDkEOkUYUQAAABl0RVh0Q29tbWVudABDcmVhdGVkIHdpdGggR0lNUFeBDhcAAAAtSURBVAjXY/z//383AxT4+/szMCFzNm7cCBGAcRgYGBiYz58/7wbjMDAwMAAAGKUPRK2REh8AAAAASUVORK5CYII=';

export class SelectionMask {
    scene!: Scene;
    selectionMaskMesh!: Mesh;
    selectionMaskMaterial!: ShaderMaterial;

    renderTargetStack: Array<WebGLRenderTarget | undefined> = new Array(8);
    renderTargetWaitQueue: Array<(target: WebGLRenderTarget) => void> = [];

    get visible() {
        return this.selectionMaskMesh.visible;
    }

    set visible(visible: boolean) {
        this.selectionMaskMesh.visible = visible;
    }

    async initialize(camera: Camera, scene: Scene, viewWidth: number, viewHeight: number) {
        this.scene = scene;

        const selectionMaskUnselectedPatternTexture = await new Promise<InstanceType<typeof Texture> | undefined>((resolve) => {
            const texture = new TextureLoader().load(
                selectionMaskPatternSrc,
                () => { resolve(texture); },
                undefined,
                () => { resolve(undefined); }
            );
        });
        if (selectionMaskUnselectedPatternTexture) {
            selectionMaskUnselectedPatternTexture.wrapS = RepeatWrapping;
            selectionMaskUnselectedPatternTexture.wrapT = RepeatWrapping;
            selectionMaskUnselectedPatternTexture.colorSpace = SRGBColorSpace;
        }
        const selectionMaskGeometry = new PlaneGeometry(2, 2); //viewportWidth.value, viewportHeight.value);
        this.selectionMaskMaterial = new ShaderMaterial({
            transparent: true,
            depthTest: false,
            vertexShader: selectionMaskVertexShader,
            fragmentShader: selectionMaskFragmentShader,
            side: DoubleSide,
            defines: {
                cUseClipping: 0,
            },
            uniforms: {
                unselectedMaskMap: { value: selectionMaskUnselectedPatternTexture },
                selectedMaskMap: { value: undefined },
                selectedMaskSize: { value: [1, 1] },
                selectedMaskOffset: { value: [0, 0] },
                viewportWidth: { value: viewWidth },
                viewportHeight: { value: viewHeight },
                inverseProjectionMatrix: { value: camera.projectionMatrixInverse.elements },
            },
        });
        this.selectionMaskMesh = new Mesh(selectionMaskGeometry, this.selectionMaskMaterial);
        this.selectionMaskMesh.renderOrder = 9999999999999;
        this.selectionMaskMesh.position.z = 0.2;
        this.selectionMaskMesh.frustumCulled = false;
        this.selectionMaskMesh.visible = false;
        this.scene.add(this.selectionMaskMesh);
    }

    useClipping(clip: boolean) {
        if (clip) {
            this.selectionMaskMaterial.defines.cUseClipping = 1;
            this.selectionMaskMaterial.blending = CustomBlending;
            this.selectionMaskMaterial.blendSrc = ZeroFactor;
            this.selectionMaskMaterial.blendDst = OneFactor;
            this.selectionMaskMaterial.blendSrcAlpha = OneFactor;
            this.selectionMaskMaterial.blendDstAlpha = ZeroFactor;
            this.selectionMaskMaterial.needsUpdate = true;
        } else {
            this.selectionMaskMaterial.defines.cUseClipping = 0;
            this.selectionMaskMaterial.blending = NormalBlending;
            this.selectionMaskMaterial.blendSrc = SrcAlphaFactor;
            this.selectionMaskMaterial.blendDst = OneMinusSrcAlphaFactor;
            this.selectionMaskMaterial.blendSrcAlpha = null;
            this.selectionMaskMaterial.blendDstAlpha = null;
            this.selectionMaskMaterial.needsUpdate = true;
        }
    }

    setImage(image?: ImageBitmap, offset?: { x: number, y: number }) {
        this.selectionMaskMaterial.uniforms.selectedMaskMap.value?.dispose();
        this.selectionMaskMaterial.uniforms.selectedMaskMap.value?.image?.close?.();
        if (image) {
            const selectionMaskTexture = new Texture(image);
            selectionMaskTexture.type = UnsignedByteType;
            selectionMaskTexture.magFilter = NearestFilter;
            selectionMaskTexture.minFilter = LinearFilter;
            selectionMaskTexture.wrapS = ClampToEdgeWrapping;
            selectionMaskTexture.wrapT = ClampToEdgeWrapping;
            selectionMaskTexture.colorSpace = SRGBColorSpace;
            selectionMaskTexture.format = RGBAFormat;
            selectionMaskTexture.needsUpdate = true;
            this.selectionMaskMaterial.uniforms.selectedMaskMap.value = selectionMaskTexture;
            this.selectionMaskMaterial.uniforms.selectedMaskSize.value = [image.width, image.height];
            this.selectionMaskMaterial.uniforms.selectedMaskOffset.value = [offset?.x ?? 0, offset?.y ?? 0];
            this.selectionMaskMesh.visible = true;
        } else {
            this.selectionMaskMaterial.uniforms.selectedMaskMap.value = undefined;
            this.selectionMaskMaterial.uniforms.selectedMaskSize.value = [1, 1];
            this.selectionMaskMaterial.uniforms.selectedMaskOffset.value = [0, 0];
            this.selectionMaskMesh.visible = false;
        }
        this.selectionMaskMaterial.needsUpdate = true;
    }

    setCamera(camera: Camera) {
        this.selectionMaskMaterial.uniforms.inverseProjectionMatrix.value = camera.projectionMatrixInverse.elements;
        this.selectionMaskMaterial.needsUpdate = true;
    }

    async applyToTextureAlphaChannel(
        texture: Texture,
        maskTransform: Matrix4,
        renderer: WebGLRenderer,
        invert: boolean = false,
    ): Promise<RendererTextureTile[]> {
        const originalRendererViewport = new Vector4();
        renderer.getViewport(originalRendererViewport);

        console.time('mask');

        const maskTransformInverse = maskTransform.clone().invert();

        const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const scene = new Scene();
        const geometry = new PlaneGeometry(2, 2);

        const selectionMaskMap = this.selectionMaskMaterial.uniforms.selectedMaskMap.value;
        const selectionMaskOffset = this.selectionMaskMaterial.uniforms.selectedMaskOffset.value;
        const selectionMaskWidth = selectionMaskMap.image.width;
        const selectionMaskHeight = selectionMaskMap.image.height;

        const maxTileSize = 8192;
        const minTileSize = 64;
        const approxTileCount = Math.ceil(Math.sqrt(selectionMaskWidth * selectionMaskHeight) / 1024);
        const estimatedTileSize = Math.max(minTileSize, Math.min(maxTileSize, Math.floor(Math.sqrt((selectionMaskWidth * selectionMaskHeight) / approxTileCount))));
        const tileSize = Math.pow(2, Math.round(Math.log2(estimatedTileSize)));

        const material = new ShaderMaterial({
            defines: {
                cInvert: invert ? 1 : 0,
            },
            uniforms: {
                baseMap: { value: texture },
                selectionMaskMap: { value: selectionMaskMap },
                tileOffsetAndSize: { value: new Vector4() },
                selectionMaskTransform: { value: new Matrix4() },
                selectionMaskAlpha: { value: 1 },
            },
            vertexShader: applySelectionMaskToAlphaChannelVertexShader,
            fragmentShader: applySelectionMaskToAlphaChannelFragmentShader,
            depthTest: false,
            depthWrite: false,
            transparent: true,
            premultipliedAlpha: true,
        });

        const mesh = new Mesh(geometry, material);
        scene.add(mesh);

        const p0 = new Vector3(selectionMaskOffset[0], selectionMaskOffset[1], 0.0).applyMatrix4(maskTransformInverse);
        const p1 = new Vector3(selectionMaskOffset[0] + selectionMaskWidth, selectionMaskOffset[1], 0.0).applyMatrix4(maskTransformInverse);
        const p2 = new Vector3(selectionMaskOffset[0], selectionMaskOffset[1] + selectionMaskHeight, 0.0).applyMatrix4(maskTransformInverse);
        const p3 = new Vector3(selectionMaskOffset[0] + selectionMaskWidth, selectionMaskOffset[1] + selectionMaskHeight, 0.0).applyMatrix4(maskTransformInverse);
        const aabb = new Box2(
            new Vector2(Math.min(p0.x, p1.x, p2.x, p3.x), Math.min(p0.y, p1.y, p2.y, p3.y)),
            new Vector2(Math.max(p0.x, p1.x, p2.x, p3.x), Math.max(p0.y, p1.y, p2.y, p3.y)),
        );

        const tileBitmaps: RendererTextureTile[] = [];
        const tileReadPromises: Promise<void>[] = [];

        for (let tileX = 0; tileX < texture.image.width; tileX += tileSize) {
            const tileWidth = Math.min(tileSize, texture.image.width - tileX);

            if (tileX + tileWidth < aabb.min.x || tileX > aabb.max.x) continue;

            for (let tileY = 0; tileY < texture.image.height; tileY += tileSize) {
                const tileHeight = Math.min(tileSize, texture.image.height - tileY);

                if (tileY + tileHeight < aabb.min.y || tileY > aabb.max.y) continue;

                material.uniforms.tileOffsetAndSize.value.x = tileX / texture.image.width;
                material.uniforms.tileOffsetAndSize.value.y = tileY / texture.image.height;
                material.uniforms.tileOffsetAndSize.value.z = tileWidth / texture.image.width;
                material.uniforms.tileOffsetAndSize.value.w = tileHeight / texture.image.height;

                const selectionMaskTileOffsetX = (tileX - selectionMaskOffset[0]) / selectionMaskWidth;
                const selectionMaskTileOffsetY = (tileY - selectionMaskOffset[1]) / selectionMaskHeight;
                const selectionMaskTileScaleX = (tileWidth / selectionMaskWidth);
                const selectionMaskTileScaleY = (tileHeight / selectionMaskHeight);

                const tileTransformReset = new Matrix4()
                    .multiply(
                        new Matrix4().makeTranslation(new Vector3(
                            -selectionMaskOffset[0] / selectionMaskWidth,
                            1.0 + (selectionMaskOffset[1] / selectionMaskHeight),
                            0.0
                        ))
                    )
                    .multiply(
                        new Matrix4().makeScale(
                            1.0 / selectionMaskWidth,
                            -1.0 / selectionMaskHeight,
                            1.0,
                        )
                    );
                const tileTransformResetInverse = tileTransformReset.clone().invert();

                material.uniforms.selectionMaskTransform.value = new Matrix4()
                    .multiply(tileTransformReset)
                    .multiply(
                        maskTransform
                    )
                    .multiply(tileTransformResetInverse)
                    .multiply(
                        new Matrix4().makeTranslation(new Vector3(
                            selectionMaskTileOffsetX,
                            1.0 - selectionMaskTileOffsetY - selectionMaskTileScaleY,
                            1.0,
                        ))
                    )
                    .multiply(
                        new Matrix4().makeScale(
                            selectionMaskTileScaleX,
                            selectionMaskTileScaleY,
                            1.0,
                        )
                    );

                await new Promise((resolve) => setTimeout(resolve, 0));

                renderer.setViewport(0, 0, tileWidth, tileHeight);

                // Render unmasked tile
                const beforeTile = await this.createTileRenderTarget(tileWidth, tileHeight, texture.type, texture.internalFormat, texture.colorSpace);
                renderer.setRenderTarget(beforeTile);
                material.uniforms.selectionMaskAlpha.value = 0;
                renderer.render(scene, camera);

                // Render masked tile
                const afterTile = await this.createTileRenderTarget(tileWidth, tileHeight, texture.type, texture.internalFormat, texture.colorSpace);
                renderer.setRenderTarget(afterTile);
                material.uniforms.selectionMaskAlpha.value = 1;
                material.needsUpdate = true;
                renderer.render(scene, camera);

                renderer.setRenderTarget(null);

                // Copy render result back to original texture in GPU
                renderer.copyTextureToTexture(
                    afterTile.texture,
                    texture,
                    new Box2(new Vector2(0, 0), new Vector2(tileWidth, tileHeight)),
                    new Vector2(tileX, texture.image.height - tileHeight - tileY),
                );

                // Read render result to CPU for permanent storage
                tileReadPromises.push(
                    this.readTile(
                        tileX,
                        tileY,
                        tileWidth,
                        tileHeight,
                        renderer,
                        beforeTile,
                        afterTile,
                        tileBitmaps,
                    )
                );
            }
        }

        await Promise.allSettled(tileReadPromises);

        for (const renderTarget of this.renderTargetStack) {
            renderTarget?.dispose();
        }
        this.renderTargetStack = new Array(16);

        geometry.dispose();
        material.dispose();
        
        renderer.setRenderTarget(null);
        renderer.setViewport(originalRendererViewport.x, originalRendererViewport.y, originalRendererViewport.z, originalRendererViewport.w);

        await new Promise((resolve) => setTimeout(resolve, 0));
        console.timeEnd('mask');

        return tileBitmaps;
    }

    async createTileRenderTarget(
        tileWidth: number,
        tileHeight: number,
        type: TextureDataType,
        internalFormat: PixelFormatGPU | null,
        colorSpace: string | undefined,
    ): Promise<WebGLRenderTarget> {
        let renderTarget: WebGLRenderTarget | undefined;
        if (this.renderTargetStack.length === 0) {
            renderTarget = await new Promise<WebGLRenderTarget>((resolve) => {
                this.renderTargetWaitQueue.push(resolve);
            });
        }
        if (!renderTarget) {
            renderTarget = this.renderTargetStack.pop();
            if (!renderTarget) {
                renderTarget = new WebGLRenderTarget(tileWidth, tileHeight, {
                    type,
                    minFilter: LinearFilter,
                    magFilter: LinearFilter,
                    wrapS: ClampToEdgeWrapping,
                    wrapT: ClampToEdgeWrapping,
                    format: RGBAFormat,
                    internalFormat,
                    depthBuffer: false,
                    colorSpace,
                    stencilBuffer: false,
                });
            }
        }
        if (renderTarget.width !== tileWidth || renderTarget.height !== tileHeight) {
            renderTarget.setSize(tileWidth, tileHeight);
        }
        return renderTarget;
    }

    reclaimRenderTarget(renderTarget: WebGLRenderTarget) {
        if (this.renderTargetWaitQueue.length > 0) {
            this.renderTargetWaitQueue.pop()!(renderTarget);
        } else {
            this.renderTargetStack.push(renderTarget);
        }
    }

    async readTile(
        tileX: number,
        tileY: number,
        tileWidth: number,
        tileHeight: number,
        renderer: WebGLRenderer,
        beforeTile: WebGLRenderTarget,
        afterTile: WebGLRenderTarget,
        tileBitmaps: RendererTextureTile[]
    ) {
        const beforeBuffer = new Uint8Array(tileWidth * tileHeight * 4);
        const afterBuffer = new Uint8Array(tileWidth * tileHeight * 4);
        await renderer.readRenderTargetPixelsAsync(beforeTile, 0, 0, tileWidth, tileHeight, beforeBuffer);
        await renderer.readRenderTargetPixelsAsync(afterTile, 0, 0, tileWidth, tileHeight, afterBuffer);
        tileBitmaps.push({
            x: tileX,
            y: tileY,
            width: tileWidth,
            height: tileHeight,
            oldImage: await createImageBitmap(
                new ImageData(new Uint8ClampedArray(beforeBuffer), tileWidth, tileHeight),
                { imageOrientation: 'flipY' }
            ),
            image: await createImageBitmap(
                new ImageData(new Uint8ClampedArray(afterBuffer), tileWidth, tileHeight),
                { imageOrientation: 'flipY' }
            ),
        });
        this.reclaimRenderTarget(beforeTile);
        this.reclaimRenderTarget(afterTile);
    }

    swapScene(scene: Scene) {
        this.scene.remove(this.selectionMaskMesh);
        scene.add(this.selectionMaskMesh);
        this.scene = scene;
    }

    dispose() {
        this.scene.remove(this.selectionMaskMesh);
        (this.selectionMaskMesh?.material as ShaderMaterial)?.dispose();
        this.selectionMaskMesh?.geometry?.dispose();
    }
}