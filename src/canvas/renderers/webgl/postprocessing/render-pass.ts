import { Color } from 'three/src/math/Color';
import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import { CopyShader } from '../shaders/copy-shader';
import { Pass, FullScreenQuad } from './pass';
import appEmitter from '@/lib/emitter';

import type { Camera, Material, Scene, WebGLRenderer, WebGLRenderTarget } from 'three';

class RenderPass extends Pass {

    private _oldClearColor!: Color;
    private _previousPassMaterial!: ShaderMaterial;
    private _previousPassQuad!: FullScreenQuad;

    public scene!: Scene;
    public camera!: Camera;
    public overrideMaterial?: Material;
    public clearColor?: Color;
    public clearAlpha?: number;
    public clearDepth: boolean;
    public isFirstPass: boolean = false;

    constructor(scene: Scene, camera: Camera, overrideMaterial?: Material, clearColor?: Color, clearAlpha?: number) {

        super();

        this.scene = scene;
        this.camera = camera;

        this.overrideMaterial = overrideMaterial;

        this.clearColor = clearColor;
        this.clearAlpha = (clearAlpha !== undefined) ? clearAlpha : 0;

        this.clear = true;
        this.clearDepth = false;
        this.needsSwap = true;

        this._oldClearColor = new Color();
        this._previousPassMaterial = new ShaderMaterial({
            uniforms: CopyShader.uniforms,
            vertexShader: CopyShader.vertexShader,
            fragmentShader: CopyShader.fragmentShader
        });
        this._previousPassQuad = new FullScreenQuad(this._previousPassMaterial);
    }

    render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget, deltaTime?: number, maskActive?: boolean) {

        const oldAutoClear = renderer.autoClear;
        renderer.autoClear = false;

        let oldClearAlpha, oldOverrideMaterial;

        if (this.overrideMaterial !== undefined) {
            oldOverrideMaterial = this.scene.overrideMaterial;
            this.scene.overrideMaterial = this.overrideMaterial;
        }

        if (this.clearColor) {
            renderer.getClearColor(this._oldClearColor);
            oldClearAlpha = renderer.getClearAlpha();

            renderer.setClearColor(this.clearColor, this.clearAlpha);
        }

        if (this.clearDepth) {
            renderer.clearDepth();
        }

        renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);

        // TODO: Avoid using autoClear properties, see https://github.com/mrdoob/three.js/pull/15571#issuecomment-465669600
        if (this.clear) {
            renderer.clear(renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil);
        }

        if (!this.isFirstPass) {
            appEmitter.emit('renderer.pass.readBufferTextureUpdate', readBuffer.texture);
            this._previousPassMaterial.uniforms.tDiffuse.value = readBuffer.texture;
            this._previousPassMaterial.needsUpdate = true;
            this._previousPassQuad.render(renderer);
        }
        
        renderer.render(this.scene, this.camera);

        if (this.clearColor) {
            renderer.setClearColor(this._oldClearColor, oldClearAlpha);
        }

        if (this.overrideMaterial !== undefined) {
            this.scene.overrideMaterial = oldOverrideMaterial ?? null;
        }

        renderer.autoClear = oldAutoClear;
    }

    dispose() {
        this._previousPassMaterial?.dispose();
        this._previousPassQuad?.dispose();
    }

}

export { RenderPass };
