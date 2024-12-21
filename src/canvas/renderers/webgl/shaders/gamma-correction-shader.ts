/**
 * Gamma Correction Shader
 * http://en.wikipedia.org/wiki/gamma_correction
 */

 const GammaCorrectionShader = {

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

// #include <colorspace_fragment>

/*
float linearSrgbChannelToSrgbChannel(float value) {
    float calculatedValue = 0.0;
    calculatedValue += step(value, 0.0031308) * value * 12.92;
    calculatedValue += step(0.0031308, value) * (pow(value, 1.0 / 2.4) * 1.055 - 0.055);
    return clamp(calculatedValue, 0.0, 1.0);
}

vec3 linearSrgbToSrgb(vec3 rgb) {
    return vec3(
        linearSrgbChannelToSrgbChannel(rgb.r),
        linearSrgbChannelToSrgbChannel(rgb.g),
        linearSrgbChannelToSrgbChannel(rgb.b)
    );
}

vec3 xLinearToSrgb(vec3 color) {
    // Approximation http://chilliant.blogspot.com/2012/08/srgb-approximations-for-hlsl.html
    vec3 linearColor = color.rgb;
    vec3 S1 = sqrt(linearColor);
    vec3 S2 = sqrt(S1);
    vec3 S3 = sqrt(S2);
    color.rgb = 0.662002687 * S1 + 0.684122060 * S2 - 0.323583601 * S3 - 0.0225411470 * linearColor;
    return color;
}
*/

export { GammaCorrectionShader };
