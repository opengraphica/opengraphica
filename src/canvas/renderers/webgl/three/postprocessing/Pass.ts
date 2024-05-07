import { BufferGeometry } from 'three/src/core/BufferGeometry';
import { Float32BufferAttribute } from 'three/src/core/BufferAttribute';
import { OrthographicCamera } from 'three/src/cameras/OrthographicCamera';
import { Mesh } from 'three/src/objects/Mesh';

import type { Material, Renderer } from 'three';

class Pass {

    public enabled: boolean;
    public needsSwap: boolean;
    public clear: boolean;
    public renderToScreen: boolean;

	constructor() {

		// if set to true, the pass is processed by the composer
		this.enabled = true;

		// if set to true, the pass indicates to swap read and write buffer after rendering
		this.needsSwap = true;

		// if set to true, the pass clears its buffer before rendering
		this.clear = false;

		// if set to true, the result of the pass is rendered to screen. This is set automatically by EffectComposer.
		this.renderToScreen = false;

	}

	setSize(width: number, height: number) {}

	render(renderer: any, writeBuffer?: any, readBuffer?: any, deltaTime?: any, maskActive?: any) {
		console.error('[src/canvas/renderers/webgl/three/postprocessing/Pass.ts] .render() must be implemented in derived pass.');
	}

	dispose() {}

}

// Helper for passes that need to fill the viewport with a single quad.

const _camera = new OrthographicCamera(- 1, 1, 1, - 1, 0, 1);

// https://github.com/mrdoob/three.js/pull/21358

const _geometry = new BufferGeometry();
_geometry.setAttribute('position', new Float32BufferAttribute([- 1, 3, 0, - 1, - 1, 0, 3, - 1, 0], 3));
_geometry.setAttribute('uv', new Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));

class FullScreenQuad {

    private _mesh: Mesh;

	constructor(material: Material) {
		this._mesh = new Mesh(_geometry, material);
	}

	dispose() {
		this._mesh.geometry.dispose();
	}

	render(renderer: Renderer) {
		renderer.render(this._mesh, _camera);
	}

	get material() {
		return this._mesh.material;
	}

	set material(value) {
		this._mesh.material = value;
	}

}

export { Pass, FullScreenQuad };
