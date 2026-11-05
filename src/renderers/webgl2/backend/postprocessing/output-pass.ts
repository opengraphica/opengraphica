import {
    LinearToneMapping,
    ReinhardToneMapping,
    CineonToneMapping,
    AgXToneMapping,
    ACESFilmicToneMapping,
    NeutralToneMapping,
    CustomToneMapping,
    SRGBTransfer,
} from 'three/src/constants';
import { ColorManagement } from 'three/src/math/ColorManagement';
import { RawShaderMaterial } from 'three/src/materials/RawShaderMaterial';
import { UniformsUtils } from 'three/src/renderers/shaders/UniformsUtils';
import { Matrix4 } from 'three/src/math/Matrix4';

import { Pass, FullScreenQuad } from './pass';
import { OutputShader } from './output-shader';
import type { ImageBackground } from '../image-background';
import type { ImageBoundaryMask } from '../image-boundary-mask';
import type { Camera } from 'three';

/**
 * This pass is responsible for including tone mapping and color space conversion
 * into your pass chain. In most cases, this pass should be included at the end
 * of each pass chain. If a pass requires sRGB input (e.g. like FXAA), the pass
 * must follow `OutputPass` in the pass chain.
 *
 * The tone mapping and color space settings are extracted from the renderer.
 *
 * ```js
 * const outputPass = new OutputPass();
 * composer.addPass( outputPass );
 * ```
 *
 * @augments Pass
 * @three_import import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
 */
class OutputPass extends Pass {

    isOutputPass!: boolean;
    defines!: any;
    uniforms!: any;
    material!: any;
    imageBackground: ImageBackground;
    imageBoundaryMask: ImageBoundaryMask;
    camera: Camera;
    _fsQuad!: any;
    _outputColorSpace!: any;
    _toneMapping!: any;

    /**
     * Constructs a new output pass.
     */
    constructor(imageBackground: ImageBackground, imageBoundaryMask: ImageBoundaryMask, camera: Camera) {

        super();

        this.imageBackground = imageBackground;
        this.imageBoundaryMask = imageBoundaryMask;
        this.camera = camera;

        /**
         * This flag indicates that this is an output pass.
         *
         * @type {boolean}
         * @readonly
         * @default true
         */
        this.isOutputPass = true;

        /**
         * The pass uniforms.
         *
         * @type {Object}
         */
        this.uniforms = UniformsUtils.clone( OutputShader.uniforms );

        /**
         * The pass material.
         *
         * @type {RawShaderMaterial}
         */
        this.material = new RawShaderMaterial( {
            name: OutputShader.name,
            uniforms: this.uniforms,
            vertexShader: OutputShader.vertexShader,
            fragmentShader: OutputShader.fragmentShader
        } );

        // internals

        this._fsQuad = new FullScreenQuad( this.material );

        this._outputColorSpace = null;
        this._toneMapping = null;

    }

    /**
     * Performs the output pass.
     *
     * @param {WebGLRenderer} renderer - The renderer.
     * @param {WebGLRenderTarget} writeBuffer - The write buffer. This buffer is intended as the rendering
     * destination for the pass.
     * @param {WebGLRenderTarget} readBuffer - The read buffer. The pass can access the result from the
     * previous pass from this buffer.
     * @param {number} deltaTime - The delta time in seconds.
     * @param {boolean} maskActive - Whether masking is active or not.
     */
    render( renderer, writeBuffer, readBuffer/*, deltaTime, maskActive */ ) {
        const viewProjection = new Matrix4().multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);

        this.uniforms[ 'tDiffuse' ].value = readBuffer.texture;
        this.uniforms[ 'toneMappingExposure' ].value = renderer.toneMappingExposure;
        this.uniforms[ 'backgroundColor' ].value = this.imageBackground.backgroundMaterial.uniforms.color.value;
        this.uniforms[ 'transparencyGridMap' ].value = this.imageBackground.backgroundMaterial.uniforms.transparencyGridMap.value;
        this.uniforms[ 'backgroundTileSizeOpacityDimensions' ].value.y = this.imageBackground.backgroundMaterial.uniforms.opacity.value;
        this.uniforms[ 'backgroundTileSizeOpacityDimensions' ].value.z = this.imageBackground.backgroundGeometry.parameters.width;
        this.uniforms[ 'backgroundTileSizeOpacityDimensions' ].value.w = this.imageBackground.backgroundGeometry.parameters.height;
        this.uniforms[ 'imageDimensions' ].value.x = readBuffer.texture.width;
        this.uniforms[ 'imageDimensions' ].value.y = readBuffer.texture.height;
        this.uniforms[ 'backgroundInverseViewProjection' ].value.copy(viewProjection).invert();
        this.uniforms[ 'backgroundWorldToLocal' ].value.copy(this.imageBackground.backgroundMesh.matrixWorld).invert();

        const cTransparencyEnabled = this.imageBackground.backgroundMaterial.defines.cTransparencyEnabled;
        const cImageBoundaryEnabled = this.imageBoundaryMask.imageBoundaryMesh?.visible ? 1 : 0;

        // rebuild defines if required

        if (
            this._outputColorSpace !== renderer.outputColorSpace
            || this._toneMapping !== renderer.toneMapping
            || cTransparencyEnabled !== this.material.defines.cTransparencyEnabled
            || cImageBoundaryEnabled !== this.material.defines.cImageBoundaryEnabled
        ) {

            this._outputColorSpace = renderer.outputColorSpace;
            this._toneMapping = renderer.toneMapping;

            this.material.defines = {};

            if ( ColorManagement.getTransfer( this._outputColorSpace ) === SRGBTransfer ) this.material.defines.SRGB_TRANSFER = '';

            this.material.defines.cTransparencyEnabled = cTransparencyEnabled;
            this.material.defines.cImageBoundaryEnabled = cImageBoundaryEnabled;
            if ( this._toneMapping === LinearToneMapping ) this.material.defines.LINEAR_TONE_MAPPING = '';
            else if ( this._toneMapping === ReinhardToneMapping ) this.material.defines.REINHARD_TONE_MAPPING = '';
            else if ( this._toneMapping === CineonToneMapping ) this.material.defines.CINEON_TONE_MAPPING = '';
            else if ( this._toneMapping === ACESFilmicToneMapping ) this.material.defines.ACES_FILMIC_TONE_MAPPING = '';
            else if ( this._toneMapping === AgXToneMapping ) this.material.defines.AGX_TONE_MAPPING = '';
            else if ( this._toneMapping === NeutralToneMapping ) this.material.defines.NEUTRAL_TONE_MAPPING = '';
            else if ( this._toneMapping === CustomToneMapping ) this.material.defines.CUSTOM_TONE_MAPPING = '';

            this.material.needsUpdate = true;

        }

        if ( this.renderToScreen === true ) {

            renderer.setRenderTarget( null );
            this._fsQuad.render( renderer );

        } else {

            renderer.setRenderTarget( writeBuffer );
            if ( this.clear ) renderer.clear( renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil );
            this._fsQuad.render( renderer );

        }

    }

    /**
     * Frees the GPU-related resources allocated by this instance. Call this
     * method whenever the pass is no longer used in your app.
     */
    dispose() {

        this.material.dispose();
        this._fsQuad.dispose();

    }

}

export { OutputPass };
