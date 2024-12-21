import { ShaderMaterial } from 'three/src/materials/ShaderMaterial';
import { UniformsUtils } from 'three/src/renderers/shaders/UniformsUtils';
import { Pass, FullScreenQuad } from './pass';

import type { WebGLRenderer, WebGLRenderTarget } from 'three';

type Shader = {
    uniforms?: ShaderMaterial['uniforms'];
    vertexShader?: string;
    fragmentShader?: string;
}

class ShaderPass extends Pass {

    public textureID: string;
    public uniforms!: ShaderMaterial['uniforms'];
    public material!: ShaderMaterial;
    public fsQuad!: FullScreenQuad;

    constructor(shader: Shader, textureID?: string) {
        super();

        this.textureID = (textureID !== undefined) ? textureID : 'tDiffuse';

        if (shader instanceof ShaderMaterial) {
            this.uniforms = shader.uniforms;
            this.material = shader;
        } else if (shader) {
            this.uniforms = shader.uniforms ? UniformsUtils.clone(shader.uniforms!) : {};

            this.material = new ShaderMaterial({
                defines: Object.assign({}, (shader as ShaderMaterial).defines),
                uniforms: this.uniforms,
                vertexShader: shader.vertexShader,
                fragmentShader: shader.fragmentShader
            });
        }

        this.fsQuad = new FullScreenQuad(this.material);
    }

    // ts-ignore-next
    render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget, deltaTime?: number, maskActive?: boolean ) {
        if (this.uniforms[this.textureID]) {
            this.uniforms[this.textureID].value = readBuffer.texture;
        }

        this.fsQuad.material = this.material;

        if (this.renderToScreen) {
            renderer.setRenderTarget(null);
            this.fsQuad.render(renderer);
        } else {
            renderer.setRenderTarget(writeBuffer);
            // TODO: Avoid using autoClear properties, see https://github.com/mrdoob/three.js/pull/15571#issuecomment-465669600
            if (this.clear) renderer.clear(renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil);
            this.fsQuad.render(renderer);
        }
    }

    dispose() {
        this.material.dispose();
        this.fsQuad.dispose();
    }
}

export { ShaderPass };
