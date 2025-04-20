import {
    ClampToEdgeWrapping, DoubleSide, HalfFloatType, LinearFilter, LinearSRGBColorSpace, NearestFilter,
    SRGBColorSpace, RepeatWrapping, RGBAFormat, UnsignedByteType,
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

import type { Camera, WebGLRenderer } from 'three';
import type { RendererTextureTile } from '@/types';

const selectionMaskPatternSrc = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAABg2lDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV/TiiIVh3YQcchQnVoQFXHUKhShQqgVWnUwufQLmjQkKS6OgmvBwY/FqoOLs64OroIg+AHi6OSk6CIl/i8ptIjx4Lgf7+497t4BQrPKNCs0Dmi6bWZSSTGXXxV7XyEgghDiCMjMMuYkKQ3f8XWPAF/vEjzL/9yfY0AtWAwIiMSzzDBt4g3i6U3b4LxPHGVlWSU+J46bdEHiR64rHr9xLrks8Myomc3ME0eJxVIXK13MyqZGPEUcUzWd8oWcxyrnLc5atc7a9+QvDBf0lWWu0xxBCotYggQRCuqooAobCVp1UixkaD/p4x92/RK5FHJVwMixgBo0yK4f/A9+d2sVJye8pHAS6HlxnI9RoHcXaDUc5/vYcVonQPAZuNI7/loTmPkkvdHRYkfA4DZwcd3RlD3gcgcYejJkU3alIE2hWATez+ib8kDkFuhf83pr7+P0AchSV+kb4OAQGCtR9rrPu/u6e/v3TLu/Hx5FcoXj45C+AAAABmJLR0QATgBOAE714JEKAAAACXBIWXMAAC4jAAAuIwF4pT92AAAAB3RJTUUH5gITBDkEOkUYUQAAABl0RVh0Q29tbWVudABDcmVhdGVkIHdpdGggR0lNUFeBDhcAAAAtSURBVAjXY/z//383AxT4+/szMCFzNm7cCBGAcRgYGBiYz58/7wbjMDAwMAAAGKUPRK2REh8AAAAASUVORK5CYII=';

export class SelectionMask {
    scene!: Scene;
    selectionMaskMesh!: Mesh;
    selectionMaskMaterial!: ShaderMaterial;

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

    setImage(image?: ImageBitmap, offset?: { x: number, y: number }) {
        this.selectionMaskMaterial.uniforms.selectedMaskMap.value?.dispose();
        this.selectionMaskMaterial.uniforms.selectedMaskMap.value?.image?.close?.();
        if (image) {
            const selectionMaskTexture = new Texture(image);
            selectionMaskTexture.magFilter = NearestFilter;
            selectionMaskTexture.minFilter = LinearFilter;
            selectionMaskTexture.wrapS = ClampToEdgeWrapping;
            selectionMaskTexture.wrapT = ClampToEdgeWrapping;
            selectionMaskTexture.colorSpace = SRGBColorSpace;
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

    async applyToTextureAlphaChannel(
        texture: Texture,
        maskTransform: Matrix4,
        tileSize: number,
        renderer: WebGLRenderer,
        invert: boolean = false,
    ): Promise<RendererTextureTile[]> {
        const originalRendererSize = new Vector2();
        renderer.getSize(originalRendererSize);
        const originalRendererViewport = new Vector4();
        renderer.getViewport(originalRendererViewport);
        
        const gl = renderer.getContext();
        const isHalfFloat = renderer.capabilities.isWebGL2 || gl.getExtension('OES_texture_half_float');

        const tileRenderTarget = new WebGLRenderTarget(tileSize, tileSize, {
            type: isHalfFloat ? HalfFloatType : UnsignedByteType,
            minFilter: LinearFilter,
            magFilter: LinearFilter,
            format: RGBAFormat,
            depthBuffer: false,
            colorSpace: LinearSRGBColorSpace,
            stencilBuffer: false,
        });

        const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const scene = new Scene();
        const geometry = new PlaneGeometry(2, 2);

        const selectionMaskMap = this.selectionMaskMaterial.uniforms.selectedMaskMap.value;
        const selectionMaskOffset = this.selectionMaskMaterial.uniforms.selectedMaskOffset.value;

        const material = new ShaderMaterial({
            defines: {
                cInvert: invert ? 1 : 0,
            },
            uniforms: {
                baseMap: { value: texture },
                selectionMaskMap: { value: selectionMaskMap },
                tileOffsetAndSize: { value: new Vector4() },
                selectionMaskTransform: { value: new Matrix4() },
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

        loop:
        for (let tileX = 0; tileX < texture.image.width; tileX += tileSize) {
            const tileWidth = Math.min(tileSize, texture.image.width - tileX);
            for (let tileY = 0; tileY < texture.image.height; tileY += tileSize) {

                const tileHeight = Math.min(tileSize, texture.image.height - tileY);
                material.uniforms.tileOffsetAndSize.value.x = tileX / texture.image.width;
                material.uniforms.tileOffsetAndSize.value.y = tileY / texture.image.height;
                material.uniforms.tileOffsetAndSize.value.z = tileWidth / texture.image.width;
                material.uniforms.tileOffsetAndSize.value.w = tileHeight / texture.image.height;

                const selectionMaskTileOffsetX = (tileX - selectionMaskOffset[0]) / selectionMaskMap.image.width;
                const selectionMaskTileOffsetY = (tileY - selectionMaskOffset[1]) / selectionMaskMap.image.height;
                const selectionMaskTileScaleX = (tileWidth / selectionMaskMap.image.width);
                const selectionMaskTileScaleY = (tileHeight / selectionMaskMap.image.height);

                const tileTransformReset = new Matrix4()
                    .multiply(
                        new Matrix4().makeTranslation(new Vector3(
                            -selectionMaskOffset[0] / selectionMaskMap.image.width,
                            1.0 + (selectionMaskOffset[1] / selectionMaskMap.image.height),
                            0.0
                        ))
                    )
                    .multiply(
                        new Matrix4().makeScale(
                            1.0 / selectionMaskMap.image.width,
                            -1.0 / selectionMaskMap.image.height,
                            1.0,
                        )
                    )
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

                renderer.setRenderTarget(tileRenderTarget);
                renderer.setSize(tileWidth, tileHeight);
                renderer.setViewport(0, 0, tileWidth, tileHeight);
                renderer.render(scene, camera);
                renderer.setRenderTarget(null);

                renderer.copyTextureToTexture(
                    tileRenderTarget.texture,
                    texture,
                    new Box2(new Vector2(0, 0), new Vector2(tileWidth, tileHeight)),
                    new Vector2(tileX, texture.image.height - tileHeight - tileY),
                );

            }
        }

        geometry.dispose();
        material.dispose();
        tileRenderTarget.dispose();
        renderer.setSize(originalRendererSize.x, originalRendererSize.y);
        renderer.setViewport(originalRendererViewport.x, originalRendererViewport.y, originalRendererViewport.z, originalRendererViewport.w);

        return [];
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