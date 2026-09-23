import { RepeatWrapping, RGBAFormat, UnsignedByteType, NearestFilter } from 'three/src/constants';
import { Color } from 'three/src/math/Color';
import { DataTexture } from 'three/src/textures/DataTexture';
import { BackSide } from 'three/src/constants';
import { Mesh } from 'three/src/objects/Mesh';
import { PlaneGeometry } from 'three/src/geometries/PlaneGeometry';
import { Scene } from 'three/src/scenes/Scene';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import { Vector4 } from 'three/src/math/Vector4';

import imageBackgroundVertexShader from './shader/image-background.vert';
import imageBackgroundFragmentShader from './shader/image-background.frag';

import type { Texture } from 'three';

export class ImageBackground {
    backgroundGeometry!: PlaneGeometry;
    backgroundMaterial!: ShaderMaterial;
    backgroundMesh!: Mesh;
    scene!: Scene;
    transparencyGridTexture!: Texture;

    constructor() {
        this.transparencyGridTexture = createTransparencyGridTexture();
    }

    async initialize(scene: Scene, imageWidth: number, imageHeight: number) {
        this.backgroundGeometry = new PlaneGeometry(imageWidth, imageHeight);

        this.backgroundMaterial = new ShaderMaterial({
            defines: {
                cTransparencyEnabled: 0,
            },
            uniforms: {
                color: { value: new Vector4(1, 1, 1, 1) },
                transparencyGridMap: { value: this.transparencyGridTexture },
                transparencyTileSize: { value: 16 },
                opacity: { value: 1 },
            },
            vertexShader: imageBackgroundVertexShader,
            fragmentShader: imageBackgroundFragmentShader,
            depthTest: false,
            depthWrite: false,
            transparent: true,
            side: BackSide,
            premultipliedAlpha: true,
        });

        this.backgroundMesh = new Mesh(this.backgroundGeometry, this.backgroundMaterial);
        this.backgroundMesh.position.x = imageWidth / 2;
        this.backgroundMesh.position.y = imageHeight / 2;
        this.backgroundMesh.renderOrder = -1;
        this.scene = scene;
        this.scene.add(this.backgroundMesh);
    }

    resize(imageWidth: number, imageHeight: number) {
        this.backgroundGeometry?.dispose();
        this.backgroundGeometry = new PlaneGeometry(imageWidth, imageHeight);
        this.backgroundMesh.position.x = imageWidth / 2;
        this.backgroundMesh.position.y = imageHeight / 2;
        this.backgroundMesh.geometry = this.backgroundGeometry;
    }

    setColor(r: number, g: number, b: number, alpha: number) {
        const color = new Color().setRGB(r, g, b);
        color.convertSRGBToLinear();
        this.backgroundMaterial.defines.cTransparencyEnabled = alpha < 1 ? 1 : 0;
        this.backgroundMaterial.uniforms.color.value = new Vector4(color.r, color.g, color.b, alpha);
        this.backgroundMaterial.needsUpdate = true;
    }

    disableTransparencyGrid() {
        if (!this.backgroundMaterial) return;
        this.backgroundMaterial.defines.cTransparencyEnabled = 0;
        this.backgroundMaterial.uniformsNeedUpdate = true;
        this.backgroundMaterial.needsUpdate = true;
    }

    enableTransparencyGrid() {
        if (!this.backgroundMaterial) return;
        this.backgroundMaterial.defines.cTransparencyEnabled = this.backgroundMaterial.uniforms.color.value.w < 1 ? 1 : 0;
        this.backgroundMaterial.uniformsNeedUpdate = true;
        this.backgroundMaterial.needsUpdate = true;
    }

    hide() {
        if (!this.backgroundMaterial) return;
        this.backgroundMaterial.uniforms.opacity.value = 0;
        this.backgroundMaterial.uniformsNeedUpdate = true;
    }

    show() {
        if (!this.backgroundMaterial) return;
        this.backgroundMaterial.uniforms.opacity.value = 1;
        this.backgroundMaterial.uniformsNeedUpdate = true;
    }

    getAlpha(): number {
        return this.backgroundMaterial.uniforms.color.value.w ?? 1;
    }

    swapScene(scene: Scene) {
        this.scene.remove(this.backgroundMesh);
        scene.add(this.backgroundMesh);
        this.scene = scene;
    }

    dispose() {
        this.scene.remove(this.backgroundMesh);

        this.backgroundGeometry?.dispose();
        this.backgroundMaterial?.dispose();
        
        (this.backgroundGeometry as any) = undefined;
        (this.backgroundMaterial as any) = undefined;
        (this.backgroundMesh as any) = undefined;
        (this.scene as any) = undefined;
    }
}

export function createTransparencyGridTexture(
    cellSize: number = 16,
    repeatsX: number = 8,
    repeatsY: number = 8,
    colorA: number = 0xffffff,
    colorB: number = 0xe0e0e0,
) {
    const width = cellSize * 2;
    const height = cellSize * 2;
    const data = new Uint8Array(width * height * 4);

    const a = new Color(colorA);
    const b = new Color(colorB);

    const rgbaA = [
        Math.round(a.r * 255),
        Math.round(a.g * 255),
        Math.round(a.b * 255),
        255,
    ];

    const rgbaB = [
        Math.round(b.r * 255),
        Math.round(b.g * 255),
        Math.round(b.b * 255),
        255,
    ];

    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            const cellX = Math.floor(x / cellSize);
            const cellY = Math.floor(y / cellSize);
            const color = (cellX + cellY) % 2 === 0 ? rgbaA : rgbaB;

            const offset = (y * width + x) * 4;

            data[offset + 0] = color[0];
            data[offset + 1] = color[1];
            data[offset + 2] = color[2];
            data[offset + 3] = color[3];
        }
    }

    const texture = new DataTexture(
        data,
        width,
        height,
        RGBAFormat,
        UnsignedByteType
    );

    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;

    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;

    texture.repeat.set(repeatsX, repeatsY);
    texture.needsUpdate = true;

    return texture;
}