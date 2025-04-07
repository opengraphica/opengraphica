import { DoubleSide, SRGBColorSpace, RepeatWrapping } from 'three/src/constants';
import { Mesh } from 'three/src/objects/Mesh';
import { PlaneGeometry } from 'three/src/geometries/PlaneGeometry';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import { Texture } from 'three/src/textures/Texture';
import { TextureLoader } from 'three/src/loaders/TextureLoader';

import selectionMaskVertexShader from './shader/selection-mask.vert';
import selectionMaskFragmentShader from './shader/selection-mask.frag';

import type { Camera } from 'three/src/cameras/Camera';
import type { Scene } from 'three/src/scenes/Scene';

const selectionMaskPatternSrc = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAABg2lDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV/TiiIVh3YQcchQnVoQFXHUKhShQqgVWnUwufQLmjQkKS6OgmvBwY/FqoOLs64OroIg+AHi6OSk6CIl/i8ptIjx4Lgf7+497t4BQrPKNCs0Dmi6bWZSSTGXXxV7XyEgghDiCMjMMuYkKQ3f8XWPAF/vEjzL/9yfY0AtWAwIiMSzzDBt4g3i6U3b4LxPHGVlWSU+J46bdEHiR64rHr9xLrks8Myomc3ME0eJxVIXK13MyqZGPEUcUzWd8oWcxyrnLc5atc7a9+QvDBf0lWWu0xxBCotYggQRCuqooAobCVp1UixkaD/p4x92/RK5FHJVwMixgBo0yK4f/A9+d2sVJye8pHAS6HlxnI9RoHcXaDUc5/vYcVonQPAZuNI7/loTmPkkvdHRYkfA4DZwcd3RlD3gcgcYejJkU3alIE2hWATez+ib8kDkFuhf83pr7+P0AchSV+kb4OAQGCtR9rrPu/u6e/v3TLu/Hx5FcoXj45C+AAAABmJLR0QATgBOAE714JEKAAAACXBIWXMAAC4jAAAuIwF4pT92AAAAB3RJTUUH5gITBDkEOkUYUQAAABl0RVh0Q29tbWVudABDcmVhdGVkIHdpdGggR0lNUFeBDhcAAAAtSURBVAjXY/z//383AxT4+/szMCFzNm7cCBGAcRgYGBiYz58/7wbjMDAwMAAAGKUPRK2REh8AAAAASUVORK5CYII=';

export class SelectionMask {
    scene!: Scene;
    selectionMaskMesh!: Mesh;

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
        const selectionMaskMaterial = new ShaderMaterial({
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
        this.selectionMaskMesh = new Mesh(selectionMaskGeometry, selectionMaskMaterial);
        this.selectionMaskMesh.renderOrder = 9999999999999;
        this.selectionMaskMesh.position.z = 0.2;
        this.selectionMaskMesh.frustumCulled = false;
        this.selectionMaskMesh.visible = false;
        this.scene.add(this.selectionMaskMesh);
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