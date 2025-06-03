import { Color } from 'three/src/math/Color';
import { DoubleSide } from 'three/src/constants';
import { Mesh } from 'three/src/objects/Mesh';
import { MeshBasicMaterial } from 'three/src/materials/MeshBasicMaterial';
import { PlaneGeometry } from 'three/src/geometries/PlaneGeometry';
import { Scene } from 'three/src/scenes/Scene';

export class ImageBackground {
    backgroundGeometry!: PlaneGeometry;
    backgroundMaterial!: MeshBasicMaterial;
    backgroundMesh!: Mesh;
    scene!: Scene;

    async initialize(scene: Scene, imageWidth: number, imageHeight: number) {
        this.backgroundGeometry = new PlaneGeometry(imageWidth, imageHeight);
        this.backgroundMaterial = new MeshBasicMaterial({ color: 0xffffff, transparent: true, side: DoubleSide });
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
        this.backgroundMaterial?.dispose();
        this.backgroundMaterial = new MeshBasicMaterial({
            color,
            opacity: alpha,
            transparent: true,
            side: DoubleSide
        });
        this.backgroundMesh.material = this.backgroundMaterial;
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
