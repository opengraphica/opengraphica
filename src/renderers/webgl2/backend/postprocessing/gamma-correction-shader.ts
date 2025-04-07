/**
 * Gamma Correction Shader
 * http://en.wikipedia.org/wiki/gamma_correction
 */

export const GammaCorrectionShader = {

    uniforms: {
        'tDiffuse': { value: null }
    },

    vertexShader: /* glsl */`

        varying vec2 vUv;

        void main() {

            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

        }`,

    fragmentShader: /* glsl */`

        uniform sampler2D tDiffuse;

        varying vec2 vUv;

        float linearSrgbChannelToSrgbChannel(float value) {
            float calculatedValue = 0.0;
            calculatedValue += step(value, 0.0031308) * value * 12.92;
            calculatedValue += step(0.0031308, value) * (pow(value, 1.0 / 2.4) * 1.055 - 0.055);
            return clamp(calculatedValue, 0.0, 1.0);
        }

        void main() {
            gl_FragColor = texture2D(tDiffuse, vUv);
            gl_FragColor = vec4(gl_FragColor.r / gl_FragColor.a, gl_FragColor.g / gl_FragColor.a, gl_FragColor.b / gl_FragColor.a, gl_FragColor.a);
            #include <colorspace_fragment>
        }`

};
