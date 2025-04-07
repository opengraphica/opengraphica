import { CustomBlending, ZeroFactor, OneFactor } from 'three/src/constants';
import { BufferGeometry } from 'three/src/core/BufferGeometry';
import { BufferAttribute } from 'three/src/core/BufferAttribute';
import { MeshBasicMaterial } from 'three/src/materials/MeshBasicMaterial';
import { Mesh } from 'three/src/objects/Mesh';

import type { Scene } from 'three/src/scenes/Scene';

export class ImageBoundaryMask {
    imageBoundaryMaterial: MeshBasicMaterial | undefined;
    imageBoundaryMesh: Mesh | undefined;
    imageBoundaryGeometry: BufferGeometry | undefined;
    scene: Scene | undefined;

    async initialize(scene: Scene, imageWidth: number, imageHeight: number) {
        if (this.imageBoundaryMesh) {
            this.scene?.remove(this.imageBoundaryMesh);
            this.imageBoundaryMaterial?.dispose();
            this.imageBoundaryGeometry?.dispose();
        }
        this.scene = scene;

        this.imageBoundaryGeometry = new BufferGeometry();
        const marginSize = Math.max(imageWidth, imageHeight) * 10;
        const z = 0.5;
        const vertices = new Float32Array([
            -marginSize, -marginSize, z,
            0.0, imageHeight + marginSize, z,
            0.0, -marginSize, z,

            -marginSize, -marginSize, z,
            -marginSize, imageHeight + marginSize, z,
            0.0, imageHeight + marginSize, z,

            imageWidth, -marginSize, z,
            imageWidth + marginSize, imageHeight + marginSize, z,
            imageWidth + marginSize, -marginSize, z,

            imageWidth, -marginSize, z,
            imageWidth, imageHeight + marginSize, z,
            imageWidth + marginSize, imageHeight + marginSize, z,

            -marginSize, -marginSize, z,
            -marginSize, 0.0, z,
            imageWidth + marginSize, 0.0, z,

            -marginSize, -marginSize, z,
            imageWidth + marginSize, 0.0, z,
            imageWidth + marginSize, -marginSize, z,

            -marginSize, imageHeight, z,
            -marginSize, imageHeight + marginSize, z,
            imageWidth + marginSize, imageHeight + marginSize, z,

            -marginSize, imageHeight, z,
            imageWidth + marginSize, imageHeight + marginSize, z,
            imageWidth + marginSize, imageHeight, z,
        ]);
        this.imageBoundaryGeometry.setAttribute('position', new BufferAttribute(vertices, 3));

        this.imageBoundaryMaterial = new MeshBasicMaterial({
            color: 0x000000,
            alphaTest: -1,
            opacity: 0,
            transparent: true,
            depthTest: false,
            blending: CustomBlending,
            blendDst: ZeroFactor,
            blendSrc: OneFactor
        });

        this.imageBoundaryMesh = new Mesh(this.imageBoundaryGeometry, this.imageBoundaryMaterial);
        this.scene.add(this.imageBoundaryMesh);
        this.imageBoundaryMesh.renderOrder = 9999;

        // TODO
        // refreshLayerPasses();
    }

    enable(enabled: boolean) {
        if (!this.imageBoundaryMesh) return;
        this.imageBoundaryMesh.visible = enabled;
    }

    swapScene(scene: Scene) {
        if (!this.imageBoundaryMesh) return;
        this.scene?.remove(this.imageBoundaryMesh);
        scene.add(this.imageBoundaryMesh);
        this.scene = scene;
    }

    dispose() {
        this.scene?.remove(this.imageBoundaryMesh!);

        this.imageBoundaryMaterial?.dispose();
        this.imageBoundaryGeometry?.dispose();

        this.imageBoundaryMaterial = undefined;
        this.imageBoundaryMesh = undefined;
        this.imageBoundaryGeometry = undefined;
        this.scene = undefined;
    }
}
