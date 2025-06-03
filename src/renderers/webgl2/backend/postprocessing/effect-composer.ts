import { Clock } from 'three/src/core/Clock';
import { Vector2 } from 'three/src/math/Vector2';
import { WebGLRenderTarget } from 'three/src/renderers/WebGLRenderTarget';
import { CopyShader } from './copy-shader';
import { ShaderPass } from './shader-pass';
import { MaskPass, ClearMaskPass } from './mask-pass';
import { UnsignedByteType, HalfFloatType, RGBAFormat } from 'three/src/constants';

import type { Pass } from './pass';
import type { WebGLRenderer } from 'three';

class EffectComposer {
    private _pixelRatio: number;
    private _width: number;
    private _height: number;
    private _contextRestoredCallback: (() => void) | undefined;

    public renderer: WebGLRenderer;
    public renderTarget1: WebGLRenderTarget;
    public renderTarget2: WebGLRenderTarget;
    public writeBuffer: WebGLRenderTarget;
    public readBuffer: WebGLRenderTarget;
    public renderToScreen: boolean;
    public clock: Clock;
    public passes: Pass[];
    public copyPass: ShaderPass;

    constructor(renderer: WebGLRenderer, renderTarget?: WebGLRenderTarget) {

        this.renderer = renderer;

        if (renderTarget === undefined) {

            const size = renderer.getSize(new Vector2());
            this._pixelRatio = renderer.getPixelRatio();
            this._width = size.width;
            this._height = size.height;

            const gl = renderer.getContext();

            const isHalfFloat = renderer.capabilities.isWebGL2 || gl.getExtension('OES_texture_half_float');

            this._contextRestoredCallback = () => {
                renderer.capabilities.isWebGL2 || gl.getExtension('OES_texture_half_float');
            };
            gl.canvas.addEventListener("webglcontextrestored", this._contextRestoredCallback, false);

            renderTarget = new WebGLRenderTarget(this._width * this._pixelRatio, this._height * this._pixelRatio, {
                format: RGBAFormat,
                type: isHalfFloat ? HalfFloatType : UnsignedByteType,
                depthBuffer: false,
                stencilBuffer: false,
            });
            renderTarget.texture.name = 'EffectComposer.rt1';

        } else {

            this._pixelRatio = 1;
            this._width = renderTarget.width;
            this._height = renderTarget.height;

        }

        this.renderTarget1 = renderTarget;
        this.renderTarget2 = renderTarget.clone();
        this.renderTarget2.texture.name = 'EffectComposer.rt2';

        this.writeBuffer = this.renderTarget1;
        this.readBuffer = this.renderTarget2;

        this.renderToScreen = true;

        this.passes = [];

        this.copyPass = new ShaderPass(CopyShader);

        this.clock = new Clock();

    }

    swapBuffers() {
        const tmp = this.readBuffer;
        this.readBuffer = this.writeBuffer;
        this.writeBuffer = tmp;
    }

    addPass(pass: Pass) {
        this.passes.push(pass);
        pass.setSize(this._width * this._pixelRatio, this._height * this._pixelRatio);
    }

    insertPass(pass: Pass, index: number) {
        this.passes.splice(index, 0, pass);
        pass.setSize(this._width * this._pixelRatio, this._height * this._pixelRatio);
    }

    removePass(pass: Pass) {
        const index = this.passes.indexOf(pass);
        if (index !== - 1) {
            this.passes.splice(index, 1);
        }
    }

    disposeAllPasses() {
        for (const pass of this.passes) {
            pass.dispose();
        }
        this.passes = [];
    }

    isLastEnabledPass(passIndex: number) {
        for (let i = passIndex + 1; i < this.passes.length; i ++) {
            if (this.passes[i].enabled) {
                return false;
            }
        }
        return true;
    }

    render(deltaTime?: number) {
        // deltaTime value is in seconds
        if (deltaTime === undefined) {
            deltaTime = this.clock.getDelta();
        }

        const currentRenderTarget = this.renderer.getRenderTarget();

        let maskActive = false;

        for (let i = 0, il = this.passes.length; i < il; i ++) {
            const pass = this.passes[i];

            if (pass.enabled === false) continue;

            pass.renderToScreen = (this.renderToScreen && this.isLastEnabledPass(i));
            pass.render(this.renderer, this.writeBuffer, this.readBuffer, deltaTime, maskActive);

            if (pass.needsSwap) {
                if (maskActive) {
                    const context = this.renderer.getContext();
                    const stencil = this.renderer.state.buffers.stencil;

                    //context.stencilFunc( context.NOTEQUAL, 1, 0xffffffff );
                    stencil.setFunc(context.NOTEQUAL, 1, 0xffffffff);

                    this.copyPass.render(this.renderer, this.writeBuffer, this.readBuffer, deltaTime);

                    //context.stencilFunc( context.EQUAL, 1, 0xffffffff );
                    stencil.setFunc(context.EQUAL, 1, 0xffffffff);
                }

                this.swapBuffers();
            }

            if (MaskPass !== undefined) {
                if (pass instanceof MaskPass) {
                    maskActive = true;
                } else if (pass instanceof ClearMaskPass) {
                    maskActive = false;
                }
            }

        }

        this.renderer.setRenderTarget(currentRenderTarget);
    }

    reset(renderTarget?: WebGLRenderTarget) {
        if (renderTarget === undefined) {
            const size = this.renderer.getSize(new Vector2());
            this._pixelRatio = this.renderer.getPixelRatio();
            this._width = size.width;
            this._height = size.height;

            renderTarget = this.renderTarget1.clone();
            renderTarget.setSize(this._width * this._pixelRatio, this._height * this._pixelRatio);
        }

        this.renderTarget1.dispose();
        this.renderTarget2.dispose();
        this.renderTarget1 = renderTarget;
        this.renderTarget2 = renderTarget.clone();

        this.writeBuffer = this.renderTarget1;
        this.readBuffer = this.renderTarget2;
    }

    detach(renderTarget: WebGLRenderTarget) {
        if (this.renderTarget1 === renderTarget) {
            this.renderTarget1 = this.renderTarget2;
        } else if (this.renderTarget2 === renderTarget) {
            this.renderTarget2 = this.renderTarget1;
        } 
    }

    setSize(width: number, height: number) {
        this._width = width;
        this._height = height;

        const effectiveWidth = this._width * this._pixelRatio;
        const effectiveHeight = this._height * this._pixelRatio;

        this.renderTarget1.setSize(effectiveWidth, effectiveHeight);
        this.renderTarget2.setSize(effectiveWidth, effectiveHeight);

        for (let i = 0; i < this.passes.length; i ++) {
            this.passes[i].setSize(effectiveWidth, effectiveHeight);
        }
    }

    setPixelRatio(pixelRatio: number) {
        this._pixelRatio = pixelRatio;
        this.setSize(this._width, this._height);
    }

    dispose() {
        if (this._contextRestoredCallback) {
            const gl = this.renderer.getContext();
            gl.canvas.removeEventListener("webglcontextrestored", this._contextRestoredCallback, false);
            this._contextRestoredCallback = undefined;
        }
        this.renderTarget1.dispose();
        this.renderTarget2.dispose();
        this.copyPass.dispose();
    }
}

export { EffectComposer };
